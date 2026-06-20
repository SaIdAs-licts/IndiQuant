import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def fetch_ticker_data(ticker, start_date, end_date):
    """
    Downloads historical data for a ticker and flattens column index if needed.
    """
    try:
        # Fetch data
        df = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if df.empty:
            raise ValueError(f"No data returned for ticker '{ticker}'. Please check if the ticker is correct.")
        
        df = df.copy()
        # Flatten MultiIndex if yfinance returns it (occurs in newer yfinance versions)
        if isinstance(df.columns, pd.MultiIndex):
            try:
                # Select the main indicator level and discard ticker level if it's there
                df.columns = df.columns.get_level_values(0)
            except Exception:
                df.columns = [col[0] for col in df.columns]
                
        # Capitalize headers (yfinance outputs e.g. Close, Open, etc.)
        df.columns = [str(c).capitalize() for c in df.columns]
        
        # Ensure critical columns exist
        required = ["Open", "High", "Low", "Close", "Volume"]
        for r in required:
            if r not in df.columns:
                # Look for case-insensitive match
                matches = [c for c in df.columns if c.lower() == r.lower()]
                if matches:
                    df[r] = df[matches[0]]
                else:
                    raise ValueError(f"Required column '{r}' is missing in download for {ticker}")
                    
        return df
    except Exception as e:
        raise ValueError(f"Failed to fetch data for {ticker}: {str(e)}")

def compute_indicators(df, strategy_type, params):
    """
    Computes indicators on the DataFrame in a vectorized manner using standard pandas operations.
    """
    df = df.copy().sort_index()
    
    if strategy_type == "MA_Crossover":
        fast = int(params.get("fast_period", 9))
        slow = int(params.get("slow_period", 21))
        df["fast_ma"] = df["Close"].rolling(window=fast).mean()
        df["slow_ma"] = df["Close"].rolling(window=slow).mean()
        
    elif strategy_type == "RSI":
        rsi_period = int(params.get("rsi_period", 14))
        delta = df["Close"].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        # Wilder's smoothing RMA (running moving average)
        avg_gain = gain.ewm(com=rsi_period - 1, adjust=False).mean()
        avg_loss = loss.ewm(com=rsi_period - 1, adjust=False).mean()
        rs = avg_gain / (avg_loss + 1e-10)
        df["rsi"] = 100 - (100 / (1 + rs))
        
    elif strategy_type == "MACD":
        fast = int(params.get("macd_fast", 12))
        slow = int(params.get("macd_slow", 26))
        signal = int(params.get("macd_signal", 9))
        df["ema_fast"] = df["Close"].ewm(span=fast, adjust=False).mean()
        df["ema_slow"] = df["Close"].ewm(span=slow, adjust=False).mean()
        df["macd"] = df["ema_fast"] - df["ema_slow"]
        df["macd_signal"] = df["macd"].ewm(span=signal, adjust=False).mean()
        
    elif strategy_type == "BB":
        period = int(params.get("bb_period", 20))
        std_dev = float(params.get("bb_std", 2.0))
        df["bb_middle"] = df["Close"].rolling(window=period).mean()
        std = df["Close"].rolling(window=period).std()
        df["bb_upper"] = df["bb_middle"] + std_dev * std
        df["bb_lower"] = df["bb_middle"] - std_dev * std
        
    return df

def run_single_backtest(df, sub_capital, stop_loss_pct, strategy_type, params):
    """
    Executes the chronological loop for a single asset.
    """
    cash = float(sub_capital)
    shares = 0.0
    stop_loss_target_value = 0.0
    total_brokerage = 0.0
    trades = []
    
    # We record portfolio value day-by-day
    equity_curve = {}
    
    dates = [str(d.date()) for d in df.index]
    closes = df["Close"].values
    
    # Extract indicator lists (pre-calculated)
    fast_ma = df["fast_ma"].values if "fast_ma" in df.columns else [float('nan')] * len(closes)
    slow_ma = df["slow_ma"].values if "slow_ma" in df.columns else [float('nan')] * len(closes)
    rsi = df["rsi"].values if "rsi" in df.columns else [float('nan')] * len(closes)
    macd = df["macd"].values if "macd" in df.columns else [float('nan')] * len(closes)
    macd_signal = df["macd_signal"].values if "macd_signal" in df.columns else [float('nan')] * len(closes)
    bb_upper = df["bb_upper"].values if "bb_upper" in df.columns else [float('nan')] * len(closes)
    bb_lower = df["bb_lower"].values if "bb_lower" in df.columns else [float('nan')] * len(closes)
    
    # RSI thresholds
    oversold_threshold = float(params.get("oversold", 30))
    overbought_threshold = float(params.get("overbought", 70))
    
    for t in range(len(closes)):
        current_market_close = float(closes[t])
        current_date = dates[t]
        
        # Priority 1: Check active trailing risk boundaries (Stop Loss)
        if shares > 0.0 and current_market_close <= stop_loss_target_value:
            # Liquidate
            fee = 20.0
            revenue = shares * current_market_close - fee
            cash = revenue
            total_brokerage += fee
            trades.append({
                "type": "sell",
                "date": current_date,
                "price": current_market_close,
                "reason": "Stop-Loss Triggered"
            })
            shares = 0.0
            stop_loss_target_value = 0.0
            
        # Priority 2: Check active indicator trigger thresholds
        elif t > 0:
            buy_triggered = False
            sell_triggered = False
            reason = ""
            
            if strategy_type == "MA_Crossover":
                # Check for nan values
                if not (np.isnan(fast_ma[t]) or np.isnan(fast_ma[t-1]) or np.isnan(slow_ma[t]) or np.isnan(slow_ma[t-1])):
                    # Fast MA crosses above Slow MA
                    if fast_ma[t] > slow_ma[t] and fast_ma[t-1] <= slow_ma[t-1]:
                        buy_triggered = True
                        reason = "MA Cross Up"
                    # Fast MA crosses below Slow MA
                    elif fast_ma[t] < slow_ma[t] and fast_ma[t-1] >= slow_ma[t-1]:
                        sell_triggered = True
                        reason = "MA Cross Down"
                        
            elif strategy_type == "RSI":
                if not np.isnan(rsi[t]):
                    if rsi[t] < oversold_threshold:
                        buy_triggered = True
                        reason = "RSI Oversold"
                    elif rsi[t] > overbought_threshold:
                        sell_triggered = True
                        reason = "Target Overbought Reached"
                        
            elif strategy_type == "MACD":
                if not (np.isnan(macd[t]) or np.isnan(macd[t-1]) or np.isnan(macd_signal[t]) or np.isnan(macd_signal[t-1])):
                    # MACD crosses above Signal line
                    if macd[t] > macd_signal[t] and macd[t-1] <= macd_signal[t-1]:
                        buy_triggered = True
                        reason = "MACD Cross Up"
                    # MACD crosses below Signal line
                    elif macd[t] < macd_signal[t] and macd[t-1] >= macd_signal[t-1]:
                        sell_triggered = True
                        reason = "MACD Cross Down"
                        
            elif strategy_type == "BB":
                if not (np.isnan(bb_lower[t]) or np.isnan(bb_upper[t])):
                    if current_market_close < bb_lower[t]:
                        buy_triggered = True
                        reason = "Lower Band Crossed"
                    elif current_market_close > bb_upper[t]:
                        sell_triggered = True
                        reason = "Upper Band Crossed"
            
            # Execute Buy
            if shares == 0.0 and buy_triggered:
                fee = 20.0
                if cash > fee:
                    shares = (cash - fee) / current_market_close
                    cash = 0.0
                    total_brokerage += fee
                    stop_loss_target_value = current_market_close * (1.0 - stop_loss_pct / 100.0)
                    trades.append({
                        "type": "buy",
                        "date": current_date,
                        "price": current_market_close,
                        "reason": reason
                    })
                    
            # Execute Sell
            elif shares > 0.0 and sell_triggered:
                fee = 20.0
                revenue = shares * current_market_close - fee
                cash = revenue
                total_brokerage += fee
                trades.append({
                    "type": "sell",
                    "date": current_date,
                    "price": current_market_close,
                    "reason": reason
                })
                shares = 0.0
                stop_loss_target_value = 0.0
                
        # Trailing stop loss update: trailing the price peak
        if shares > 0.0:
            stop_loss_target_value = max(stop_loss_target_value, current_market_close * (1.0 - stop_loss_pct / 100.0))
            
        # Daily Equity Calculation
        equity_curve[current_date] = cash + (shares * current_market_close)
        
    return equity_curve, trades, total_brokerage

def run_backtest(tickers, initial_capital, start_date, end_date, stop_loss_pct, strategy_type, params):
    """
    Runs backtests across multiple assets, merges them, and generates portfolio summary analytics and chart series.
    """
    if not tickers:
        raise ValueError("At least one ticker must be provided.")
        
    sub_capital = float(initial_capital) / len(tickers)
    
    asset_results = {}
    all_dates = set()
    
    for ticker in tickers:
        # 1. Fetch data
        df = fetch_ticker_data(ticker, start_date, end_date)
        # 2. Compute indicators
        df = compute_indicators(df, strategy_type, params)
        # 3. Run backtest
        equity_curve, trades, total_brokerage = run_single_backtest(
            df, sub_capital, stop_loss_pct, strategy_type, params
        )
        
        asset_results[ticker] = {
            "df": df,
            "equity_curve": equity_curve,
            "trades": trades,
            "brokerage": total_brokerage
        }
        all_dates.update(equity_curve.keys())
        
    # Sort all dates chronologically
    sorted_dates = sorted(list(all_dates))
    
    # 4. Construct combined portfolio equity curve
    portfolio_equity = []
    
    # Track the last equity value for each asset (for forward filling if needed)
    last_equity = {ticker: sub_capital for ticker in tickers}
    
    for date in sorted_dates:
        day_total = 0.0
        for ticker in tickers:
            curve = asset_results[ticker]["equity_curve"]
            if date in curve:
                last_equity[ticker] = curve[date]
            day_total += last_equity[ticker]
        portfolio_equity.append(day_total)
        
    final_portfolio_value = portfolio_equity[-1] if portfolio_equity else initial_capital
    total_brokerage_fees = sum(asset_results[ticker]["brokerage"] for ticker in tickers)
    
    # 5. Maximum Drawdown Calculation
    peaks = []
    current_peak = 0.0
    drawdowns = []
    
    for val in portfolio_equity:
        if val > current_peak:
            current_peak = val
        peaks.append(current_peak)
        dd = (val - current_peak) / current_peak if current_peak > 0 else 0.0
        drawdowns.append(dd)
        
    portfolio_max_drawdown = min(drawdowns) * 100.0 if drawdowns else 0.0
    
    # 6. Win Rate Calculation
    # A completed trade is a buy followed by a sell
    all_completed_trades = []
    for ticker in tickers:
        trades_list = asset_results[ticker]["trades"]
        temp_buy = None
        for t in trades_list:
            if t["type"] == "buy":
                temp_buy = t
            elif t["type"] == "sell" and temp_buy is not None:
                all_completed_trades.append({
                    "ticker": ticker,
                    "buy_date": temp_buy["date"],
                    "buy_price": temp_buy["price"],
                    "sell_date": t["date"],
                    "sell_price": t["price"]
                })
                temp_buy = None
                
    wins = 0
    for trade in all_completed_trades:
        # Net trade result: Sell price value - Buy price value - 2 trades fees (40)
        # To simplify, we can check if sell price is greater than buy price, or if the net cash returned is greater.
        # Let's check net cash:
        # Since we use all sub-capital / remaining cash to buy:
        # net profit = sell_price / buy_price * (invested_cash) - 40 - invested_cash > 0
        # which simplifies to sell_price / buy_price > (invested_cash + 40) / invested_cash
        # Let's just calculate: net return is positive.
        # Let's say: sell_price > buy_price.
        if trade["sell_price"] > trade["buy_price"]:
            wins += 1
            
    win_rate = (wins / len(all_completed_trades) * 100.0) if all_completed_trades else 0.0
    
    # 7. Benchmark calculations (Default is Nifty 50 Index: ^NSEI)
    benchmark_baseline_curve = []
    benchmark_return_pct = 0.0
    
    try:
        bench_df = fetch_ticker_data("^NSEI", start_date, end_date)
        bench_dates = [str(d.date()) for d in bench_df.index]
        bench_closes = bench_df["Close"].values
        bench_map = {bench_dates[i]: bench_closes[i] for i in range(len(bench_closes))}
        
        # Scale to match initial capital and align with sorted_dates
        last_bench_close = None
        for i, date in enumerate(sorted_dates):
            if date in bench_map:
                last_bench_close = bench_map[date]
            elif last_bench_close is None:
                # Find the first available close price to use as baseline
                first_available = next((bench_map[d] for d in sorted_dates if d in bench_map), None)
                if first_available:
                    last_bench_close = first_available
                else:
                    last_bench_close = 1.0 # fallback
                    
            # Scale
            first_bench_price = bench_closes[0] if len(bench_closes) > 0 else 1.0
            scale_ratio = last_bench_close / first_bench_price if first_bench_price > 0 else 1.0
            benchmark_baseline_curve.append(initial_capital * scale_ratio)
            
        if len(bench_closes) > 1:
            benchmark_return_pct = ((bench_closes[-1] - bench_closes[0]) / bench_closes[0]) * 100.0
    except Exception:
        # Fallback if ^NSEI is not available
        # Average buy and hold return of the basket assets
        avg_bh_returns = []
        for ticker in tickers:
            closes = asset_results[ticker]["df"]["Close"].values
            if len(closes) > 1:
                avg_bh_returns.append(((closes[-1] - closes[0]) / closes[0]) * 100.0)
        benchmark_return_pct = sum(avg_bh_returns) / len(avg_bh_returns) if avg_bh_returns else 0.0
        
        # Flat scale baseline or average baseline
        for i, date in enumerate(sorted_dates):
            # Scale based on average return distributed linearly
            pct_progress = i / (len(sorted_dates) - 1) if len(sorted_dates) > 1 else 1.0
            val = initial_capital * (1.0 + (benchmark_return_pct / 100.0) * pct_progress)
            benchmark_baseline_curve.append(val)
            
    # 8. Separate Buy and Sell signals
    buy_signals = []
    sell_signals = []
    
    for ticker in tickers:
        for trade in asset_results[ticker]["trades"]:
            signal_obj = {
                "ticker": ticker,
                "date": trade["date"],
                "price": float(trade["price"]),
                "reason": trade["reason"]
            }
            if trade["type"] == "buy":
                buy_signals.append(signal_obj)
            else:
                sell_signals.append(signal_obj)
                
    # Sort signals by date
    buy_signals = sorted(buy_signals, key=lambda x: x["date"])
    sell_signals = sorted(sell_signals, key=lambda x: x["date"])
    
    net_return_pct = ((final_portfolio_value - initial_capital) / initial_capital) * 100.0
    gross_return_pct = ((final_portfolio_value + total_brokerage_fees - initial_capital) / initial_capital) * 100.0
    
    return {
        "portfolio_summary": {
            "initial_capital": float(initial_capital),
            "final_portfolio_value": round(float(final_portfolio_value), 2),
            "gross_strategy_return_pct": round(float(gross_return_pct), 2),
            "net_strategy_return_pct": round(float(net_return_pct), 2),
            "total_brokerage_fees_invoiced": round(float(total_brokerage_fees), 2),
            "portfolio_maximum_drawdown_pct": round(float(portfolio_max_drawdown), 2),
            "strategy_win_rate_pct": round(float(win_rate), 2),
            "benchmark_buy_and_hold_return_pct": round(float(benchmark_return_pct), 2)
        },
        "chart_series": {
            "dates": sorted_dates,
            "strategy_equity_curve": [round(v, 2) for v in portfolio_equity],
            "benchmark_baseline_curve": [round(v, 2) for v in benchmark_baseline_curve],
            "buy_signals": buy_signals,
            "sell_signals": sell_signals
        }
    }
