'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const NAVY = '#1A3C5E';
const GOLD = '#C8972B';

const fmt = n => {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
};

const TABS = [
  { key: 'overview',      label: '📊 Overview' },
  { key: 'charts',        label: '📈 Price & Volume' },
  { key: 'fundamentals',  label: '🏦 Fundamentals' },
  { key: 'documents',     label: '📎 Documents' },
  { key: 'governance',    label: '🗳️ Board & Governance' },
];

export default function AssetDetailPage() {
  const router  = useRouter();
  const params  = useParams();
  const symbol  = params?.symbol?.toUpperCase();

  const [token,       setToken]       = useState(null);
  const [proposals,   setProposals]   = useState([]);
  const [trades,      setTrades]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('1M');

  useEffect(() => {
    if (!symbol) return;
    const tok = localStorage.getItem('token');
    const hdrs = { Authorization: `Bearer ${tok}` };

    Promise.allSettled([
      fetch(`${API}/assets`, { headers: hdrs }).then(r => r.json()),
      fetch(`${API}/governance/proposals`, { headers: hdrs }).then(r => r.json()),
      fetch(`${API}/trading/history/${symbol}?limit=50`, { headers: hdrs }).then(r => r.json()),
    ]).then(([assetRes, propRes, tradeRes]) => {
      if (assetRes.status === 'fulfilled') {
        const assets = Array.isArray(assetRes.value) ? assetRes.value : [];
        const found  = assets.find(a => (a.token_symbol || a.symbol || '').toUpperCase() === symbol);
        setToken(found || null);
      }
      if (propRes.status === 'fulfilled') {
        const props = Array.isArray(propRes.value) ? propRes.value : [];
        setProposals(props.filter(p => p.token_symbol === symbol));
      }
      if (tradeRes.status === 'fulfilled') {
        setTrades(Array.isArray(tradeRes.value) ? tradeRes.value : []);
      }
    }).finally(() => setLoading(false));
  }, [symbol]);

  // Build price chart from trade history
  const priceChart = trades.length > 0
    ? trades.slice().reverse().map((t) => ({
        t: new Date(t.settled_at || t.created_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short'}),
        p: parseFloat(t.price || 0),
        v: parseFloat(t.quantity || 0),
      }))
    : Array.from({length: 30}, (_, i) => ({
        t: `Day ${i+1}`,
        p: parseFloat(token?.current_price_usd || 1) * (0.97 + Math.random() * 0.06),
        v: Math.floor(Math.random() * 50000),
      }));

  const volumeChart = priceChart.slice(-14);

  if (loading) return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
      <p className="text-gray-400">Loading {symbol}...</p>
    </div>
  );

  if (!token) return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center flex-col gap-4">
      <p className="text-gray-400 text-lg">Asset {symbol} not found</p>
      <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 text-sm">← Go back</button>
    </div>
  );

  const price    = parseFloat(token.current_price_usd || token.oracle_price || 0);
  const mktCap   = parseFloat(token.market_cap || 0);
  const isP2P    = token.market_state === 'P2P_ONLY' || token.trading_mode === 'P2P_ONLY';
  const isBourse = token.market_state === 'FULL_TRADING';

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0"
              style={{ background: isBourse ? NAVY : isP2P ? '#4B1D8E' : '#374151' }}>
              {symbol[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xl">{symbol}</h1>
                <span className="text-gray-400 text-sm">{token.token_name || token.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  isBourse ? 'border-blue-700/50 text-blue-300 bg-blue-900/20' :
                  isP2P    ? 'border-purple-700/50 text-purple-300 bg-purple-900/20' :
                  'border-gray-700 text-gray-400'
                }`}>{isBourse ? 'Bourse' : isP2P ? 'P2P' : 'Pre-listing'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-400">{token.asset_type}</span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">{token.company_name} · {token.sector} · {token.jurisdiction}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-yellow-400">${price.toFixed(4)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Oracle Price</p>
          </div>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="border-b border-gray-800 bg-gray-900/40 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-8 overflow-x-auto text-sm">
          {[
            ['Market Cap',   mktCap >= 1e6 ? `$${(mktCap/1e6).toFixed(2)}M` : mktCap >= 1e3 ? `$${(mktCap/1e3).toFixed(1)}K` : '$0'],
            ['Total Supply', parseInt(token.issued_shares || token.authorised_shares || 0).toLocaleString()],
            ['Asset Type',   token.asset_type || '—'],
            ['Market State', token.market_state || '—'],
            ['Jurisdiction', token.jurisdiction || '—'],
            ['Sector',       token.sector || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex-shrink-0">
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === t.key ? 'border-yellow-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-base mb-3">About {token.company_name}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {token.description || 'No company description available.'}
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-base mb-3">Key Information</h3>
                <div className="space-y-2">
                  {[
                    ['Token Symbol',  symbol],
                    ['Token Name',    token.token_name || token.name || '—'],
                    ['Company',       token.company_name || '—'],
                    ['Asset Type',    token.asset_type || '—'],
                    ['Sector',        token.sector || '—'],
                    ['Jurisdiction',  token.jurisdiction || '—'],
                    ['Market State',  token.market_state || '—'],
                    ['Trading Mode',  token.trading_mode || '—'],
                    ['Total Supply',  parseInt(token.issued_shares || 0).toLocaleString() + ' tokens'],
                    ['Oracle Price',  `$${price.toFixed(4)}`],
                    ['Market Cap',    fmt(mktCap)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-gray-400 text-sm">{label}</span>
                      <span className="text-white text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Mini price chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-3">30-Day Price</p>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={priceChart.slice(-30)}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="p" stroke={GOLD} fill="url(#priceGrad)" strokeWidth={2} dot={false}/>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[`$${parseFloat(v).toFixed(4)}`,'Price']}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Trade action */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-sm font-semibold mb-3">Trade {symbol}</p>
                {isBourse ? (
                  <button onClick={() => router.push('/investor/trade')}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{background: NAVY}}>
                    📈 Go to Order Book
                  </button>
                ) : isP2P ? (
                  <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3">
                    This token trades via peer-to-peer transfer only. Contact an existing holder or the issuer to arrange a transfer.
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3">
                    This token is not yet listed for trading.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CHARTS TAB */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Price History</h3>
                <div className="flex gap-1">
                  {['1M','3M','ALL'].map(p => (
                    <button key={p} onClick={() => setChartPeriod(p)}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                        chartPeriod === p ? 'border-yellow-600 text-yellow-400' : 'border-gray-700 text-gray-500 hover:text-white'
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
              {trades.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-3xl mb-3">📊</p>
                  <p>No trade history yet for {symbol}</p>
                  <p className="text-xs mt-1">Price chart will populate once trading begins</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={priceChart}>
                    <defs>
                      <linearGradient id="priceGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                    <XAxis dataKey="t" tick={{fill:'#6b7280',fontSize:10}} tickLine={false}/>
                    <YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} domain={['auto','auto']} tickFormatter={v=>`$${v.toFixed(4)}`}/>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[`$${parseFloat(v).toFixed(4)}`,'Price']}/>
                    <Area type="monotone" dataKey="p" stroke={GOLD} fill="url(#priceGrad2)" strokeWidth={2} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-bold mb-4">Volume History</h3>
              {trades.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No volume data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={volumeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                    <XAxis dataKey="t" tick={{fill:'#6b7280',fontSize:10}} tickLine={false}/>
                    <YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>v>=1e3?`${(v/1e3).toFixed(0)}K`:v}/>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[v.toLocaleString(),'Volume']}/>
                    <Bar dataKey="v" fill={NAVY} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* FUNDAMENTALS TAB */}
        {activeTab === 'fundamentals' && (
          <div className="space-y-5">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">Token Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  ['Oracle Price',  `$${price.toFixed(4)}`],
                  ['Market Cap',    fmt(mktCap)],
                  ['Total Supply',  parseInt(token.issued_shares || 0).toLocaleString()],
                  ['Asset Type',    token.asset_type || '—'],
                  ['Market State',  token.market_state || '—'],
                  ['Jurisdiction',  token.jurisdiction || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="font-semibold text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-2xl p-5">
              <p className="text-blue-300 text-xs font-semibold mb-2">ℹ️ Auditor Certification</p>
              <p className="text-gray-400 text-sm">Detailed financial fundamentals are available in the submission audit report. Ask the issuer for a copy of the certified valuation report.</p>
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="font-bold text-base mb-4">Regulatory & Issuer Documents</h3>
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-4 text-xs text-blue-300">
              ℹ️ Documents are uploaded by the issuer during the submission process. Contact the issuer directly for the latest versions.
            </div>
            <div className="text-center py-8 text-gray-500">
              <p className="text-3xl mb-3">📎</p>
              <p className="text-sm">Document downloads are available on the <button onClick={()=>router.push('/investor')} className="text-blue-400 hover:text-blue-300">primary offering pitch page</button>.</p>
            </div>
          </div>
        )}

        {/* GOVERNANCE TAB */}
        {activeTab === 'governance' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">Board & Governance</h3>
              {proposals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-3xl mb-3">🗳️</p>
                  <p className="text-sm">No governance proposals for {symbol} yet.</p>
                  <p className="text-xs mt-1 text-gray-600">Board announcements and shareholder votes will appear here.</p>
                </div>
              ) : proposals.map(p => {
                const total  = Number(p.votes_for) + Number(p.votes_against) + Number(p.votes_abstain);
                const forPct = total > 0 ? Math.round((p.votes_for/total)*100) : 0;
                const days   = Math.max(0, Math.ceil((new Date(p.end_time) - new Date()) / 86400000));
                return (
                  <div key={p.id} className="border border-gray-800 rounded-xl p-4 mb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='ACTIVE'?'bg-green-900/50 text-green-300':'bg-gray-800 text-gray-500'}`}>{p.status}</span>
                        <h4 className="font-semibold mt-1">{p.title}</h4>
                        {p.description && <p className="text-gray-400 text-sm mt-1">{p.description}</p>}
                      </div>
                      <div className="text-right text-xs text-gray-500 ml-4 flex-shrink-0">
                        <p className="font-semibold text-white">{days}d left</p>
                        <p>{total} votes</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-2 bg-green-500 rounded-full" style={{width:`${forPct}%`}}/>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{forPct}% in favour</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">Industry & Market Updates</h3>
              <div className="text-center py-6 text-gray-500">
                <p className="text-3xl mb-3">📰</p>
                <p className="text-sm">Market news and industry updates for {token.sector} sector.</p>
                <p className="text-xs mt-1 text-gray-600">News integration coming in the next release.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
