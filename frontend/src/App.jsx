import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Settings, 
  Trash2, 
  Pin, 
  Play, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  X, 
  RefreshCw, 
  Activity, 
  ShieldAlert, 
  Calendar, 
  DollarSign, 
  Percent,
  Sliders,
  ChevronRight,
  TrendingDown,
  Download,
  Printer
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('iq_auth') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'van_de_com' && password === 'Hacker@666') {
      setIsAuthenticated(true);
      sessionStorage.setItem('iq_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid User ID or Password. Access denied.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('iq_auth');
    setUsername('');
    setPassword('');
  };

  const [activeTab, setActiveTab] = useState('studio');

  // Backtest Parameters State
  const [tickers, setTickers] = useState(['RELIANCE.NS', 'TCS.NS']);
  const [tickerInput, setTickerInput] = useState('');
  const [initialCapital, setInitialCapital] = useState(100000);
  
  // Dates: Default to 3 years ago to today
  const getFormattedDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const today = new Date();
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(today.getFullYear() - 3);
  
  const [startDate, setStartDate] = useState(getFormattedDate(threeYearsAgo));
  const [endDate, setEndDate] = useState(getFormattedDate(today));
  
  const [stopLossPct, setStopLossPct] = useState(5);
  const [strategyType, setStrategyType] = useState('MA_Crossover');
  
  // Strategy Parameters
  const [maParams, setMaParams] = useState({ fast_period: 9, slow_period: 21 });
  const [rsiParams, setRsiParams] = useState({ rsi_period: 14, oversold: 30, overbought: 70 });
  const [macdParams, setMacdParams] = useState({ macd_fast: 12, macd_slow: 26, macd_signal: 9 });
  const [bbParams, setBbParams] = useState({ bb_period: 20, bb_std: 2.0 });

  // Results & Loading State
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Watchlist & Signals State
  const [watchlist, setWatchlist] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [signalsError, setSignalsError] = useState(null);

  // Load Watchlist and Signals on init
  useEffect(() => {
    fetchWatchlist();
  }, []);

  useEffect(() => {
    if (activeTab === 'watchlist') {
      fetchSignals();
    }
  }, [activeTab, watchlist]);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/strategies');
      if (!res.ok) throw new Error('Failed to load watchlist');
      const data = await res.json();
      setWatchlist(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSignals = async () => {
    setLoadingSignals(true);
    setSignalsError(null);
    try {
      const res = await fetch('/api/signals');
      if (!res.ok) throw new Error('Failed to load signal monitoring data');
      const data = await res.json();
      setSignals(data);
    } catch (err) {
      setSignalsError(err.message);
    } finally {
      setLoadingSignals(false);
    }
  };

  // Date Quick Presets
  const setPresetRange = (years) => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - years);
    setStartDate(getFormattedDate(start));
    setEndDate(getFormattedDate(end));
  };

  // Ticker Chip Handlers
  const addTicker = () => {
    if (!tickerInput.trim()) return;
    let newTicker = tickerInput.trim().toUpperCase();
    
    // Auto suffix checking
    if (newTicker !== '^NSEI' && !newTicker.endsWith('.NS') && !newTicker.endsWith('.BO')) {
      newTicker = `${newTicker}.NS`; // default to NSE
    }
    
    if (tickers.includes(newTicker)) {
      setError('Ticker already added.');
      return;
    }
    
    if (tickers.length >= 3) {
      setError('A maximum of 3 tickers can be backtested simultaneously.');
      return;
    }
    
    setTickers([...tickers, newTicker]);
    setTickerInput('');
    setError(null);
  };

  const removeTicker = (indexToRemove) => {
    setTickers(tickers.filter((_, idx) => idx !== indexToRemove));
  };

  const handleTickerKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTicker();
    }
  };

  // Get current parameters dictionary based on strategy selected
  const getParamsForExecution = () => {
    switch (strategyType) {
      case 'MA_Crossover': return maParams;
      case 'RSI': return rsiParams;
      case 'MACD': return macdParams;
      case 'BB': return bbParams;
      default: return {};
    }
  };

  // Backtest Trigger
  const executeBacktest = async () => {
    if (tickers.length === 0) {
      setError('Please add at least one stock ticker to execute backtest.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setSaveSuccess(false);

    try {
      const payload = {
        tickers,
        initial_capital: parseFloat(initialCapital),
        start_date: startDate,
        end_date: endDate,
        stop_loss_pct: parseFloat(stopLossPct),
        strategy_type: strategyType,
        parameters: getParamsForExecution()
      };

      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errDetail = await res.json();
        throw new Error(errDetail.detail || 'Failed to complete backtest.');
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save Strategy to Watchlist
  const saveStrategyConfig = async () => {
    if (!results) {
      setError('Please execute the strategy test first to save configuration.');
      return;
    }
    setError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        tickers,
        initial_capital: parseFloat(initialCapital),
        start_date: startDate,
        end_date: endDate,
        stop_loss_pct: parseFloat(stopLossPct),
        strategy_type: strategyType,
        parameters: getParamsForExecution(),
        net_return_pct: results.portfolio_summary.net_strategy_return_pct
      };

      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save strategy config');
      
      setSaveSuccess(true);
      fetchWatchlist();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete Strategy from DB
  const handleDeleteStrategy = async (id) => {
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete strategy');
      fetchWatchlist();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Strategy Monitoring
  const handleToggleMonitor = async (id, currentStatus) => {
    try {
      const res = await fetch(`/api/strategies/${id}/monitor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_monitored: !currentStatus })
      });
      if (!res.ok) throw new Error('Failed to toggle active monitoring');
      fetchWatchlist();
    } catch (err) {
      console.error(err);
    }
  };

  // Download Text Report
  const downloadTxtReport = () => {
    if (!results) return;
    
    const summary = results.portfolio_summary;
    const chart = results.chart_series;
    
    let report = `INDIQUANT BACKTEST REPORT\n`;
    report += `=========================\n`;
    report += `Generated at: ${new Date().toLocaleString()}\n`;
    report += `Strategy: ${strategyType.replace('_', ' ')}\n`;
    report += `Assets: ${tickers.join(', ')}\n`;
    report += `Date Range: ${startDate} to ${endDate}\n`;
    report += `Stop-Loss Threshold: ${stopLossPct}%\n\n`;

    report += `PORTFOLIO PERFORMANCE SUMMARY\n`;
    report += `-----------------------------\n`;
    report += `Initial Capital:            ${formatCurrency(summary.initial_capital)}\n`;
    report += `Final Portfolio Value:      ${formatCurrency(summary.final_portfolio_value)}\n`;
    report += `Net Strategy Return:        ${summary.net_strategy_return_pct}%\n`;
    report += `Gross Strategy Return:      ${summary.gross_strategy_return_pct}%\n`;
    report += `Portfolio Maximum Drawdown: ${summary.portfolio_maximum_drawdown_pct}%\n`;
    report += `Strategy Win Rate:          ${summary.strategy_win_rate_pct}%\n`;
    report += `Total Friction Fees Paid:   ${formatCurrency(summary.total_brokerage_fees_invoiced)}\n`;
    report += `Benchmark Buy & Hold Return: ${summary.benchmark_buy_and_hold_return_pct}%\n\n`;

    report += `TRANSACTION LOGS (${chart.buy_signals.length + chart.sell_signals.length} operations)\n`;
    report += `------------------------------------------------------------\n`;
    report += `${String('Date').padEnd(12)} | ${String('Ticker').padEnd(12)} | ${String('Operation').padEnd(10)} | ${String('Price').padEnd(14)} | ${String('Friction Fee').padEnd(12)} | Trigger Reason\n`;

    // Combine buys and sells chronologically
    const allTrades = [
      ...chart.buy_signals.map(b => ({ ...b, op: 'BUY' })),
      ...chart.sell_signals.map(s => ({ ...s, op: 'SELL' }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    allTrades.forEach(trade => {
      report += `${trade.date.padEnd(12)} | ${trade.ticker.padEnd(12)} | ${trade.op.padEnd(10)} | ${formatCurrency(trade.price).padEnd(14)} | ₹20.00       | ${trade.reason}\n`;
    });

    if (allTrades.length === 0) {
      report += `No trades executed in this period.\n`;
    }

    report += `\n============================================================\n`;
    report += `Disclaimer: Backtested results do not guarantee future returns.\n`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `indiquant_backtest_report_${strategyType}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper formatters
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Convert chart dates and values into combined series
  const prepareChartData = () => {
    if (!results || !results.chart_series) return [];
    
    const dates = results.chart_series.dates;
    const strategy = results.chart_series.strategy_equity_curve;
    const benchmark = results.chart_series.benchmark_baseline_curve;
    const buys = results.chart_series.buy_signals;
    const sells = results.chart_series.sell_signals;

    return dates.map((date, idx) => {
      // Find signal if it happened on this date
      const buyOnDate = buys.find(b => b.date === date);
      const sellOnDate = sells.find(s => s.date === date);
      
      return {
        date,
        Strategy: strategy[idx],
        Benchmark: benchmark[idx],
        buyPrice: buyOnDate ? buyOnDate.price : null,
        buyTicker: buyOnDate ? buyOnDate.ticker : null,
        sellPrice: sellOnDate ? sellOnDate.price : null,
        sellTicker: sellOnDate ? sellOnDate.ticker : null,
        sellReason: sellOnDate ? sellOnDate.reason : null,
      };
    });
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-300">{data.date}</p>
          <p className="text-emerald-400">
            Strategy Equity: <span className="font-semibold">{formatCurrency(data.Strategy)}</span>
          </p>
          <p className="text-cyan-400">
            Nifty 50 Buy & Hold: <span className="font-semibold">{formatCurrency(data.Benchmark)}</span>
          </p>
          {data.buyPrice && (
            <div className="mt-2 pt-1 border-t border-slate-800 text-green-400 font-medium">
              🟢 Buy {data.buyTicker}: {formatCurrency(data.buyPrice)}
            </div>
          )}
          {data.sellPrice && (
            <div className="mt-2 pt-1 border-t border-slate-800 text-rose-400 font-medium">
              🔴 Sell {data.sellTicker}: {formatCurrency(data.sellPrice)}
              <span className="block text-[10px] text-slate-500 font-normal">({data.sellReason})</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md glass-panel p-8 rounded-2xl space-y-6 shadow-2xl shadow-slate-950 border border-slate-800/80 relative z-10">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                IndiQuant <span className="gradient-text font-black">Security Portal</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-1">
                Algorithmic Platform Authentication
              </p>
            </div>
          </div>

          {loginError && (
            <div className="p-3.5 bg-rose-950/30 border border-rose-900/50 rounded-xl text-rose-350 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">User ID</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter User ID"
                className="w-full bg-slate-900/85 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all placeholder-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Security Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                className="w-full bg-slate-900/85 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all placeholder-slate-600"
              />
            </div>

            <button
              type="submit"
              className="w-full gradient-btn py-3 rounded-xl flex items-center justify-center gap-2 text-xs tracking-wider uppercase font-bold mt-2"
            >
              Authenticate Session
            </button>
          </form>

          <div className="text-center text-[10px] text-slate-600">
            Authorized quant developers only. All connections logged.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                IndiQuant <span className="gradient-text font-black">Backtester</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                NSE & BSE Quant Studio
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab('studio')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
                  activeTab === 'studio' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Backtest Studio
              </button>
              <button
                onClick={() => setActiveTab('watchlist')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-1.5 ${
                  activeTab === 'watchlist' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Watchlist & Signals
                {watchlist.filter(w => w.is_monitored).length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:text-rose-400 text-slate-450 rounded-xl text-xs font-semibold transition-all duration-300"
              title="Logout Session"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        
        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3 animate-fadeIn text-red-200">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold block mb-0.5">Execution Warning</span>
              {error}
            </div>
          </div>
        )}

        {activeTab === 'studio' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Panel: Parameters Form (4 columns) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Asset Multi-Select Container */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-300">
                    1. Select Assets
                  </h3>
                  <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                    Max 3
                  </span>
                </div>
                
                {/* Custom Chip Box */}
                <div className="flex flex-wrap gap-2 min-h-[46px] p-2 bg-slate-950/60 rounded-xl border border-slate-900">
                  {tickers.map((ticker, idx) => (
                    <span 
                      key={ticker} 
                      className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400"
                    >
                      {ticker}
                      <button 
                        onClick={() => removeTicker(idx)} 
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {tickers.length === 0 && (
                    <span className="text-slate-500 text-xs flex items-center px-1">
                      No tickers added. Enter symbols below...
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value)}
                    onKeyDown={handleTickerKeyDown}
                    placeholder="e.g. RELIANCE or INFYS.BO"
                    className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80"
                  />
                  <button 
                    onClick={addTicker}
                    className="p-2.5 bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:text-emerald-400 rounded-xl transition-all"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      if (!tickers.includes('^NSEI') && tickers.length < 3) {
                        setTickers([...tickers, '^NSEI']);
                      }
                    }}
                    className="text-[10px] text-slate-400 bg-slate-900 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-800/80"
                  >
                    + Nifty 50 Index (^NSEI)
                  </button>
                  <button
                    onClick={() => setTickers(['RELIANCE.NS', 'TCS.NS', 'INFY.NS'])}
                    className="text-[10px] text-slate-400 bg-slate-900 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-800/80"
                  >
                    Set Default Trio
                  </button>
                </div>
              </div>

              {/* Capital & Parameters Config */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-semibold tracking-wide text-slate-300">
                  2. Budget & Timeline
                </h3>
                
                {/* Capital input */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 flex items-center gap-1">
                    <DollarSign className="h-3 w.3" />
                    Initial Capital (₹)
                  </label>
                  <input
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Math.max(1000, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Timeline dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Timeline Presets */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPresetRange(3)}
                    className="flex-1 text-[10px] text-center text-slate-400 bg-slate-900 hover:bg-slate-800 py-1.5 rounded-lg border border-slate-800"
                  >
                    3 Years Preset
                  </button>
                  <button
                    onClick={() => setPresetRange(5)}
                    className="flex-1 text-[10px] text-center text-slate-400 bg-slate-900 hover:bg-slate-800 py-1.5 rounded-lg border border-slate-800"
                  >
                    5 Years Preset
                  </button>
                </div>

                {/* Stop Loss slider */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      Stop-Loss Threshold
                    </span>
                    <span className="font-semibold text-rose-400">{stopLossPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={stopLossPct}
                    onChange={(e) => setStopLossPct(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1% (Aggressive)</span>
                    <span>20% (Conservative)</span>
                  </div>
                </div>
              </div>

              {/* Strategy Configuration */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-semibold tracking-wide text-slate-300">
                  3. Logic Ruleset
                </h3>
                
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 flex items-center gap-1">
                    <Sliders className="h-3 w-3" />
                    Select Signal Indicator
                  </label>
                  <select
                    value={strategyType}
                    onChange={(e) => setStrategyType(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="MA_Crossover">Moving Average Crossover</option>
                    <option value="RSI">Relative Strength Index (RSI)</option>
                    <option value="MACD">MACD Oscillator</option>
                    <option value="BB">Bollinger Bands</option>
                  </select>
                </div>

                {/* Sub-inputs dependent on strategy */}
                {strategyType === 'MA_Crossover' && (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Fast MA Period</label>
                      <input
                        type="number"
                        value={maParams.fast_period}
                        onChange={(e) => setMaParams({ ...maParams, fast_period: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Slow MA Period</label>
                      <input
                        type="number"
                        value={maParams.slow_period}
                        onChange={(e) => setMaParams({ ...maParams, slow_period: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {strategyType === 'RSI' && (
                  <div className="space-y-3 pt-1 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">RSI Period</label>
                      <input
                        type="number"
                        value={rsiParams.rsi_period}
                        onChange={(e) => setRsiParams({ ...rsiParams, rsi_period: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Oversold (Buy)</label>
                        <input
                          type="number"
                          value={rsiParams.oversold}
                          onChange={(e) => setRsiParams({ ...rsiParams, oversold: intValue(e.target.value) })}
                          className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Overbought (Sell)</label>
                        <input
                          type="number"
                          value={rsiParams.overbought}
                          onChange={(e) => setRsiParams({ ...rsiParams, overbought: intValue(e.target.value) })}
                          className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {strategyType === 'MACD' && (
                  <div className="grid grid-cols-3 gap-2 pt-1 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold">Fast Length</label>
                      <input
                        type="number"
                        value={macdParams.macd_fast}
                        onChange={(e) => setMacdParams({ ...macdParams, macd_fast: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold">Slow Length</label>
                      <input
                        type="number"
                        value={macdParams.macd_slow}
                        onChange={(e) => setMacdParams({ ...macdParams, macd_slow: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold">Signal Length</label>
                      <input
                        type="number"
                        value={macdParams.macd_signal}
                        onChange={(e) => setMacdParams({ ...macdParams, macd_signal: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {strategyType === 'BB' && (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Period</label>
                      <input
                        type="number"
                        value={bbParams.bb_period}
                        onChange={(e) => setBbParams({ ...bbParams, bb_period: Math.max(1, intValue(e.target.value)) })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Std Dev</label>
                      <input
                        type="number"
                        step="0.1"
                        value={bbParams.bb_std}
                        onChange={(e) => setBbParams({ ...bbParams, bb_std: parseFloat(e.target.value) || 2.0 })}
                        className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={executeBacktest}
                  disabled={loading}
                  className="flex-1 gradient-btn py-3 rounded-xl flex items-center justify-center gap-2 text-xs tracking-wider uppercase font-bold disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current text-white" />
                      Execute Strategy Test
                    </>
                  )}
                </button>
                
                {results && (
                  <button
                    onClick={saveStrategyConfig}
                    className={`p-3 rounded-xl border flex items-center justify-center transition-all ${
                      saveSuccess 
                        ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400' 
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                    title="Save Configuration to Watchlist"
                  >
                    {saveSuccess ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>

            </div>

            {/* Right Panel: Results Dashboard & Chart (8 columns) */}
            <div className="lg:col-span-8 space-y-6">
              
              {loading && (
                <div className="glass-panel h-[400px] rounded-2xl flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-400 animate-pulse font-medium">
                    Compiling vectorized technical indicators & running simulation timeline...
                  </p>
                </div>
              )}

              {!loading && !results && (
                <div className="glass-panel h-[400px] rounded-2xl flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                    <Activity className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300">Workspace Ready</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Configure your stock basket, select your parameters, and press "Execute Strategy Test" to initialize vectorized market simulations.
                    </p>
                  </div>
                </div>
              )}

              {/* Backtest Successful Dashboard */}
              {results && !loading && (
                <div className="space-y-6 animate-fadeIn">

                  {/* Export & Print Report Controls */}
                  <div className="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-850">
                    <div>
                      <h4 className="text-sm font-semibold tracking-wide text-slate-200">
                        Simulation Report
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Export metrics and transaction logs for future reference.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={downloadTxtReport}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-350 transition-all"
                        title="Download TXT Report"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download TXT
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-350 transition-all"
                        title="Print / Save PDF Report"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print PDF
                      </button>
                    </div>
                  </div>
                  
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    
                    <div className="glass-panel p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Net Returns
                      </span>
                      <div className="flex items-center justify-between">
                        <span className={`text-lg font-extrabold ${
                          results.portfolio_summary.net_strategy_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {results.portfolio_summary.net_strategy_return_pct}%
                        </span>
                        {results.portfolio_summary.net_strategy_return_pct >= results.portfolio_summary.benchmark_buy_and_hold_return_pct ? (
                          <span className="text-[9px] text-emerald-500 bg-emerald-950/40 px-1.5 py-0.5 rounded font-semibold border border-emerald-900">
                            Outperform
                          </span>
                        ) : (
                          <span className="text-[9px] text-rose-500 bg-rose-950/40 px-1.5 py-0.5 rounded font-semibold border border-rose-900">
                            Underperform
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Gross: {results.portfolio_summary.gross_strategy_return_pct}%
                      </span>
                    </div>

                    <div className="glass-panel p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Portfolio Value
                      </span>
                      <span className="text-lg font-extrabold text-slate-200 block">
                        {formatCurrency(results.portfolio_summary.final_portfolio_value)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Capital: {formatCurrency(results.portfolio_summary.initial_capital)}
                      </span>
                    </div>

                    <div className="glass-panel p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Max Drawdown
                      </span>
                      <span className="text-lg font-extrabold text-rose-400 block">
                        {results.portfolio_summary.portfolio_maximum_drawdown_pct}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Benchmark: {results.portfolio_summary.benchmark_buy_and_hold_return_pct}%
                      </span>
                    </div>

                    <div className="glass-panel p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Win Rate
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-extrabold text-teal-400 block">
                          {results.portfolio_summary.strategy_win_rate_pct}%
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {results.chart_series.buy_signals.length} Trades
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Friction Fees: {formatCurrency(results.portfolio_summary.total_brokerage_fees_invoiced)}
                      </span>
                    </div>

                  </div>

                  {/* Equity Curve Visualizer */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold tracking-wide text-slate-350">
                          Equity Curve Comparison
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Strategy performance scaled against buying & holding the Nifty 50 Index.
                        </p>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Strategy
                        </span>
                        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-cyan-450" />
                          Nifty 50
                        </span>
                      </div>
                    </div>

                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={prepareChartData()}>
                          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#64748b" 
                            fontSize={10}
                            tickLine={false}
                            axisLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            stroke="#64748b" 
                            fontSize={10} 
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `₹${v/1000}k`}
                            dx={-10}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155' }} />
                          <Line 
                            type="monotone" 
                            dataKey="Strategy" 
                            stroke="#10b981" 
                            strokeWidth={2.5} 
                            dot={false}
                            activeDot={{ r: 5, stroke: '#020617', strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Benchmark" 
                            stroke="#06b6d4" 
                            strokeWidth={1.5} 
                            strokeDasharray="4 4"
                            dot={false}
                            activeDot={{ r: 4, stroke: '#020617', strokeWidth: 1.5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Trades Log Table */}
                  <div className="glass-panel p-5 rounded-2xl space-y-3">
                    <h4 className="text-sm font-semibold text-slate-300">
                      Transaction Logs ({results.chart_series.buy_signals.length + results.chart_series.sell_signals.length} operations)
                    </h4>
                    
                    <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-medium">
                            <th className="py-2.5">Date</th>
                            <th className="py-2.5">Asset</th>
                            <th className="py-2.5">Operation</th>
                            <th className="py-2.5 text-right">Execution Price</th>
                            <th className="py-2.5 text-right">Friction Fee</th>
                            <th className="py-2.5 pr-2 pl-4">Trigger Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-slate-350">
                          {/* We combine buy and sell signals chronologically */}
                          {[
                            ...results.chart_series.buy_signals.map(b => ({ ...b, op: 'BUY', color: 'text-emerald-400' })),
                            ...results.chart_series.sell_signals.map(s => ({ ...s, op: 'SELL', color: 'text-rose-400' }))
                          ]
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((trade, i) => (
                            <tr key={i} className="hover:bg-slate-900/30">
                              <td className="py-2">{trade.date}</td>
                              <td className="py-2 font-bold text-slate-200">{trade.ticker}</td>
                              <td className={`py-2 font-extrabold ${trade.color}`}>{trade.op}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(trade.price)}</td>
                              <td className="py-2 text-right text-slate-500">₹20.00</td>
                              <td className="py-2 pr-2 pl-4 text-slate-400 italic text-[11px]">
                                {trade.reason}
                              </td>
                            </tr>
                          ))}
                          {results.chart_series.buy_signals.length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-6 text-center text-slate-500 italic">
                                No signals triggered in this date range. Try adjusting indicators or relaxing parameters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        ) : (
          /* Tab 2: Strategy Watchlist & Signals */
          <div className="space-y-8 animate-fadeIn">
            
            {/* Live Warning Signals Box */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-500" />
                    Committed Strategy Signals Engine
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Evaluates today's live closing prices against configurations committed for real-time monitoring.
                  </p>
                </div>
                
                <button
                  onClick={fetchSignals}
                  disabled={loadingSignals}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs font-semibold hover:border-slate-700 flex items-center gap-2 disabled:opacity-50 text-slate-300"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingSignals ? 'animate-spin' : ''}`} />
                  Check Live Market
                </button>
              </div>

              {signalsError && (
                <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-xs text-rose-350 rounded-xl">
                  {signalsError}
                </div>
              )}

              {/* Alerts Stack */}
              <div className="space-y-3">
                {signals.map((sig, idx) => {
                  let alertBg = 'bg-slate-900/45 border-slate-800/80 text-slate-400';
                  let icon = <Pin className="h-4 w-4" />;
                  
                  if (sig.status === '🟢 BUY SIGNAL') {
                    alertBg = 'bg-green-950/20 border-green-800/40 text-green-300 animate-pulse';
                    icon = <CheckCircle className="h-4 w-4 text-green-400" />;
                  } else if (sig.status === '🔴 SELL SIGNAL') {
                    alertBg = 'bg-red-950/20 border-red-800/40 text-red-300 animate-pulse';
                    icon = <AlertTriangle className="h-4 w-4 text-red-400" />;
                  } else if (sig.status === '⚪ HOLDING POSITION') {
                    alertBg = 'bg-cyan-950/10 border-cyan-900/30 text-cyan-200';
                    icon = <TrendingUp className="h-4 w-4 text-cyan-400" />;
                  }
                  
                  return (
                    <div 
                      key={idx} 
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${alertBg}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1 rounded bg-slate-950/50">
                          {icon}
                        </div>
                        <div>
                          <span className="font-bold block tracking-wide">{sig.message}</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">
                            Rule: {sig.strategy_type} | Checked on: {sig.evaluated_at}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-extrabold text-[10px] uppercase tracking-wider ${
                          sig.status.startsWith('🟢') ? 'bg-green-950 border border-green-900 text-green-400' :
                          sig.status.startsWith('🔴') ? 'bg-red-950 border border-red-900 text-red-400' :
                          sig.status.startsWith('⚪') && sig.status.includes('HOLD') ? 'bg-cyan-950 border border-cyan-900 text-cyan-400' :
                          'bg-slate-950 border border-slate-800 text-slate-400'
                        }`}>
                          {sig.status.replace(/^[🟢🔴⚪]\s+/, '')}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                {signals.length === 0 && !loadingSignals && (
                  <div className="py-6 text-center text-xs text-slate-500 italic">
                    No strategies are currently committed for active monitoring. Toggle the 📌 pin on your saved cards to start alerts.
                  </div>
                )}
              </div>
            </div>

            {/* Saved Strategies Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Saved Strategy Basket Matrices ({watchlist.length})
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((strat) => (
                  <div 
                    key={strat.id} 
                    className={`glass-card p-5 rounded-2xl space-y-4 flex flex-col justify-between border transition-all duration-300 relative ${
                      strat.is_monitored ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/20' : 'border-slate-850'
                    }`}
                  >
                    {/* Header: Basket & Strategy type */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {strat.tickers.map(t => (
                            <span key={t} className="text-[10px] font-bold bg-slate-950 px-2 py-0.5 rounded text-emerald-400 border border-slate-900">
                              {t}
                            </span>
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleMonitor(strat.id, strat.is_monitored)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              strat.is_monitored 
                                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350'
                            }`}
                            title={strat.is_monitored ? "Active Monitoring Enabled" : "Commit to Active Monitor"}
                          >
                            <Pin className={`h-3.5 w-3.5 ${strat.is_monitored ? 'fill-current' : ''}`} />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteStrategy(strat.id)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 transition-all"
                            title="Delete Configuration"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-200 mt-2">
                        {strat.strategy_type === 'MA_Crossover' ? 'Moving Average Crossover' :
                         strat.strategy_type === 'RSI' ? 'RSI Threshold' :
                         strat.strategy_type === 'MACD' ? 'MACD Oscillator' :
                         strat.strategy_type === 'BB' ? 'Bollinger Bands breakout' : strat.strategy_type}
                      </h4>
                      
                      <span className="text-[10px] text-slate-500 block">
                        Saved on: {new Date(strat.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Params specs info list */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 text-[10px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Capital:</span>
                        <span className="font-semibold text-slate-300">{formatCurrency(strat.initial_capital)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Stop-Loss:</span>
                        <span className="font-semibold text-rose-400">{strat.stop_loss_pct}%</span>
                      </div>
                      {strat.strategy_type === 'MA_Crossover' && (
                        <div className="flex justify-between">
                          <span>Fast / Slow MA:</span>
                          <span className="font-semibold text-slate-350">{strat.parameters.fast_period}d / {strat.parameters.slow_period}d</span>
                        </div>
                      )}
                      {strat.strategy_type === 'RSI' && (
                        <div className="flex justify-between">
                          <span>RSI Limits (OB/OS):</span>
                          <span className="font-semibold text-slate-350">{strat.parameters.overbought} / {strat.parameters.oversold}</span>
                        </div>
                      )}
                      {strat.strategy_type === 'MACD' && (
                        <div className="flex justify-between">
                          <span>Fast/Slow/Sig:</span>
                          <span className="font-semibold text-slate-350">{strat.parameters.macd_fast}/{strat.parameters.macd_slow}/{strat.parameters.macd_signal}</span>
                        </div>
                      )}
                      {strat.strategy_type === 'BB' && (
                        <div className="flex justify-between">
                          <span>Period / Standard Dev:</span>
                          <span className="font-semibold text-slate-350">{strat.parameters.bb_period}d / {strat.parameters.bb_std}x</span>
                        </div>
                      )}
                    </div>

                    {/* Stored historical return status */}
                    <div className="pt-2 border-t border-slate-900/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Historical Net Return</span>
                      <span className={`text-sm font-extrabold ${strat.net_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {strat.net_return_pct >= 0 ? '+' : ''}{strat.net_return_pct}%
                      </span>
                    </div>

                  </div>
                ))}
                
                {watchlist.length === 0 && (
                  <div className="col-span-full py-16 text-center glass-panel rounded-2xl text-slate-500 text-xs italic">
                    No strategy Configurations saved in Watchlist. Return to Backtest Studio, configure, and save a test matrix.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-slate-500 text-[11px]">
          <p> © 2026 Saidas B. All rights reserved.</p>
          <div className="flex gap-4 mt-2 md:mt-0">
            <span className="hover:text-slate-400 cursor-pointer">Security Protocol</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">System Status</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Regulatory Disclaimers</span>
          </div>
        </div>
      </footer>
    </div>
  );

  // Parse Integer Helper safely
  function intValue(val) {
    const parsed = parseInt(val);
    return isNaN(parsed) ? 1 : parsed;
  }
}
