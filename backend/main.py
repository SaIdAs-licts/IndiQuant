from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from datetime import datetime

from database import save_strategy, get_strategies, delete_strategy, toggle_monitor
from backtest_engine import run_backtest

app = FastAPI(title="IndiQuant Backtester API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BacktestRequest(BaseModel):
    tickers: List[str]
    initial_capital: float
    start_date: str
    end_date: str
    stop_loss_pct: float
    strategy_type: str
    parameters: Dict[str, Any]

class StrategySaveRequest(BacktestRequest):
    net_return_pct: float

class MonitorToggleRequest(BaseModel):
    is_monitored: bool

@app.post("/api/backtest")
def api_backtest(req: BacktestRequest):
    try:
        # Standardize tickers to uppercase and validate suffixes
        cleaned_tickers = []
        for ticker in req.tickers:
            t = ticker.strip().upper()
            if not (t.endswith(".NS") or t.endswith(".BO") or t == "^NSEI"):
                # Suggest or auto-append .NS as NSE is the primary exchange in India
                t = f"{t}.NS"
            cleaned_tickers.append(t)
            
        result = run_backtest(
            tickers=cleaned_tickers,
            initial_capital=req.initial_capital,
            start_date=req.start_date,
            end_date=req.end_date,
            stop_loss_pct=req.stop_loss_pct,
            strategy_type=req.strategy_type,
            params=req.parameters
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/api/strategies")
def api_get_strategies():
    try:
        return get_strategies()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/strategies")
def api_save_strategy(req: StrategySaveRequest):
    try:
        # Standardize tickers
        cleaned_tickers = []
        for ticker in req.tickers:
            t = ticker.strip().upper()
            if not (t.endswith(".NS") or t.endswith(".BO") or t == "^NSEI"):
                t = f"{t}.NS"
            cleaned_tickers.append(t)
            
        strategy_id = save_strategy(
            tickers=cleaned_tickers,
            initial_capital=req.initial_capital,
            start_date=req.start_date,
            end_date=req.end_date,
            stop_loss_pct=req.stop_loss_pct,
            strategy_type=req.strategy_type,
            parameters=req.parameters,
            net_return_pct=req.net_return_pct
        )
        return {"status": "success", "id": strategy_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/strategies/{strategy_id}")
def api_delete_strategy(strategy_id: int):
    try:
        delete_strategy(strategy_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/strategies/{strategy_id}/monitor")
def api_toggle_monitor(strategy_id: int, req: MonitorToggleRequest):
    try:
        toggle_monitor(strategy_id, req.is_monitored)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
def api_get_signals():
    try:
        strategies = get_strategies()
        monitored_strategies = [s for s in strategies if s["is_monitored"]]
        
        signals_report = []
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        for strat in monitored_strategies:
            tickers = strat["tickers"]
            # To evaluate today's signal, run the backtest up to today's date
            try:
                result = run_backtest(
                    tickers=tickers,
                    initial_capital=strat["initial_capital"],
                    start_date=strat["start_date"],
                    end_date=today_str,
                    stop_loss_pct=strat["stop_loss_pct"],
                    strategy_type=strat["strategy_type"],
                    params=strat["parameters"]
                )
                
                dates = result["chart_series"]["dates"]
                if not dates:
                    continue
                latest_date = dates[-1]
                
                # Check signals for each ticker
                for ticker in tickers:
                    # Find trades for this ticker
                    buys = [t for t in result["chart_series"]["buy_signals"] if t["ticker"] == ticker]
                    sells = [t for t in result["chart_series"]["sell_signals"] if t["ticker"] == ticker]
                    ticker_trades = sorted(buys + sells, key=lambda x: x["date"])
                    
                    status = "⚪ HOLDING POSITION" # Default standard status
                    message = f"STATUS: HOLDING POSITION FOR {ticker}"
                    color = "blue"
                    
                    if ticker_trades:
                        last_trade = ticker_trades[-1]
                        is_buy = last_trade in buys
                        
                        if last_trade["date"] == latest_date:
                            if is_buy:
                                status = "🟢 BUY SIGNAL"
                                message = f"ALERT: BUY SIGNAL DETECTED FOR {ticker}"
                                color = "green"
                            else:
                                status = "🔴 SELL SIGNAL"
                                message = f"WARNING: EXIT/SELL IMMEDIATELY FOR {ticker} ({last_trade.get('reason', 'Stop-Loss or Target Breach')})"
                                color = "red"
                        else:
                            if is_buy:
                                status = "⚪ HOLDING POSITION"
                                message = f"STATUS: HOLDING POSITION FOR {ticker}"
                                color = "blue"
                            else:
                                status = "⚪ NO POSITION"
                                message = f"STATUS: NO POSITION FOR {ticker} (Holding Cash)"
                                color = "gray"
                    else:
                        status = "⚪ NO POSITION"
                        message = f"STATUS: NO POSITION FOR {ticker} (Holding Cash)"
                        color = "gray"
                        
                    signals_report.append({
                        "strategy_id": strat["id"],
                        "strategy_type": strat["strategy_type"],
                        "ticker": ticker,
                        "status": status,
                        "message": message,
                        "color": color,
                        "evaluated_at": latest_date
                    })
            except Exception as e:
                # Log error and skip or append failure signal
                signals_report.append({
                    "strategy_id": strat["id"],
                    "strategy_type": strat["strategy_type"],
                    "ticker": ", ".join(tickers),
                    "status": "⚠️ ERROR",
                    "message": f"Failed to monitor {', '.join(tickers)}: {str(e)}",
                    "color": "yellow",
                    "evaluated_at": today_str
                })
                
        return signals_report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
