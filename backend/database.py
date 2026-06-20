import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backtester.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS strategies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tickers TEXT NOT NULL,
            initial_capital REAL NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            stop_loss_pct REAL NOT NULL,
            strategy_type TEXT NOT NULL,
            parameters TEXT NOT NULL,
            is_monitored INTEGER DEFAULT 0,
            net_return_pct REAL NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def save_strategy(tickers, initial_capital, start_date, end_date, stop_loss_pct, strategy_type, parameters, net_return_pct):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO strategies (tickers, initial_capital, start_date, end_date, stop_loss_pct, strategy_type, parameters, net_return_pct, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        json.dumps(tickers),
        initial_capital,
        start_date,
        end_date,
        stop_loss_pct,
        strategy_type,
        json.dumps(parameters),
        net_return_pct,
        created_at
    ))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()
    return inserted_id

def get_strategies():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM strategies ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    
    strategies = []
    for r in rows:
        strategies.append({
            "id": r["id"],
            "tickers": json.loads(r["tickers"]),
            "initial_capital": r["initial_capital"],
            "start_date": r["start_date"],
            "end_date": r["end_date"],
            "stop_loss_pct": r["stop_loss_pct"],
            "strategy_type": r["strategy_type"],
            "parameters": json.loads(r["parameters"]),
            "is_monitored": bool(r["is_monitored"]),
            "net_return_pct": r["net_return_pct"],
            "created_at": r["created_at"]
        })
    return strategies

def delete_strategy(strategy_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM strategies WHERE id = ?", (strategy_id,))
    conn.commit()
    conn.close()

def toggle_monitor(strategy_id, is_monitored):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE strategies SET is_monitored = ? WHERE id = ?", (1 if is_monitored else 0, strategy_id))
    conn.commit()
    conn.close()

# Initialize on import
init_db()
