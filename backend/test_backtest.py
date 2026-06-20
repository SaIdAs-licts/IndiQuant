from backtest_engine import run_backtest
import json

def test():
    print("Testing backtest engine...")
    tickers = ["RELIANCE.NS", "TCS.NS"]
    initial_capital = 100000.0
    start_date = "2023-01-01"
    end_date = "2023-12-31"
    stop_loss_pct = 5.0
    strategy_type = "MA_Crossover"
    params = {
        "fast_period": 9,
        "slow_period": 21
    }
    
    try:
        results = run_backtest(
            tickers=tickers,
            initial_capital=initial_capital,
            start_date=start_date,
            end_date=end_date,
            stop_loss_pct=stop_loss_pct,
            strategy_type=strategy_type,
            params=params
        )
        print("Success! Backtest executed successfully.")
        print("Portfolio Summary:")
        print(json.dumps(results["portfolio_summary"], indent=2))
        print("Dates count:", len(results["chart_series"]["dates"]))
        print("Buy signals count:", len(results["chart_series"]["buy_signals"]))
        print("Sell signals count:", len(results["chart_series"]["sell_signals"]))
    except Exception as e:
        print("Failed to run backtest:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
