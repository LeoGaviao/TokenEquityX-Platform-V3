'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';

const API   = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const NAVY  = '#1A3C5E';
const GOLD  = '#C8972B';
const GREEN = '#16a34a';
const RED   = '#dc2626';

const TIMEFRAMES = [
  { label: '1D',  days: 1,   interval: '5m'  },
  { label: '1W',  days: 7,   interval: '1h'  },
  { label: '1M',  days: 30,  interval: '4h'  },
  { label: '3M',  days: 90,  interval: '1D'  },
  { label: '1Y',  days: 365, interval: '1W'  },
  { label: 'ALL', days: 0,   interval: '1W'  },
];

const CHART_TYPES = ['Line', 'Area', 'Candle'];
const INDICATORS  = ['MA7', 'MA30', 'Volume', 'Bollinger'];

// ── Custom candlestick shape for recharts
function CandlestickBar({ x, y, width, height, open, close, high, low, payload }) {
  if (!payload || payload.open == null) return null;
  const isUp    = payload.close >= payload.open;
  const color   = isUp ? GREEN : RED;
  const bodyTop = isUp ? payload.close : payload.open;
  const bodyBot = isUp ? payload.open  : payload.close;
  const priceRange = payload.high - payload.low;
  if (priceRange === 0) return null;

  const toY = (price) => y + height * (1 - (price - payload.low) / priceRange);

  const bodyTopY  = toY(bodyTop);
  const bodyBotY  = toY(bodyBot);
  const highY     = toY(payload.high);
  const lowY      = toY(payload.low);
  const centerX   = x + width / 2;
  const bodyH     = Math.max(1, bodyBotY - bodyTopY);
  const bodyW     = Math.max(2, width * 0.6);

  return (
    <g>
      {/* Wick */}
      <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth={1}/>
      {/* Body */}
      <rect x={centerX - bodyW/2} y={bodyTopY} width={bodyW} height={bodyH} fill={color} stroke={color} strokeWidth={0.5}/>
    </g>
  );
}

// ── Custom tooltip
function ChartTooltip({ active, payload, label, chartType }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-xl min-w-[160px]">
      <p className="text-gray-400 mb-2">{label}</p>
      {chartType === 'Candle' ? (
        <div className="space-y-1">
          <div className="flex justify-between gap-4"><span className="text-gray-500">Open</span><span className="text-white font-mono">${parseFloat(d.open||0).toFixed(4)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">High</span><span className="text-green-400 font-mono">${parseFloat(d.high||0).toFixed(4)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Low</span><span className="text-red-400 font-mono">${parseFloat(d.low||0).toFixed(4)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Close</span><span className={`font-mono font-bold ${d.close>=d.open?'text-green-400':'text-red-400'}`}>${parseFloat(d.close||0).toFixed(4)}</span></div>
          {d.volume > 0 && <div className="flex justify-between gap-4 pt-1 border-t border-gray-700"><span className="text-gray-500">Volume</span><span className="text-blue-400 font-mono">${d.volume?.toLocaleString()}</span></div>}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between gap-4"><span className="text-gray-500">Price</span><span className="text-white font-mono font-bold">${parseFloat(d.close||d.price||0).toFixed(4)}</span></div>
          {d.volume > 0 && <div className="flex justify-between gap-4"><span className="text-gray-500">Volume</span><span className="text-blue-400 font-mono">${d.volume?.toLocaleString()}</span></div>}
          {d.ma7  && <div className="flex justify-between gap-4"><span className="text-yellow-400">MA7</span><span className="font-mono">${parseFloat(d.ma7).toFixed(4)}</span></div>}
          {d.ma30 && <div className="flex justify-between gap-4"><span className="text-purple-400">MA30</span><span className="font-mono">${parseFloat(d.ma30).toFixed(4)}</span></div>}
        </div>
      )}
    </div>
  );
}

// ── Generate mock OHLCV data when no real trades exist
function generateMockOHLCV(basePrice, days, interval) {
  const points = Math.min(200, days > 0 ? days * (interval === '5m' ? 288 : interval === '1h' ? 24 : interval === '4h' ? 6 : 1) : 100);
  const data = [];
  let price = basePrice;
  const now = Date.now();
  const msPerPoint = (days > 0 ? days * 86400000 : 365 * 86400000) / points;

  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.48) * price * 0.015;
    const open   = price;
    const close  = Math.max(0.0001, price + change);
    const high   = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low    = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = Math.floor(Math.random() * 50000 + 5000);
    const time   = new Date(now - (points - i) * msPerPoint);

    data.push({
      time:   time.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }),
      open:   parseFloat(open.toFixed(6)),
      high:   parseFloat(high.toFixed(6)),
      low:    parseFloat(low.toFixed(6)),
      close:  parseFloat(close.toFixed(6)),
      price:  parseFloat(close.toFixed(6)),
      volume,
    });
    price = close;
  }
  return data;
}

// ── Add technical indicators to data
function addIndicators(data, activeIndicators) {
  if (!data.length) return data;
  return data.map((d, i) => {
    const result = { ...d };
    // MA7
    if (activeIndicators.includes('MA7') && i >= 6) {
      result.ma7 = parseFloat((data.slice(i-6, i+1).reduce((s,x)=>s+(x.close||x.price||0),0)/7).toFixed(6));
    }
    // MA30
    if (activeIndicators.includes('MA30') && i >= 29) {
      result.ma30 = parseFloat((data.slice(i-29, i+1).reduce((s,x)=>s+(x.close||x.price||0),0)/30).toFixed(6));
    }
    // Bollinger Bands (20-period)
    if (activeIndicators.includes('Bollinger') && i >= 19) {
      const slice = data.slice(i-19, i+1).map(x=>x.close||x.price||0);
      const mean  = slice.reduce((s,v)=>s+v,0)/20;
      const std   = Math.sqrt(slice.reduce((s,v)=>s+Math.pow(v-mean,2),0)/20);
      result.bbUpper = parseFloat((mean + 2*std).toFixed(6));
      result.bbLower = parseFloat((mean - 2*std).toFixed(6));
      result.bbMid   = parseFloat(mean.toFixed(6));
    }
    return result;
  });
}

export default function TokenChartModal({ token, onClose }) {
  const [timeframe,   setTimeframe]   = useState('1M');
  const [chartType,   setChartType]   = useState('Area');
  const [indicators,  setIndicators]  = useState(['Volume']);
  const [chartData,   setChartData]   = useState([]);
  const [orderBook,   setOrderBook]   = useState({ bids:[], asks:[] });
  const [recentTrades,setRecentTrades] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('chart'); // 'chart' | 'orderbook' | 'trades'
  const [tokenInfo,   setTokenInfo]   = useState(null);

  const tf = TIMEFRAMES.find(t => t.label === timeframe) || TIMEFRAMES[2];

  const loadChartData = useCallback(async () => {
    if (!token?.symbol) return;
    setLoading(true);
    try {
      // Try to load real candles from API
      const res  = await fetch(`${API}/trading/candles/${token.symbol}`);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(d => ({
          time:   new Date(d.time).toLocaleDateString('en-GB', {day:'2-digit',month:'short'}),
          open:   parseFloat(d.open  || d.close || token.price || 1),
          high:   parseFloat(d.high  || token.price || 1),
          low:    parseFloat(d.low   || token.price || 1),
          close:  parseFloat(d.close || token.price || 1),
          price:  parseFloat(d.close || token.price || 1),
          volume: parseFloat(d.volume|| 0),
        }));
        setChartData(addIndicators(mapped, indicators));
      } else {
        // No real trades yet — generate illustrative mock data
        const mock = generateMockOHLCV(
          parseFloat(token.price || token.oracle_price || token.current_price_usd || 1),
          tf.days, tf.interval
        );
        setChartData(addIndicators(mock, indicators));
      }
    } catch {
      const mock = generateMockOHLCV(parseFloat(token.price || 1), tf.days, tf.interval);
      setChartData(addIndicators(mock, indicators));
    }
    setLoading(false);
  }, [token?.symbol, timeframe, indicators.join(',')]);

  const loadOrderBook = useCallback(async () => {
    if (!token?.symbol) return;
    try {
      const res  = await fetch(`${API}/trading/orderbook/${token.symbol}`);
      const data = await res.json();
      setOrderBook({ bids: data.bids||[], asks: data.asks||[] });
      setRecentTrades(data.recentTrades||[]);
    } catch {}
  }, [token?.symbol]);

  useEffect(() => { loadChartData(); }, [loadChartData]);
  useEffect(() => { loadOrderBook(); }, [loadOrderBook]);

  useEffect(() => {
    setChartData(prev => addIndicators(prev, indicators));
  }, [indicators]);

  const toggleIndicator = (ind) => {
    setIndicators(prev => prev.includes(ind) ? prev.filter(i=>i!==ind) : [...prev, ind]);
  };

  if (!token) return null;

  const price       = token.price || token.oracle_price || token.current_price_usd || 1;
  const priceNum    = parseFloat(price);
  const change      = token.change24h || token.change_24h || 0;
  const isPositive  = change >= 0;
  const lastClose   = chartData[chartData.length-1]?.close || priceNum;
  const firstClose  = chartData[0]?.close || priceNum;
  const chartChange = firstClose > 0 ? ((lastClose - firstClose)/firstClose*100).toFixed(2) : '0.00';
  const showVolume  = indicators.includes('Volume');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-6xl my-4 overflow-hidden">

        {/* ── Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white" style={{background:NAVY}}>
              {token.symbol?.[0] || '?'}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-black">{token.symbol}</h2>
                <span className="text-gray-400 text-sm">{token.name || token.company_name}</span>
                {token.asset_class || token.asset_type ? (
                  <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                    {token.asset_class || token.asset_type}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-2xl font-black font-mono">${priceNum.toFixed(4)}</span>
                <span className={`text-sm font-bold ${isPositive?'text-green-400':'text-red-400'}`}>
                  {isPositive?'▲':'▼'} {Math.abs(change).toFixed(2)}%
                </span>
                <span className="text-xs text-gray-500">24h change</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none p-1">✕</button>
        </div>

        {/* ── Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-800">
          {[
            ['Market Cap',    token.market_cap ? `$${parseFloat(token.market_cap).toLocaleString()}` : '—'],
            ['Total Supply',  token.total_supply ? parseInt(token.total_supply).toLocaleString() : '—'],
            ['Oracle Price',  token.oracle_price ? `$${parseFloat(token.oracle_price).toFixed(4)}` : '—'],
            ['Market State',  token.market_state || token.trading_mode || '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-950 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Tab nav */}
        <div className="flex border-b border-gray-800 px-5 pt-4 gap-1">
          {['chart','orderbook','trades'].map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize transition-all ${activeTab===t?'bg-gray-800 text-white':'text-gray-500 hover:text-gray-300'}`}>
              {t === 'orderbook' ? 'Order Book' : t === 'trades' ? 'Recent Trades' : 'Chart'}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ══ CHART TAB ══ */}
          {activeTab === 'chart' && (
            <div className="space-y-4">

              {/* Controls row */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Timeframe */}
                <div className="flex gap-1">
                  {TIMEFRAMES.map(t=>(
                    <button key={t.label} onClick={()=>setTimeframe(t.label)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe===t.label?'text-gray-900':'text-gray-400 hover:text-white bg-gray-800/50'}`}
                      style={timeframe===t.label?{background:GOLD}:{}}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Chart type */}
                <div className="flex gap-1">
                  {CHART_TYPES.map(ct=>(
                    <button key={ct} onClick={()=>setChartType(ct)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${chartType===ct?'bg-blue-700 text-white':'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {ct === 'Candle' ? '🕯' : ct === 'Area' ? '📈' : '〰️'} {ct}
                    </button>
                  ))}
                </div>

                {/* Indicators */}
                <div className="flex gap-1 flex-wrap">
                  {INDICATORS.map(ind=>(
                    <button key={ind} onClick={()=>toggleIndicator(ind)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${indicators.includes(ind)?'bg-purple-900/60 text-purple-300 border border-purple-700':'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period performance */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Period:</span>
                <span className={`font-bold ${parseFloat(chartChange)>=0?'text-green-400':'text-red-400'}`}>
                  {parseFloat(chartChange)>=0?'▲':'▼'} {Math.abs(parseFloat(chartChange))}%
                </span>
                <span className="text-gray-600 text-xs">({timeframe})</span>
                {chartData.length === 0 || (chartData[0]?.volume === 0 && chartData.every(d=>d.volume<1000)) ? null :
                  <span className="text-xs text-amber-500/70 ml-2">⚡ Illustrative — insufficient trade history</span>
                }
              </div>

              {/* Main chart */}
              {loading ? (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p className="text-2xl mb-2">⏳</p>
                    <p className="text-sm">Loading chart data…</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Price chart */}
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={chartData} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                      <XAxis dataKey="time" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} axisLine={false}
                        interval={Math.floor(chartData.length/8)}/>
                      <YAxis domain={['auto','auto']} tick={{fill:'#6b7280',fontSize:10}} tickLine={false} axisLine={false}
                        tickFormatter={v=>`$${parseFloat(v).toFixed(3)}`} width={70}/>
                      <Tooltip content={<ChartTooltip chartType={chartType}/>}/>

                      {/* Bollinger Bands */}
                      {indicators.includes('Bollinger') && <>
                        <Line type="monotone" dataKey="bbUpper" stroke="#7c3aed" strokeWidth={1} dot={false} strokeDasharray="4 2" name="BB Upper"/>
                        <Line type="monotone" dataKey="bbLower" stroke="#7c3aed" strokeWidth={1} dot={false} strokeDasharray="4 2" name="BB Lower"/>
                        <Line type="monotone" dataKey="bbMid"   stroke="#7c3aed" strokeWidth={1} dot={false} opacity={0.5} name="BB Mid"/>
                      </>}

                      {/* MA lines */}
                      {indicators.includes('MA7')  && <Line type="monotone" dataKey="ma7"  stroke="#eab308" strokeWidth={1.5} dot={false} name="MA7"/>}
                      {indicators.includes('MA30') && <Line type="monotone" dataKey="ma30" stroke="#a855f7" strokeWidth={1.5} dot={false} name="MA30"/>}

                      {/* Price series */}
                      {chartType === 'Area' && (
                        <>
                          <defs>
                            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={isPositive?GREEN:RED} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={isPositive?GREEN:RED} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="close" stroke={isPositive?GREEN:RED} fill="url(#priceGrad)" strokeWidth={2} dot={false} name="Price"/>
                        </>
                      )}
                      {chartType === 'Line' && (
                        <Line type="monotone" dataKey="close" stroke={isPositive?GREEN:RED} strokeWidth={2} dot={false} name="Price"/>
                      )}
                      {chartType === 'Candle' && (
                        <Bar dataKey="high" shape={<CandlestickBar/>} name="OHLC"/>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Volume chart */}
                  {showVolume && (
                    <ResponsiveContainer width="100%" height={80}>
                      <ComposedChart data={chartData} margin={{top:0,right:20,left:10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#111827" vertical={false}/>
                        <XAxis dataKey="time" hide/>
                        <YAxis tick={{fill:'#6b7280',fontSize:9}} tickLine={false} axisLine={false}
                          tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:v} width={70}/>
                        <Tooltip formatter={(v)=>[`$${parseInt(v).toLocaleString()}`, 'Volume']}
                          contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8,fontSize:11}}/>
                        <Bar dataKey="volume" fill="#1e40af" opacity={0.7} name="Volume"
                          radius={[2,2,0,0]}/>
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* RSI placeholder */}
              <div className="text-xs text-gray-700 text-right">
                RSI and MACD require 30+ trade days — available once sufficient trade history exists
              </div>
            </div>
          )}

          {/* ══ ORDER BOOK TAB ══ */}
          {activeTab === 'orderbook' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bids */}
              <div>
                <h3 className="font-semibold text-green-400 mb-3 text-sm">Bids (Buy Orders)</h3>
                {orderBook.bids.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-2xl mb-2">📭</p>
                    <p className="text-sm">No open buy orders</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2">Price</th>
                      <th className="text-right pb-2">Quantity</th>
                      <th className="text-right pb-2">Orders</th>
                      <th className="text-right pb-2">Total</th>
                    </tr></thead>
                    <tbody>
                      {orderBook.bids.map((b,i)=>(
                        <tr key={i} className="border-b border-gray-800/30 relative">
                          <td className="py-1.5 text-green-400 font-mono font-semibold">${parseFloat(b.price).toFixed(4)}</td>
                          <td className="py-1.5 text-right font-mono">{parseFloat(b.quantity).toFixed(2)}</td>
                          <td className="py-1.5 text-right text-gray-500">{b.orders}</td>
                          <td className="py-1.5 text-right text-gray-300">${(parseFloat(b.price)*parseFloat(b.quantity)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Asks */}
              <div>
                <h3 className="font-semibold text-red-400 mb-3 text-sm">Asks (Sell Orders)</h3>
                {orderBook.asks.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-2xl mb-2">📭</p>
                    <p className="text-sm">No open sell orders</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2">Price</th>
                      <th className="text-right pb-2">Quantity</th>
                      <th className="text-right pb-2">Orders</th>
                      <th className="text-right pb-2">Total</th>
                    </tr></thead>
                    <tbody>
                      {orderBook.asks.map((a,i)=>(
                        <tr key={i} className="border-b border-gray-800/30">
                          <td className="py-1.5 text-red-400 font-mono font-semibold">${parseFloat(a.price).toFixed(4)}</td>
                          <td className="py-1.5 text-right font-mono">{parseFloat(a.quantity).toFixed(2)}</td>
                          <td className="py-1.5 text-right text-gray-500">{a.orders}</td>
                          <td className="py-1.5 text-right text-gray-300">${(parseFloat(a.price)*parseFloat(a.quantity)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Spread */}
              {orderBook.bids.length > 0 && orderBook.asks.length > 0 && (
                <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                  <span className="text-gray-500 text-xs">Spread: </span>
                  <span className="font-mono font-bold text-yellow-400">
                    ${(parseFloat(orderBook.asks[0]?.price||0) - parseFloat(orderBook.bids[0]?.price||0)).toFixed(4)}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    ({((parseFloat(orderBook.asks[0]?.price||0) - parseFloat(orderBook.bids[0]?.price||0))/parseFloat(orderBook.asks[0]?.price||1)*100).toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══ RECENT TRADES TAB ══ */}
          {activeTab === 'trades' && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-gray-300">Recent Trades</h3>
              {recentTrades.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-3xl mb-3">📊</p>
                  <p className="font-semibold mb-1">No trades yet</p>
                  <p className="text-sm">This asset has not been traded on the secondary market yet.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
                    {['Time','Price','Quantity','Value'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {recentTrades.map((t,i)=>(
                      <tr key={i} className="border-b border-gray-800/30">
                        <td className="py-2 pr-4 text-gray-500 text-xs font-mono">
                          {new Date(t.matched_at||Date.now()).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                        </td>
                        <td className="py-2 pr-4 font-mono font-semibold text-white">${parseFloat(t.price||0).toFixed(4)}</td>
                        <td className="py-2 pr-4 font-mono">{parseFloat(t.quantity||0).toFixed(2)}</td>
                        <td className="py-2 text-yellow-400 font-mono">${parseFloat(t.total_usdc||t.total_value||0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
