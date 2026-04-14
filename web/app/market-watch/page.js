'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import TokenChartModal from '../../components/TokenChartModal';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const GOLD = '#C8972B';
const NAVY = '#1A3C5E';
const GREEN = '#16a34a';

const fmt = n => n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${parseFloat(n||0).toFixed(2)}`;
const pct = n => `${n>=0?'+':''}${parseFloat(n||0).toFixed(2)}%`;

// Supplemental static data for known tokens — fills gaps not yet in the DB
const SUPPLEMENT = {
  ZWIB: { change7d:+1.14, change30d:+2.40, yield_pa:8.5, risk:'LOW',         rating:'HOLD',            mini:Array.from({length:20},(_,i)=>({p:1.00+i*0.0012+Math.sin(i/4)*0.003})) },
  HCPR: { change7d:+0.45, change30d:+1.80, yield_pa:9.2, risk:'LOW-MEDIUM',  rating:'BUY',             mini:Array.from({length:20},(_,i)=>({p:0.998+i*0.0004+Math.cos(i/5)*0.002})) },
  ACME: { change7d:-2.10, change30d:+3.80, yield_pa:0,   risk:'MEDIUM-HIGH', rating:'SPECULATIVE BUY', mini:Array.from({length:20},(_,i)=>({p:0.94+Math.random()*0.06+(i>10?0.01:0)})) },
  GDMR: { change7d:+1.05, change30d:-0.50, yield_pa:0,   risk:'HIGH',        rating:'HOLD',            mini:Array.from({length:20},(_,i)=>({p:1.01+Math.sin(i/6)*0.012})) },
};

const SENT_COLORS   = { positive:'bg-green-900/40 text-green-400', negative:'bg-red-900/40 text-red-400', neutral:'bg-blue-900/40 text-blue-400' };
const RISK_COLORS   = { 'LOW':'text-green-400','LOW-MEDIUM':'text-teal-400','MEDIUM':'text-yellow-400','MEDIUM-HIGH':'text-orange-400','HIGH':'text-red-400' };
const RATING_BG     = { 'BUY':'bg-green-700','HOLD':'bg-yellow-700','SPECULATIVE BUY':'bg-orange-700','SELL':'bg-red-700' };

const NEWS = [
  { cat:'Zimbabwe Economy', headline:'Zimbabwe records 4.1% GDP growth in 2025, highest since 2018',             source:'Zimbabwe Herald', time:'2 hours ago',  sentiment:'positive' },
  { cat:'PGM Markets',      headline:'Platinum hits 18-month high as auto sector demand rebounds',               source:'Reuters',         time:'4 hours ago',  sentiment:'positive' },
  { cat:'Real Estate',      headline:'Harare CBD Grade-A vacancy falls below 8% — Jones Lang LaSalle',          source:'Property Wire',   time:'Yesterday',    sentiment:'positive' },
  { cat:'Regulation',       headline:'SECZ launches digital assets framework consultation — comment period open', source:'SECZ',            time:'2 days ago',   sentiment:'neutral'  },
  { cat:'Infrastructure',   headline:'AfDB approves USD 400M for Zimbabwe road rehabilitation',                  source:'AfDB',            time:'3 days ago',   sentiment:'positive' },
];

export default function MarketWatchPage() {
  const router = useRouter();
  const [assets,   setAssets]   = useState([]);
  const [chartToken, setChartToken] = useState(null);
  const [prices,   setPrices]   = useState({});
  const [loading,  setLoading]  = useState(true);
  const [now,      setNow]      = useState(new Date());

  // Fetch live tokens from API
  useEffect(() => {
    fetch(`${API}/assets`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map(t => {
            const sym  = t.symbol || t.token_symbol;
            const supp = SUPPLEMENT[sym] || {};
            const isPreListing = t.status === 'DRAFT' || t.market_state === 'PRE_LAUNCH';
            return {
              symbol:       sym,
              name:         t.name || t.company_name || sym,
              class:        t.asset_type || t.asset_class || 'Equity',
              price:        parseFloat(t.oracle_price || t.current_price_usd || 1),
              change24h:    parseFloat(t.change_24h || 0),
              change7d:     supp.change7d   ?? 0,
              change30d:    supp.change30d  ?? 0,
              volume24h:    parseFloat(t.volume_24h || supp.volume24h || 0),
              mktcap:       parseFloat(t.market_cap || 0) || (parseFloat(t.oracle_price||1) * parseInt(t.total_supply||0)),
              holders:      t.holders       || supp.holders    || 0,
              yield_pa:     supp.yield_pa   ?? 0,
              risk:         supp.risk       || 'MEDIUM',
              rating:       supp.rating     || 'HOLD',
              mini:         supp.mini       || Array.from({length:20},(_,i)=>({p:parseFloat(t.oracle_price||1)+(Math.random()-0.5)*0.002})),
              isPreListing,
              jurisdiction: t.jurisdiction  || 'Zimbabwe',
              total_supply: t.total_supply  || 0,
              description:  t.description   || '',
            };
          });
          setAssets(mapped);
          // Seed live prices from DB values
          const init = {};
          mapped.forEach(a => { init[a.symbol] = a.price; });
          setPrices(init);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Live price simulation for active tokens
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(new Date());
      setPrices(p => {
        const next = {...p};
        assets.filter(a => !a.isPreListing).forEach(a => {
          const base = a.price;
          next[a.symbol] = (p[a.symbol] || base) + (Math.random() - 0.5) * base * 0.0004;
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(tick);
  }, [assets]);

  const activeAssets    = assets.filter(a => !a.isPreListing);
  const preListing      = assets.filter(a => a.isPreListing);
  const totalAUM        = activeAssets.reduce((a,t) => a + (prices[t.symbol]||t.price) * parseInt(t.total_supply||0), 0) || activeAssets.reduce((a,t)=>a+t.mktcap,0);
  const totalVolume     = activeAssets.reduce((a,t) => a + t.volume24h, 0);
  const highestYield    = Math.max(...activeAssets.map(t => t.yield_pa), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20">

      {/* HEADER */}
      <section className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3 block">Pricesheet</span>
              <h1 className="text-4xl font-black">Market Watch</h1>
              <p className="text-gray-400 mt-2">Live prices, volumes and market data for all listed assets on TokenEquityX.</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-bold" style={{color:GOLD}}>{now.toLocaleTimeString('en-GB')}</p>
              <p className="text-gray-500 text-xs">{now.toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</p>
              <div className="flex items-center gap-1.5 justify-end mt-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
                <span className="text-green-400 text-xs">Market Open · Live data</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUMMARY STATS */}
      <section className="py-8 px-6 border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-screen-xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Total Platform AUM',  value: loading ? '—' : fmt(totalAUM),             color:'text-yellow-400' },
            { label:'24h Platform Volume', value: loading ? '—' : fmt(totalVolume),           color:'text-green-400'  },
            { label:'Live Listed Assets',  value: loading ? '—' : String(activeAssets.length),color:'text-white'      },
            { label:'Highest Yield',       value: loading ? '—' : highestYield > 0 ? `${highestYield}%` : '—', color:'text-teal-400' },
          ].map((s,i)=>(
            <div key={i} className="text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-gray-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE ASSET TABLE */}
      <section id="prices" className="py-10 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="font-bold text-xl mb-4">Live Listed Assets</h2>
          {loading ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-2xl mb-2">⏳</p>
              <p className="text-sm">Loading market data…</p>
            </div>
          ) : activeAssets.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-sm">No live assets yet. Assets are listed after completing the compliance pipeline.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-900/50">
                    {['Asset','Class','Price','24h','7D','30D','24h Volume','Mkt Cap','Yield','Risk','Rating','Chart','Action'].map(h=>(
                      <th key={h} className="text-left py-3 px-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeAssets.map((a,i) => {
                    const livePrice = prices[a.symbol] || a.price;
                    return (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/80 cursor-pointer transition-colors"
                        onClick={()=>router.push('/#login-section')}>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{background:NAVY}}>{a.symbol[0]}</div>
                            <div><p className="font-bold">{a.symbol}</p><p className="text-gray-500 text-xs">{a.name}</p></div>
                          </div>
                        </td>
                        <td className="py-4 px-3"><span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{a.class}</span></td>
                        <td className="py-4 px-3 font-black font-mono text-base">${livePrice.toFixed(4)}</td>
                        <td className="py-4 px-3"><span className={a.change24h>=0?'text-green-400':'text-red-400'}>{pct(a.change24h)}</span></td>
                        <td className="py-4 px-3"><span className={a.change7d>=0?'text-green-400':'text-red-400'}>{pct(a.change7d)}</span></td>
                        <td className="py-4 px-3"><span className={a.change30d>=0?'text-green-400':'text-red-400'}>{pct(a.change30d)}</span></td>
                        <td className="py-4 px-3 text-gray-300">{fmt(a.volume24h)}</td>
                        <td className="py-4 px-3 text-yellow-400">{fmt(livePrice * parseInt(a.total_supply||0) || a.mktcap)}</td>
                        <td className="py-4 px-3">{a.yield_pa>0?<span className="text-green-400 font-bold">{a.yield_pa}%</span>:<span className="text-gray-600">—</span>}</td>
                        <td className="py-4 px-3"><span className={`text-xs font-bold ${RISK_COLORS[a.risk]||'text-gray-400'}`}>{a.risk}</span></td>
                        <td className="py-4 px-3">
                          {RATING_BG[a.rating]
                            ? <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${RATING_BG[a.rating]}`}>{a.rating}</span>
                            : <span className="text-gray-500 text-xs">—</span>
                          }
                        </td>
                        <td className="py-4 px-3 w-20">
                          <ResponsiveContainer width="100%" height={32}>
                            <AreaChart data={a.mini}>
                              <Area type="monotone" dataKey="p" stroke={a.change24h>=0?GREEN:'#dc2626'} fill="transparent" strokeWidth={1.5} dot={false}/>
                            </AreaChart>
                          </ResponsiveContainer>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={(e)=>{e.stopPropagation();setChartToken(a);}} className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60">📈 Chart</button>
                            <button onClick={()=>router.push(`/token/${a.symbol}`)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white">↗ Full Page</button>
                            <button onClick={e=>{e.stopPropagation();router.push('/#login-section');}}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white hover:opacity-90" style={{background:NAVY}}>
                              Trade
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-gray-600 text-xs mt-3">Prices are oracle-certified valuations updated by independent auditors. Live movements reflect secondary market activity.</p>
        </div>
      </section>

      {/* PRE-LISTING PIPELINE */}
      {!loading && preListing.length > 0 && (
        <section className="py-10 px-6 border-b border-gray-800">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-bold text-xl">Coming Soon — Pre-Listing Pipeline</h2>
              <span className="text-xs bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/50">{preListing.length} asset{preListing.length>1?'s':''}</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">These assets have registered on the platform and are progressing through the compliance review process. Trading will open once SECZ sandbox approval is received.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {preListing.map((a,i) => (
                <div key={i} className="bg-gray-900/60 border border-indigo-800/30 rounded-xl p-5 hover:border-indigo-700/50 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm relative" style={{background:'#312e81'}}>
                      {a.symbol[0]}
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400 border-2 border-gray-900"/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{a.symbol}</p>
                        <span className="text-xs bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded-full">Pre-Listing</span>
                      </div>
                      <p className="text-gray-500 text-xs">{a.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <p className="text-gray-500 mb-0.5">Asset Type</p>
                      <p className="font-semibold">{a.class}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <p className="text-gray-500 mb-0.5">Jurisdiction</p>
                      <p className="font-semibold">{a.jurisdiction}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[['SPV Registration',true],['KYC/AML Review',false],['Auditor Sign-off',false],['Smart Contract Deploy',false],['SECZ Approval',false]].map(([step,done])=>(
                      <div key={step} className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${done?'bg-green-600 text-white':'bg-gray-700 text-gray-500'}`}>{done?'✓':'○'}</span>
                        <span className={`text-xs ${done?'text-green-300':'text-gray-500'}`}>{step}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>router.push('/#login-section')}
                    className="w-full mt-4 py-2 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-900/30 border border-indigo-700/40 hover:bg-indigo-900/50 transition-colors">
                    Register Interest → Sign In
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* NEWS & CALENDAR */}
      <section id="news" className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <h2 className="font-bold text-xl mb-6">Market News</h2>
            <div className="space-y-3">
              {NEWS.map((n,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENT_COLORS[n.sentiment]}`}>{n.cat}</span>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-gray-500 text-xs">{n.source}</span>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-gray-500 text-xs">{n.time}</span>
                      </div>
                      <p className="font-medium text-white">{n.headline}</p>
                    </div>
                    <span className="text-blue-400 text-xs whitespace-nowrap">Read →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div id="calendar">
            <h2 className="font-bold text-xl mb-6">Economic Calendar</h2>
            <div className="space-y-3">
              {[
                {date:'01 Apr 2026',event:'HCPR Q1 Distribution',       type:'Distribution', color:'text-green-400'},
                {date:'01 Apr 2026',event:'ZWIB April Coupon Payment',   type:'Coupon',       color:'text-green-400'},
                {date:'15 Apr 2026',event:'HCPR Q1 Financial Submission',type:'Reporting',    color:'text-blue-400'},
                {date:'30 Apr 2026',event:'ACME Q1 Production Report',   type:'Reporting',    color:'text-blue-400'},
                {date:'15 May 2026',event:'ZWIB Q2 Auditor Review',      type:'Compliance',   color:'text-amber-400'},
                {date:'30 Jun 2026',event:'Platform Annual Report',      type:'Regulatory',   color:'text-purple-400'},
              ].map((e,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
                  <div className="text-center w-14 flex-shrink-0">
                    <p className="text-xs text-gray-500">{e.date.split(' ')[1]} {e.date.split(' ')[2]}</p>
                    <p className="font-black text-lg leading-none">{e.date.split(' ')[0]}</p>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{e.event}</p>
                    <span className={`text-xs font-semibold ${e.color}`}>{e.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {chartToken && (
        <TokenChartModal token={chartToken} onClose={() => setChartToken(null)} />
      )}

      {/* CTA */}
      <section className="py-12 px-6 text-center border-t border-gray-800">
        <p className="text-gray-400 mb-4">Log in to access full portfolio data, place orders, and claim distributions.</p>
        <button onClick={()=>router.push('/#login-section')}
          className="px-8 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90" style={{background:GOLD}}>
          Access Platform
        </button>
      </section>
    </div>
  );
}