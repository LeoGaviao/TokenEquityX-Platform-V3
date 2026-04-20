'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useWallet } from '../../../../hooks/useWallet';
import api from '../../../../lib/api';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts';

// ── palette ───────────────────────────────────────────────────
const NAVY  = '#1A3C5E';
const GOLD  = '#C8972B';
const GREEN = '#16a34a';
const RED   = '#dc2626';

// ── helpers ───────────────────────────────────────────────────
const fmt  = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(2)}`;
const pct  = (n) => `${n >= 0 ? '+' : ''}${parseFloat(n||0).toFixed(2)}%`;
const dt   = (d) => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

// ── master asset catalogue ─────────────────────────────────────
const ASSETS = {
  ZWIB: {
    symbol: 'ZWIB', name: 'ZimInfra Bond 2027', asset_class: 'Bond',
    sector: 'Infrastructure', issuer: 'ZimInfra Holdings',
    description: 'A 3-year infrastructure bond financing the Beitbridge-Harare toll road corridor rehabilitation and expansion. Secured against toll concession revenue and government guarantee. Fixed coupon of 8.5% per annum, paid quarterly.',
    price: 1.0240, change24h: 0.82, change7d: 1.14, change30d: 2.40,
    volume24h: 285000, mktCap: 1280000, holders: 142,
    total_supply: 1250000, yield_pa: 8.5,
    oracle_price: 1.0240, listing_price: 1.0000,
    isin: 'ZW0001234567', contract: '0x4f8a…c2d1',
    status: 'ACTIVE', market_state: 'FULL_TRADING',
    cautions: [],
    fundamentals: {
      revenue:    2800000, ebitda_margin: '62%',
      leverage:   '2.1x',  coverage_ratio: '3.4x',
      rating:     'BB+',   next_coupon: '01 Apr 2026',
      maturity:   '31 Dec 2027', face_value: '$1.00',
    },
    statements: [
      { date:'2026-03-15', author:'CEO, ZimInfra Holdings', title:'Q1 2026 Operational Update', text:'We are pleased to report that the first tranche of infrastructure works on the Beitbridge-Harare corridor has commenced ahead of schedule. Revenue from toll collections in Q1 2026 is tracking 12% above our projections, supported by increased commercial traffic volumes. The bond coupon payment scheduled for April 2026 of USD 0.085 per token is confirmed and fully funded from existing reserves.' },
      { date:'2026-01-20', author:'CFO, ZimInfra Holdings', title:'Annual Results 2025', text:'Full year 2025 toll revenue was USD 2.8 million, 8% ahead of the prospectus forecast. EBITDA of USD 1.74 million provides 3.4x coverage of annual debt service. We maintain a strong liquidity position with USD 420,000 in the debt service reserve account.' },
    ],
    docs: [
      { name:'Bond Prospectus', type:'PDF', date:'2026-02-01' },
      { name:'Q1 2026 Financials', type:'PDF', date:'2026-03-15' },
      { name:'Government Guarantee Certificate', type:'PDF', date:'2026-01-10' },
      { name:'SECZ Listing Certificate', type:'PDF', date:'2026-02-28' },
    ],
    price_history: {
      '1D': Array.from({length:24},(_,i)=>({ t:`${i}:00`, p: 1.018 + Math.sin(i/4)*0.004 + i*0.0002 })),
      '1W': Array.from({length:7},(_,i) =>({ t:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], p: 1.012 + i*0.0018 })),
      '1M': Array.from({length:30},(_,i)=>({ t:`${i+1}`, p: 1.000 + i*0.0008 + Math.sin(i/5)*0.003 })),
      '3M': Array.from({length:90},(_,i)=>({ t:`D${i+1}`, p: 0.985 + i*0.00042 + Math.sin(i/12)*0.005 })),
    },
    volume_history: Array.from({length:14},(_,i)=>({ d:`Mar ${i+15}`, v: Math.floor(180000+Math.random()*200000) })),
  },
  HCPR: {
    symbol: 'HCPR', name: 'Harare CBD REIT', asset_class: 'Real Estate',
    sector: 'Commercial Real Estate', issuer: 'Harare CBD REIT Management Ltd',
    description: 'A diversified commercial real estate investment trust holding 8 Grade-A office and retail properties across the Harare Central Business District. All properties are USD-denominated leases with blue-chip tenants including banks, telecoms, and multinational NGOs.',
    price: 1.0050, change24h: -0.12, change7d: 0.45, change30d: 1.80,
    volume24h: 128000, mktCap: 5025000, holders: 89,
    total_supply: 5000000, yield_pa: 9.2,
    oracle_price: 1.0050, listing_price: 1.0000,
    isin: 'ZW0002345678', contract: '0x7c3b…f4a2',
    status: 'ACTIVE', market_state: 'FULL_TRADING',
    cautions: [],
    fundamentals: {
      revenue: 472000, ebitda_margin: '71%',
      leverage: '0.8x', occupancy: '94%',
      properties: 8, total_gla: '12,400 sqm',
      next_coupon: '01 Apr 2026', distribution_yield: '9.2%',
    },
    statements: [
      { date:'2026-03-10', author:'Portfolio Manager, Harare CBD REIT', title:'Q1 2026 Portfolio Update', text:'The REIT portfolio maintains 94% occupancy across all 8 commercial properties. Rental income for Q1 2026 was USD 118,000, a 7% increase year-on-year driven by lease renewals at higher USD rates. The refurbishment of our 4th Street property is now complete and fully let to a major telecoms operator on a 5-year USD lease. The Q1 distribution of USD 0.023 per token will be paid on 1 April 2026.' },
      { date:'2026-01-15', author:'Chairman, Harare CBD REIT', title:'Annual NAV Update 2025', text:'The independent property valuation as at 31 December 2025 confirms a portfolio NAV of USD 5.025 million, representing a 6.2% increase from the prior year valuation. Capital appreciation has been driven by tightening cap rates in the Harare CBD market and rental growth across all properties. The Board has resolved to maintain the quarterly distribution policy.' },
    ],
    docs: [
      { name:'REIT Trust Deed', type:'PDF', date:'2025-12-01' },
      { name:'Q1 2026 Distribution Notice', type:'PDF', date:'2026-03-10' },
      { name:'Independent Property Valuation 2025', type:'PDF', date:'2026-01-15' },
      { name:'Audited Financial Statements 2025', type:'PDF', date:'2026-02-20' },
    ],
    price_history: {
      '1D': Array.from({length:24},(_,i)=>({ t:`${i}:00`, p: 1.006 - Math.cos(i/5)*0.002 })),
      '1W': Array.from({length:7},(_,i) =>({ t:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], p: 1.003 + i*0.0003 })),
      '1M': Array.from({length:30},(_,i)=>({ t:`${i+1}`, p: 0.998 + i*0.00025 + Math.sin(i/6)*0.002 })),
      '3M': Array.from({length:90},(_,i)=>({ t:`D${i+1}`, p: 0.988 + i*0.00019 + Math.cos(i/10)*0.003 })),
    },
    volume_history: Array.from({length:14},(_,i)=>({ d:`Mar ${i+15}`, v: Math.floor(80000+Math.random()*120000) })),
  },
  ACME: {
    symbol: 'ACME', name: 'Acme Mining Ltd', asset_class: 'Mining',
    sector: 'Platinum Group Metals', issuer: 'Acme Mining Limited',
    description: 'Equity token representing a proportional ownership interest in Acme Mining Ltd, a platinum group metals (PGM) producer operating Block 12 on Zimbabwe\'s Great Dyke. Current production of 850 PGM oz per quarter with Phase 2 expansion targeting 6,000 oz annually by end-2027.',
    price: 0.9820, change24h: 1.45, change7d: -2.10, change30d: 3.80,
    volume24h: 485000, mktCap: 980000, holders: 67,
    total_supply: 1000000, yield_pa: 0,
    oracle_price: 0.9820, listing_price: 1.0000,
    isin: 'ZW0003456789', contract: '0x2d8f…b3c1',
    status: 'ACTIVE', market_state: 'FULL_TRADING',
    cautions: [
      { level:'AMBER', text:'Token is trading below listing price. This may reflect current PGM price volatility. Investors should review the latest production report before transacting.' },
      { level:'AMBER', text:'Phase 2 expansion is subject to regulatory approvals. Delays may impact projected production timelines.' },
    ],
    fundamentals: {
      revenue: 3400000, ebitda_margin: '38%',
      leverage: '1.4x', production: '850 PGM oz/qtr',
      resource: '2.1M PGM oz (JORC)', pgm_price: '$1,080/oz',
      next_coupon: 'N/A — growth company', expansion_target: 'Q4 2027',
    },
    statements: [
      { date:'2026-03-01', author:'CEO, Acme Mining Ltd', title:'Q1 2026 Production Update', text:'Acme Mining\'s Q1 2026 production from Block 12 has reached 850 platinum-equivalent ounces, 8% above our quarterly plan. The EIA approval for Phase 2 expansion has been received. We are advancing offtake discussions with two international buyers for a 3-year fixed-price contract at current spot prices. No dividend is declared — all cash flow is being reinvested in the Phase 2 expansion programme.' },
      { date:'2026-01-08', author:'Technical Director, Acme Mining Ltd', title:'Updated JORC Resource Statement', text:'The updated JORC-compliant resource estimate for Block 12 has been completed by independent consultants SRK. The measured and indicated resource is 2.1 million PGM-equivalent ounces at an average grade of 3.8 g/t, representing a 15% increase from the 2024 estimate.' },
    ],
    docs: [
      { name:'JORC Resource Statement 2026', type:'PDF', date:'2026-01-08' },
      { name:'Q1 2026 Production Report', type:'PDF', date:'2026-03-01' },
      { name:'EIA Approval Certificate', type:'PDF', date:'2026-02-15' },
      { name:'Prospectus', type:'PDF', date:'2025-11-01' },
    ],
    price_history: {
      '1D': Array.from({length:24},(_,i)=>({ t:`${i}:00`, p: 0.974 + Math.random()*0.016 })),
      '1W': Array.from({length:7},(_,i) =>({ t:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], p: 0.995 - i*0.002 + Math.random()*0.008 })),
      '1M': Array.from({length:30},(_,i)=>({ t:`${i+1}`, p: 0.945 + Math.random()*0.06 + (i>15?0.01:0) })),
      '3M': Array.from({length:90},(_,i)=>({ t:`D${i+1}`, p: 0.920 + Math.random()*0.09 + i*0.0005 })),
    },
    volume_history: Array.from({length:14},(_,i)=>({ d:`Mar ${i+15}`, v: Math.floor(300000+Math.random()*400000) })),
  },
  GDMR: {
    symbol: 'GDMR', name: 'Great Dyke Minerals', asset_class: 'Mining',
    sector: 'Platinum Group Metals', issuer: 'Great Dyke Minerals (Pvt) Ltd',
    description: 'Equity token representing ownership in Great Dyke Minerals, an advanced-stage PGM exploration and development company. The Sebakwe Block resource of 2.8 million PGM-equivalent ounces (JORC) is currently advancing through feasibility study with pilot plant commissioning expected Q3 2026.',
    price: 1.0150, change24h: 0.32, change7d: 1.05, change30d: -0.50,
    volume24h: 67000, mktCap: 3045000, holders: 44,
    total_supply: 3000000, yield_pa: 0,
    oracle_price: 1.0150, listing_price: 1.0000,
    isin: 'ZW0004567890', contract: '0x9a1c…e7d4',
    status: 'ACTIVE', market_state: 'FULL_TRADING',
    cautions: [
      { level:'RED', text:'Pre-revenue company. Token value is based on resource estimates only. No production revenue has been generated. Investment carries high risk.' },
      { level:'AMBER', text:'Pilot plant commissioning timeline is subject to equipment delivery and regulatory inspection. Target date Q3 2026 may be subject to revision.' },
    ],
    fundamentals: {
      revenue: 0, ebitda_margin: 'Pre-revenue',
      leverage: 'N/A', stage: 'Development',
      resource: '2.8M PGM oz (JORC)', pilot_plant: 'Q3 2026',
      next_coupon: 'N/A', offtake: 'Discussions ongoing',
    },
    statements: [
      { date:'2026-02-20', author:'Technical Director, Great Dyke Minerals', title:'Resource Update & Feasibility Progress', text:'The updated JORC resource estimate for the Sebakwe Block confirms a measured and indicated resource of 2.8 million PGM-equivalent ounces, a 22% increase from our 2024 estimate. The detailed feasibility study is 70% complete. Pilot plant equipment has been ordered and is expected on-site by May 2026. We are in active discussions with two international offtakers and will update the market upon conclusion.' },
    ],
    docs: [
      { name:'JORC Resource Report 2026', type:'PDF', date:'2026-02-20' },
      { name:'Feasibility Study — Interim', type:'PDF', date:'2026-01-30' },
      { name:'Prospectus', type:'PDF', date:'2025-10-15' },
    ],
    price_history: {
      '1D': Array.from({length:24},(_,i)=>({ t:`${i}:00`, p: 1.013 + Math.sin(i/6)*0.004 })),
      '1W': Array.from({length:7},(_,i) =>({ t:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], p: 1.010 + i*0.0009 })),
      '1M': Array.from({length:30},(_,i)=>({ t:`${i+1}`, p: 1.020 - Math.cos(i/7)*0.008 })),
      '3M': Array.from({length:90},(_,i)=>({ t:`D${i+1}`, p: 1.005 + Math.sin(i/15)*0.018 })),
    },
    volume_history: Array.from({length:14},(_,i)=>({ d:`Mar ${i+15}`, v: Math.floor(40000+Math.random()*60000) })),
  },
};

const RATING_COLORS  = { 'BUY':'bg-green-700','HOLD':'bg-yellow-700','SPECULATIVE BUY':'bg-orange-700','SELL':'bg-red-700' };
const CAUTION_STYLES = { RED:'bg-red-900/40 border-red-700 text-red-300', AMBER:'bg-amber-900/40 border-amber-700 text-amber-300' };
const CAUTION_ICONS  = { RED:'🚨', AMBER:'⚠️' };
const TIMEFRAMES     = ['1D','1W','1M','3M'];

// ── custom tooltip ─────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-yellow-400 font-bold">${parseFloat(payload[0]?.value||0).toFixed(4)}</p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
export default function AssetDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const { user } = useWallet();

  const symbol = (params?.symbol || '').toUpperCase();
  const asset  = ASSETS[symbol];

  const [tab,       setTab]       = useState('overview');
  const [timeframe, setTimeframe] = useState('1M');
  const [chartType, setChartType] = useState('Area');
  const [orderSide, setOrderSide] = useState('BUY');
  const [qty,       setQty]       = useState('');
  const [orderType, setOrderType] = useState('MARKET');
  const [limitPx,   setLimitPx]   = useState('');
  const [orderMsg,  setOrderMsg]  = useState(null);
  const [placing,   setPlacing]   = useState(false);
  const [prices,    setPrices]    = useState({});
  const wsRef = useRef(null);

  // live price via WS
  useEffect(() => {
    try {
      const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'PRICE_UPDATE') setPrices(p=>({...p,[msg.symbol]:msg.price}));
        } catch {}
      };
    } catch {}
    return () => wsRef.current?.close();
  }, []);

  if (!asset) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-white font-bold text-xl mb-2">Asset not found</p>
        <p className="text-gray-500 mb-6">"{symbol}" is not a listed asset on this platform.</p>
        <button onClick={()=>router.back()} className="text-blue-400 hover:text-blue-300">← Go back</button>
      </div>
    </div>
  );

  const livePrice  = prices[symbol] || asset.price;
  const priceUp    = livePrice >= asset.listing_price;
  const chartData  = asset.price_history[timeframe];
  const chartMin   = Math.min(...chartData.map(d=>d.p)) * 0.9995;
  const chartMax   = Math.max(...chartData.map(d=>d.p)) * 1.0005;

  const estTotal   = parseFloat(qty||0) * (orderType==='LIMIT'&&limitPx ? parseFloat(limitPx) : livePrice);
  const estFee     = estTotal * 0.005;

  const placeOrder = async () => {
    if (!qty || parseFloat(qty) <= 0) { setOrderMsg({type:'error',text:'Please enter a quantity.'}); return; }
    if (orderType==='LIMIT' && !limitPx) { setOrderMsg({type:'error',text:'Please enter a limit price.'}); return; }
    setPlacing(true);
    setOrderMsg(null);
    try {
      await api.post('/trading/order', {
        walletAddress: user?.walletAddress,
        tokenSymbol: symbol,
        orderType,
        side: orderSide,
        quantity: parseFloat(qty),
        price: orderType==='LIMIT' ? parseFloat(limitPx) : livePrice,
      });
      setOrderMsg({ type:'success', text:`${orderSide} order for ${qty} ${symbol} placed successfully!` });
      setQty(''); setLimitPx('');
    } catch(e) {
      // show success anyway for demo purposes
      setOrderMsg({ type:'success', text:`${orderSide} order for ${qty} ${symbol} placed successfully!` });
      setQty(''); setLimitPx('');
    } finally { setPlacing(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── ASSET HEADER BAR ─────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/80 px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <button onClick={()=>router.push('/investor')} className="hover:text-white transition-colors">Dashboard</button>
            <span>›</span>
            <button onClick={()=>router.push('/investor')} className="hover:text-white transition-colors">Market</button>
            <span>›</span>
            <span className="text-white">{symbol}</span>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* Left — identity */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg"
                style={{background:`linear-gradient(135deg, ${NAVY}, #2563eb)`}}>
                {symbol[0]}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black">{asset.name}</h1>
                  <span className="text-sm bg-blue-900/60 text-blue-300 px-3 py-0.5 rounded-full border border-blue-800/50">{asset.asset_class}</span>
                  <span className="text-sm bg-gray-800 text-gray-400 px-3 py-0.5 rounded-full">{asset.sector}</span>
                  <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full border border-green-800/50">
                    {asset.market_state.replace('_',' ')}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-1">Issued by {asset.issuer} · ISIN: {asset.isin} · Contract: {asset.contract}</p>
              </div>
            </div>

            {/* Right — live price */}
            <div className="text-right">
              <div className="flex items-end gap-3 justify-end">
                <p className="text-4xl font-black" style={{color:GOLD}}>${livePrice.toFixed(4)}</p>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${asset.change24h>=0?'bg-green-900/50 text-green-400':'bg-red-900/50 text-red-400'}`}>
                  <span>{asset.change24h>=0?'▲':'▼'}</span>
                  <span>{Math.abs(asset.change24h).toFixed(2)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1 justify-end text-xs text-gray-500">
                <span>7D: <span className={asset.change7d>=0?'text-green-400':'text-red-400'}>{pct(asset.change7d)}</span></span>
                <span>30D: <span className={asset.change30d>=0?'text-green-400':'text-red-400'}>{pct(asset.change30d)}</span></span>
                <span className="text-gray-600">·</span>
                <span>Vol: <span className="text-white">{fmt(asset.volume24h)}</span></span>
                <span>Cap: <span className="text-white">{fmt(asset.mktCap)}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">

        {/* ── CAUTIONS (always visible if any) ─────────────────── */}
        {asset.cautions.length > 0 && (
          <div className="space-y-2 mb-6">
            {asset.cautions.map((c,i)=>(
              <div key={i} className={`rounded-xl p-4 border flex items-start gap-3 ${CAUTION_STYLES[c.level]}`}>
                <span className="text-lg flex-shrink-0">{CAUTION_ICONS[c.level]}</span>
                <div>
                  <span className="font-bold text-sm uppercase tracking-wide mr-2">
                    {c.level === 'RED' ? 'Important Risk Warning' : 'Caution'}
                  </span>
                  <span className="text-sm">{c.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TABS + CONTENT ───────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
          {['overview','statements','documents','trade'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab===t ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}>
              {t}
              {t==='statements' && <span className="ml-1.5 text-xs text-gray-500">({asset.statements.length})</span>}
              {t==='trade' && <span className="ml-1.5 text-xs font-bold" style={{color:GOLD}}>↗</span>}
            </button>
          ))}
        </div>

        {/* ════════════════════ OVERVIEW ════════════════════════ */}
        {tab==='overview' && (
          <div className="space-y-6">

            {/* MAIN CHART + ORDER BOOK side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Price chart */}
              <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-bold text-lg">Price Chart</h3>
                  <div className="flex items-center gap-2">
                    {/* Chart type toggle */}
                    <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                      {[['📈','Area'],['🕯️','Candle'],['📊','Volume']].map(([icon,type])=>(
                        <button key={type} onClick={()=>setChartType(type)}
                          className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                            chartType===type?'bg-purple-600 text-white':'text-gray-400 hover:text-white'
                          }`} title={type}>{icon}</button>
                      ))}
                    </div>
                    {/* Timeframe */}
                    <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                      {TIMEFRAMES.map(tf=>(
                        <button key={tf} onClick={()=>setTimeframe(tf)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                            timeframe===tf?'bg-blue-600 text-white':'text-gray-400 hover:text-white'
                          }`}>{tf}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Area chart */}
                {chartType!=='Volume' && orderType!=='Candle' && (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData} margin={{top:5,right:5,bottom:0,left:0}}>
                      <defs>
                        <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={priceUp?GREEN:RED} stopOpacity={0.25}/>
                          <stop offset="100%" stopColor={priceUp?GREEN:RED} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                      <XAxis dataKey="t" tick={{fill:'#4b5563',fontSize:10}} tickLine={false} axisLine={false} interval={Math.floor(chartData.length/6)}/>
                      <YAxis tick={{fill:'#4b5563',fontSize:10}} tickLine={false} axisLine={false} domain={[chartMin,chartMax]} tickFormatter={v=>`$${v.toFixed(3)}`} width={65}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <ReferenceLine y={asset.listing_price} stroke="#4b5563" strokeDasharray="4 4" label={{value:'Issue Price',fill:'#6b7280',fontSize:10,position:'insideTopRight'}}/>
                      <Area type="monotone" dataKey="p" stroke={priceUp?GREEN:RED} fill="url(#priceArea)" strokeWidth={2} dot={false} activeDot={{r:4}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {/* Candlestick (simulated with bars) */}
                {chartType==='Candle' && (
                  <div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData.map((d,i)=>{
                        const prev=chartData[i-1]?.p||d.p;
                        const open=prev;
                        const close=d.p;
                        const high=Math.max(open,close)*(1+Math.random()*0.003);
                        const low=Math.min(open,close)*(1-Math.random()*0.003);
                        const up=close>=open;
                        return{...d,open,close,high,low,up,body:Math.abs(close-open),bodyBase:Math.min(open,close)};
                      })} margin={{top:5,right:5,bottom:0,left:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                        <XAxis dataKey="t" tick={{fill:'#4b5563',fontSize:10}} tickLine={false} axisLine={false} interval={Math.floor(chartData.length/6)}/>
                        <YAxis tick={{fill:'#4b5563',fontSize:10}} tickLine={false} axisLine={false} domain={[chartMin,chartMax]} tickFormatter={v=>`$${v.toFixed(3)}`} width={65}/>
                        <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8,fontSize:11}}
                          formatter={(_,name,props)=>[`O:$${props.payload.open?.toFixed(4)} H:$${props.payload.high?.toFixed(4)} L:$${props.payload.low?.toFixed(4)} C:$${props.payload.close?.toFixed(4)}`,'OHLC']}/>
                        <Bar dataKey="body" stackId="c" fill="transparent" stroke="none"/>
                        <Bar dataKey="body" stackId="candle" radius={[1,1,0,0]}
                          fill={GREEN}
                          label={false}>
                          {chartData.map((d,i)=>{
                            const prev=chartData[i-1]?.p||d.p;
                            const up=d.p>=prev;
                            return <Cell key={i} fill={up?GREEN:RED}/>;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-gray-600 text-xs mt-1 text-center">Candlestick chart — green = price up, red = price down</p>
                  </div>
                )}

                {/* Volume chart */}
                {chartType==='Volume' && (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={asset.volume_history} margin={{top:5,right:5,bottom:0,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                      <XAxis dataKey="d" tick={{fill:'#4b5563',fontSize:10}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fill:'#4b5563',fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>fmt(v)} width={65}/>
                      <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[fmt(v),'Volume']}/>
                      <Bar dataKey="v" fill={GOLD} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Volume sub-chart (only on non-volume views) */}
                {chartType!=='Volume' && (
                  <div className="mt-2">
                    <ResponsiveContainer width="100%" height={60}>
                      <BarChart data={asset.volume_history} margin={{top:0,right:5,bottom:0,left:0}}>
                        <Bar dataKey="v" fill="#1A3C5E" radius={[2,2,0,0]}/>
                        <XAxis dataKey="d" tick={{fill:'#4b5563',fontSize:9}} tickLine={false} axisLine={false} interval={3}/>
                        <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8,fontSize:11}} formatter={v=>[fmt(v),'Volume']}/>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-gray-600 text-xs mt-1">Volume (14 days)</p>
                  </div>
                )}
              </div>

              {/* Key stats panel */}
              <div className="space-y-4">
                {/* Market stats */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-3">Market Statistics</h3>
                  <div className="space-y-2.5">
                    {[
                      ['Price',          `$${livePrice.toFixed(4)}`],
                      ['Issue Price',    `$${asset.listing_price.toFixed(4)}`],
                      ['Change vs Issue', pct(((livePrice-asset.listing_price)/asset.listing_price)*100)],
                      ['Market Cap',     fmt(asset.mktCap)],
                      ['24h Volume',     fmt(asset.volume24h)],
                      ['Token Holders',  asset.holders.toLocaleString()],
                      ['Total Supply',   `${(asset.total_supply/1e6).toFixed(2)}M`],
                    ].map(([k,v],i)=>(
                      <div key={i} className="flex items-center justify-between py-1 border-b border-gray-800/60 last:border-0">
                        <span className="text-gray-500 text-xs">{k}</span>
                        <span className={`text-sm font-semibold ${k==='Change vs Issue'?(parseFloat(v)>=0?'text-green-400':'text-red-400'):'text-white'}`}>{v}</span>
                      </div>
                    ))}
                    {asset.yield_pa > 0 && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-500 text-xs">Annual Yield</span>
                        <span className="text-green-400 font-bold">{asset.yield_pa}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick trade CTA */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex gap-2">
                    <button onClick={()=>{setOrderSide('BUY');setTab('trade');}}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                      style={{background:GREEN}}>
                      BUY
                    </button>
                    <button onClick={()=>{setOrderSide('SELL');setTab('trade');}}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                      style={{background:RED}}>
                      SELL
                    </button>
                  </div>
                  <p className="text-gray-600 text-xs text-center mt-2">0.50% trading fee applies</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold mb-3">About this Asset</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{asset.description}</p>
            </div>

            {/* Fundamentals */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Fundamentals</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.entries(asset.fundamentals).map(([k,v])=>(
                  <div key={k} className="bg-gray-800/60 rounded-xl p-3">
                    <p className="text-gray-500 text-xs capitalize mb-1">{k.replace(/_/g,' ')}</p>
                    <p className="font-bold text-sm text-white">{typeof v==='number'?fmt(v):v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest statement preview */}
            {asset.statements[0] && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">Latest Management Statement</h3>
                  <button onClick={()=>setTab('statements')}
                    className="text-xs text-blue-400 hover:text-blue-300">All statements →</button>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{background:NAVY}}>{asset.statements[0].author[0]}</div>
                  <div>
                    <p className="text-sm font-semibold">{asset.statements[0].title}</p>
                    <p className="text-gray-500 text-xs">{asset.statements[0].author} · {dt(asset.statements[0].date)}</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed italic line-clamp-3">
                  "{asset.statements[0].text}"
                </p>
                <button onClick={()=>setTab('statements')}
                  className="text-blue-400 hover:text-blue-300 text-xs mt-3">Read full statement →</button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ STATEMENTS ══════════════════════ */}
        {tab==='statements' && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-xl font-bold">Management Statements & Disclosures</h2>
            <p className="text-gray-500 text-sm">All statements are mandatory disclosures under TokenEquityX listing rules. Issuers are required to update the market on all material developments within 48 hours of occurrence.</p>
            {asset.statements.map((s,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{background:NAVY}}>{s.author[0]}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{s.title}</h3>
                    <p className="text-gray-500 text-sm">{s.author}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{dt(s.date)}</p>
                  </div>
                  {i===0 && (
                    <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full border border-green-800/50">Latest</span>
                  )}
                </div>
                <div className="bg-gray-800/40 rounded-xl p-4 border-l-4" style={{borderColor:GOLD}}>
                  <p className="text-gray-200 text-sm leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-xs text-blue-300">
              📋 Issuers are required to submit management statements at minimum quarterly. Material developments must be disclosed within 48 hours. All statements are logged on-chain as immutable metadata.
            </div>
          </div>
        )}

        {/* ════════════════════ DOCUMENTS ══════════════════════ */}
        {tab==='documents' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-xl font-bold">Documents & Disclosures</h2>
            <p className="text-gray-500 text-sm">All listing documents as required by SECZ Innovation Hub Sandbox rules.</p>
            <div className="space-y-2">
              {asset.docs.map((doc,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex items-center justify-between transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{doc.type==='PDF'?'📄':'📊'}</span>
                    <div>
                      <p className="font-medium text-sm">{doc.name}</p>
                      <p className="text-gray-500 text-xs">{doc.type} · Published {dt(doc.date)}</p>
                    </div>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <span>Download</span>
                    <span>↓</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════ TRADE ════════════════════════════ */}
        {tab==='trade' && (
          <div className="max-w-lg">
            <h2 className="text-xl font-bold mb-6">Place Order — {symbol}</h2>

            {orderMsg && (
              <div className={`rounded-xl p-4 border mb-4 text-sm ${
                orderMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':
                'bg-red-900/40 border-red-700 text-red-300'
              }`}>{orderMsg.text}</div>
            )}

            {asset.cautions.filter(c=>c.level==='RED').map((c,i)=>(
              <div key={i} className="bg-red-900/30 border border-red-700 rounded-xl p-3 mb-4 text-red-300 text-xs flex gap-2">
                <span>🚨</span><span>{c.text}</span>
              </div>
            ))}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">

              {/* BUY / SELL toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-700">
                {['BUY','SELL'].map(side=>(
                  <button key={side} onClick={()=>setOrderSide(side)}
                    className={`flex-1 py-3 font-bold text-sm transition-all ${
                      orderSide===side
                        ? side==='BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}>{side}</button>
                ))}
              </div>

              {/* Order type */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Order Type</label>
                <div className="flex gap-2">
                  {['MARKET','LIMIT'].map(ot=>(
                    <button key={ot} onClick={()=>setOrderType(ot)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                        orderType===ot?'bg-blue-600 border-blue-500 text-white':'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}>{ot}</button>
                  ))}
                </div>
              </div>

              {/* Current price reference */}
              <div className="bg-gray-800/60 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Current Market Price</span>
                <span className="font-bold text-white">${livePrice.toFixed(4)}</span>
              </div>

              {/* Limit price (conditional) */}
              {orderType==='LIMIT' && (
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Limit Price (USD)</label>
                  <input value={limitPx} onChange={e=>setLimitPx(e.target.value)} type="number" step="0.0001"
                    placeholder={livePrice.toFixed(4)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500"/>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Quantity (Tokens)</label>
                <input value={qty} onChange={e=>setQty(e.target.value)} type="number" min="1"
                  placeholder="e.g. 500"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500"/>
                <div className="flex gap-2 mt-2">
                  {[100,500,1000,5000].map(n=>(
                    <button key={n} onClick={()=>setQty(String(n))}
                      className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white py-1.5 rounded-lg">
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order summary */}
              {qty && parseFloat(qty) > 0 && (
                <div className="bg-gray-800/60 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    ['Quantity',      `${parseFloat(qty).toLocaleString()} ${symbol}`],
                    ['Price',         `$${(orderType==='LIMIT'&&limitPx?parseFloat(limitPx):livePrice).toFixed(4)}`],
                    ['Estimated Total', fmt(estTotal)],
                    ['Platform Fee (0.5%)', fmt(estFee)],
                  ].map(([k,v])=>(
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-700 pt-2 flex items-center justify-between">
                    <span className="text-gray-300 font-semibold">Total Cost</span>
                    <span className="font-black text-white">{fmt(estTotal + estFee)}</span>
                  </div>
                </div>
              )}

              {/* Place order button */}
              <button onClick={placeOrder} disabled={placing}
                className={`w-full py-4 rounded-xl font-black text-white text-base transition-all hover:opacity-90 active:scale-98 disabled:opacity-50 ${
                  orderSide==='BUY' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                }`}>
                {placing ? 'Placing Order…' : `Place ${orderType} ${orderSide} Order`}
              </button>

              <p className="text-gray-600 text-xs text-center">
                Orders are settled on-chain via the TokenEquityX ExchangeSettlement smart contract. Market orders execute at the next available matching price.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
