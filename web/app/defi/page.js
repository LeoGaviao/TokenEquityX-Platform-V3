'use client';
import { useWallet } from '../../hooks/useWallet';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';

const NAVY='#1A3C5E', GOLD='#C8972B', GREEN='#16a34a', TEAL='#0891b2', PURPLE='#7c3aed';
const fmt = n => n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${parseFloat(n||0).toFixed(2)}`;
const pct = n => `${n>=0?'+':''}${parseFloat(n||0).toFixed(2)}%`;
const dt  = d => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

// ── Anonymised aggregate market data (no issuer PII) ─────────
const PLATFORM_STATS = {
  total_aum_usd:        1280000,
  total_volume_30d:     2840000,
  total_fees_30d:       14200,
  active_listings:      4,
  total_investors:      342,
  avg_yield:            8.5,
  total_distributions:  33625,
  settlement_currency:  'USDC',
  blockchain:           'Polygon',
  tps_avg:              847,
};

const ASSET_CLASS_BREAKDOWN = [
  {class:'Bond',         aum:1280000,  pct_aum:29, listings:1, avg_yield:8.5,  vol_30d:480000},
  {class:'Real Estate',  aum:5025000,  pct_aum:46, listings:1, avg_yield:9.2,  vol_30d:920000},
  {class:'Mining Equity',aum:4025000,  pct_aum:25, listings:2, avg_yield:0,    vol_30d:1440000},
];

const LIQUIDITY_DATA = Array.from({length:30},(_,i)=>({
  day:`Mar ${i+1}`,
  bid_depth:  Math.floor(80000+Math.random()*120000),
  ask_depth:  Math.floor(75000+Math.random()*110000),
  spread_bps: parseFloat((8+Math.random()*12).toFixed(1)),
}));

const VOLUME_DATA = Array.from({length:30},(_,i)=>({
  day:`Mar ${i+1}`,
  volume: Math.floor(60000+Math.random()*180000),
  trades: Math.floor(8+Math.random()*35),
  fees:   Math.floor(300+Math.random()*900),
}));

const YIELD_CURVE = [
  {tenor:'3M',yield_pct:6.2},{tenor:'6M',yield_pct:7.1},{tenor:'1Y',yield_pct:8.5},
  {tenor:'2Y',yield_pct:9.0},{tenor:'3Y',yield_pct:9.2},{tenor:'5Y',yield_pct:9.8},
];

const ORACLE_HISTORY = [
  {date:'2026-03-01',symbol:'ZWIB',price:1.0180,prev:1.0160,change:+0.20},
  {date:'2026-03-01',symbol:'HCPR',price:1.0030,prev:1.0020,change:+0.10},
  {date:'2026-03-15',symbol:'ZWIB',price:1.0240,prev:1.0180,change:+0.59},
  {date:'2026-03-15',symbol:'ACME',price:0.9820,prev:0.9950,change:-1.31},
  {date:'2026-03-15',symbol:'GDMR',price:1.0150,prev:1.0100,change:+0.50},
];

const SETTLEMENT_STATS = {
  avg_settlement_time_ms: 2340,
  failed_settlements_30d: 0,
  total_settlements_30d:  847,
  usdc_volume_30d:        2840000,
  gas_cost_avg_usd:       0.001,
  contract_uptime_pct:    99.98,
};

const RISK_METRICS = [
  {metric:'30D Price Volatility (Avg)',  value:'±1.2%',   flag:'LOW'},
  {metric:'Bid-Ask Spread (Avg)',        value:'12.4 bps', flag:'LOW'},
  {metric:'Oracle Variance (Max 30D)',   value:'1.31%',    flag:'LOW'},
  {metric:'Settlement Failure Rate',    value:'0.00%',    flag:'NONE'},
  {metric:'Circuit Breakers Triggered', value:'0',        flag:'NONE'},
  {metric:'KYC Compliance Rate',        value:'100%',     flag:'NONE'},
  {metric:'Outstanding Distributions',  value:'$0',       flag:'NONE'},
  {metric:'Regulatory Status',          value:'SECZ Sandbox Active', flag:'GREEN'},
];

const FLAG_COLORS={LOW:'text-green-400 bg-green-900/30',NONE:'text-green-400 bg-green-900/30',GREEN:'text-blue-400 bg-blue-900/30',MEDIUM:'text-amber-400 bg-amber-900/30',HIGH:'text-red-400 bg-red-900/30'};
const COLORS=[NAVY,GOLD,PURPLE,TEAL,GREEN];

export default function DefiDashboard() {
  const {account,user,ready}=useWallet();
  const router=useRouter();
  const [tab,setTab]=useState('market');
  const [tokens,setTokens]=useState([]);
  const [loading,setLoading]=useState(true);
  const [apiKey,setApiKey]=useState('txapi_'+(Math.random().toString(36).slice(2,18)));
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    const _u = JSON.parse(localStorage.getItem('user') || '{}');
    if(!_u?.role) return;
    if(!['PARTNER','ADMIN'].includes(_u?.role)){window.location.href='/';return;}
    loadData();
  },[ready]);

  const loadData=async()=>{
    try{
      const res=await api.get('/assets');
      if(res.data)setTokens(res.data);
    }catch{}
    finally{setLoading(false);}
  };

  const copyKey=()=>{
    navigator.clipboard?.writeText(apiKey).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  };

  if(!JSON.parse(localStorage.getItem('user')||'{}')?.role)return null;

  const KPI=({label,value,sub,icon,color='text-white'})=>(
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p>{sub&&<p className="text-gray-500 text-xs mt-1">{sub}</p>}</div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );

  return(
    <div className="min-h-screen bg-gray-950 text-white">
      {/* HEADER */}
      <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/80">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{background:`linear-gradient(135deg,${PURPLE},${TEAL})`}}>
              <span className="text-white">D</span>
            </div>
            <div><p className="font-bold text-sm">TokenEquityX</p><p className="text-gray-500 text-xs">DeFi Data Portal</p></div>
            <span className="ml-2 text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">DEFI PARTNER</span>
          </div>
          <nav className="flex gap-1">
            {['market','liquidity','oracle','settlement','risk','api'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-purple-600 text-white':'text-gray-400 hover:text-white'}`}>{t}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.email || 'User'}</span>
            <button onClick={()=>{localStorage.clear();window.location.href='/';}} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Disconnect</button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">

        {/* ══ MARKET DATA ══ */}
        {tab==='market'&&(
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Platform Market Data</h2>
              <p className="text-gray-500 text-sm mt-1">Aggregated market statistics. Individual issuer identities are anonymised where required. All prices are USDC-denominated.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Total AUM" value={fmt(PLATFORM_STATS.total_aum_usd)} sub="across all listings" icon="💰" color="text-yellow-400"/>
              <KPI label="30D Volume" value={fmt(PLATFORM_STATS.total_volume_30d)} sub="USDC settled" icon="📊" color="text-green-400"/>
              <KPI label="Active Listings" value={PLATFORM_STATS.active_listings} sub="tokenised assets" icon="🏢"/>
              <KPI label="Avg Yield" value={`${PLATFORM_STATS.avg_yield}%`} sub="income-bearing assets" icon="📈" color="text-teal-400"/>
            </div>

            {/* Listed assets — anonymised IDs + public market data */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Listed Asset Market Data</h3>
                <span className="text-xs text-gray-500">Prices updated quarterly by certified auditors · USDC basis</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Token','Asset Class','Oracle Price','30D Change','30D Volume','Market Cap','Holders','Yield','State'].map(h=><th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {[
                    {symbol:'ZWIB',class:'Bond',price:1.0240,change30d:+2.40,vol30d:480000,mktcap:1280000,holders:142,yield_pa:8.5,state:'FULL_TRADING'},
                    {symbol:'HCPR',class:'Real Estate',price:1.0050,change30d:+1.80,vol30d:920000,mktcap:5025000,holders:89,yield_pa:9.2,state:'FULL_TRADING'},
                    {symbol:'ACME',class:'Mining',price:0.9820,change30d:+3.80,vol30d:780000,mktcap:982000,holders:67,yield_pa:0,state:'FULL_TRADING'},
                    {symbol:'GDMR',class:'Mining',price:1.0150,change30d:-0.50,vol30d:660000,mktcap:3045000,holders:44,yield_pa:0,state:'FULL_TRADING'},
                  ].map((a,i)=>(
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3 pr-4"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{background:COLORS[i]}}>{a.symbol[0]}</div><span className="font-bold">{a.symbol}</span></div></td>
                      <td className="py-3 pr-4"><span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{a.class}</span></td>
                      <td className="py-3 pr-4 font-mono font-bold">${a.price.toFixed(4)}</td>
                      <td className="py-3 pr-4"><span className={a.change30d>=0?'text-green-400':'text-red-400'}>{pct(a.change30d)}</span></td>
                      <td className="py-3 pr-4 text-gray-300">{fmt(a.vol30d)}</td>
                      <td className="py-3 pr-4 text-yellow-400">{fmt(a.mktcap)}</td>
                      <td className="py-3 pr-4 text-gray-300">{a.holders}</td>
                      <td className="py-3 pr-4">{a.yield_pa>0?<span className="text-green-400 font-semibold">{a.yield_pa}%</span>:<span className="text-gray-500">—</span>}</td>
                      <td className="py-3"><span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">{a.state.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Asset class breakdown */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">AUM by Asset Class</h3>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart><Pie data={ASSET_CLASS_BREAKDOWN} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="aum" paddingAngle={3}>{ASSET_CLASS_BREAKDOWN.map((_,i)=><Cell key={i} fill={COLORS[i]}/>)}</Pie><Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[fmt(v),'AUM']}/></PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {ASSET_CLASS_BREAKDOWN.map((a,i)=>(
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background:COLORS[i]}}/><span className="text-sm">{a.class}</span></div>
                          <span className="text-sm font-bold">{a.pct_aum}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${a.pct_aum}%`,background:COLORS[i]}}/></div>
                        <div className="flex justify-between text-xs text-gray-500 mt-0.5"><span>{fmt(a.aum)} AUM</span><span>{a.listings} listing{a.listings>1?'s':''}{a.avg_yield>0?` · ${a.avg_yield}% yield`:''}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">30D Trading Volume by Asset</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ASSET_CLASS_BREAKDOWN} layout="vertical" margin={{left:20}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false}/>
                    <XAxis type="number" tick={{fill:'#6b7280',fontSize:10}} tickFormatter={v=>fmt(v)}/>
                    <YAxis type="category" dataKey="class" tick={{fill:'#6b7280',fontSize:11}} width={90}/>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[fmt(v),'Volume']}/>
                    <Bar dataKey="vol_30d" radius={[0,4,4,0]}>{ASSET_CLASS_BREAKDOWN.map((_,i)=><Cell key={i} fill={COLORS[i]}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volume history */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Daily Trading Volume — 30 Days</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={VOLUME_DATA}>
                  <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={NAVY} stopOpacity={0.5}/><stop offset="95%" stopColor={NAVY} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} interval={4}/>
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>fmt(v)}/>
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[fmt(v),'Volume']}/>
                  <Area type="monotone" dataKey="volume" stroke={NAVY} fill="url(#vg)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══ LIQUIDITY ══ */}
        {tab==='liquidity'&&(
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold">Liquidity Analytics</h2><p className="text-gray-500 text-sm mt-1">Order book depth, bid-ask spreads, and market microstructure data for integration into DeFi protocols.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Avg Bid Depth" value={fmt(125000)} sub="USDC at best bid" icon="📗" color="text-green-400"/>
              <KPI label="Avg Ask Depth" value={fmt(118000)} sub="USDC at best ask" icon="📕" color="text-red-400"/>
              <KPI label="Avg Spread" value="12.4 bps" sub="across all pairs" icon="📐" color="text-yellow-400"/>
              <KPI label="Avg Trade Size" value={fmt(3354)} sub="per matched order" icon="💵"/>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Order Book Depth — 30 Days</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={LIQUIDITY_DATA}>
                  <defs>
                    <linearGradient id="bidg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GREEN} stopOpacity={0.4}/><stop offset="95%" stopColor={GREEN} stopOpacity={0}/></linearGradient>
                    <linearGradient id="askg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.4}/><stop offset="95%" stopColor="#dc2626" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} interval={4}/>
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>fmt(v)}/>
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[fmt(v)]}/>
                  <Area type="monotone" dataKey="bid_depth" stroke={GREEN} fill="url(#bidg)" strokeWidth={2} name="Bid Depth"/>
                  <Area type="monotone" dataKey="ask_depth" stroke="#dc2626" fill="url(#askg)" strokeWidth={2} name="Ask Depth"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Bid-Ask Spread (basis points)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={LIQUIDITY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} interval={4}/>
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>`${v} bps`}/>
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[`${v} bps`,'Spread']}/>
                  <Line type="monotone" dataKey="spread_bps" stroke={GOLD} strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300">
              💡 <strong>DeFi Integration Note:</strong> TokenEquityX order book data is available via the REST API and WebSocket feed. Liquidity providers can connect via the P2P Transfer Module smart contract. Contact the team for white-label liquidity pool integration.
            </div>
          </div>
        )}

        {/* ══ ORACLE ══ */}
        {tab==='oracle'&&(
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold">Oracle Price Feed</h2><p className="text-gray-500 text-sm mt-1">Independent auditor-certified price updates. All prices are set by certified independent valuers. No algorithmic pricing — human-verified fundamental valuations only.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Oracle Updates (30D)" value="8" sub="across all assets" icon="🔮"/>
              <KPI label="Max Variance (30D)" value="1.31%" sub="vs previous price" icon="📊" color="text-green-400"/>
              <KPI label="Update Frequency" value="Quarterly" sub="or on material events" icon="📅"/>
              <KPI label="Certifying Auditor" value="ICAZ Member" sub="independent valuer" icon="✅" color="text-green-400"/>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Oracle Price Update History</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Date','Token','Previous Price','New Price','Change','Valuation Method','Certifier'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                <tbody>
                  {ORACLE_HISTORY.map((o,i)=>(
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3 pr-4 text-gray-400">{dt(o.date)}</td>
                      <td className="py-3 pr-4 font-bold">{o.symbol}</td>
                      <td className="py-3 pr-4 font-mono text-gray-400">${o.prev.toFixed(4)}</td>
                      <td className="py-3 pr-4 font-mono font-bold">${o.price.toFixed(4)}</td>
                      <td className="py-3 pr-4"><span className={o.change>=0?'text-green-400':'text-red-400'}>{pct(o.change)}</span></td>
                      <td className="py-3 pr-4 text-gray-400 text-xs">{{ZWIB:'Bond PV Model',HCPR:'NAV + Cap Rate',ACME:'Resource NPV',GDMR:'Resource NPV'}[o.symbol]}</td>
                      <td className="py-3 text-gray-400 text-xs">J. Sibanda CPA (ICAZ)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Yield Curve — TokenEquityX Platform</h3>
              <p className="text-gray-500 text-xs mb-4">Implied yield by tenor across income-bearing assets. Benchmark for DeFi yield comparisons.</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={YIELD_CURVE}>
                  <defs><linearGradient id="yg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.4}/><stop offset="95%" stopColor={GOLD} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis dataKey="tenor" tick={{fill:'#6b7280',fontSize:11}} tickLine={false}/>
                  <YAxis tick={{fill:'#6b7280',fontSize:11}} tickLine={false} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[`${v}%`,'Yield']}/>
                  <Area type="monotone" dataKey="yield_pct" stroke={GOLD} fill="url(#yg)" strokeWidth={2} dot={{fill:GOLD,r:4}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══ SETTLEMENT ══ */}
        {tab==='settlement'&&(
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold">Settlement & Blockchain Data</h2><p className="text-gray-500 text-sm mt-1">On-chain settlement metrics for the TokenEquityX platform on Polygon. All settlement in USDC.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPI label="Avg Settlement Time" value="2.34s" sub="block confirmation" icon="⚡" color="text-green-400"/>
              <KPI label="Settlement Failures (30D)" value="0" sub="100% success rate" icon="✅" color="text-green-400"/>
              <KPI label="Total Settlements (30D)" value={SETTLEMENT_STATS.total_settlements_30d.toLocaleString()} sub="matched trades" icon="🔗"/>
              <KPI label="USDC Volume (30D)" value={fmt(SETTLEMENT_STATS.usdc_volume_30d)} sub="on Polygon" icon="💵" color="text-yellow-400"/>
              <KPI label="Avg Gas Cost" value="$0.001" sub="per transaction" icon="⛽" color="text-teal-400"/>
              <KPI label="Contract Uptime" value={`${SETTLEMENT_STATS.contract_uptime_pct}%`} sub="last 90 days" icon="🟢" color="text-green-400"/>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Smart Contract Architecture</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  {name:'AssetToken',desc:'ERC-20 token with transfer restrictions and KYC gating',type:'UUPS Upgradeable'},
                  {name:'ExchangeSettlement',desc:'Order matching and atomic settlement engine',type:'Core'},
                  {name:'ComplianceManager',desc:'KYC status registry and transfer compliance checks',type:'Access Control'},
                  {name:'PriceOracle',desc:'Auditor-controlled price feed with TWAP',type:'Oracle'},
                  {name:'DividendDistributor',desc:'Pull-based dividend distribution with snapshot',type:'Finance'},
                  {name:'GovernanceModule',desc:'Token-weighted voting on issuer proposals',type:'Governance'},
                  {name:'MarketController',desc:'Circuit breakers, halts, and market state management',type:'Risk'},
                  {name:'P2PTransferModule',desc:'Peer-to-peer transfers with compliance checks',type:'Transfer'},
                  {name:'DebtManager',desc:'Bond coupon scheduling and payment tracking',type:'Finance'},
                ].map((c,i)=>(
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{c.type}</span>
                    </div>
                    <p className="text-gray-500 text-xs">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Network Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Blockchain','Polygon PoS'],['Chain ID','137 (Mainnet) / 80002 (Amoy)'],['Settlement Token','USDC (USD Coin)'],['Token Standard','ERC-20 (Modified)'],['Avg Block Time','2.1 seconds'],['Consensus','Proof of Stake'],['Audit Firm','Certik / Hacken'],['Solidity Version','0.8.22']].map(([k,v],i)=>(
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">{k}</p>
                    <p className="font-semibold text-sm">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ RISK ══ */}
        {tab==='risk'&&(
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold">Risk & Compliance Metrics</h2><p className="text-gray-500 text-sm mt-1">Platform-level risk indicators for institutional due diligence. No individual issuer or investor data is disclosed.</p></div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Key Risk Indicators</h3>
              <div className="space-y-3">
                {RISK_METRICS.map((r,i)=>(
                  <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-700/50">
                    <p className="text-sm font-medium">{r.metric}</p>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{r.value}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${FLAG_COLORS[r.flag]}`}>{r.flag==='NONE'?'✅ OK':r.flag==='GREEN'?'✅ ACTIVE':r.flag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Regulatory Framework</h3>
                <div className="space-y-3">
                  {[
                    {label:'Regulator',value:'SECZ — Securities and Exchange Commission of Zimbabwe'},
                    {label:'Status',value:'Innovation Hub Regulatory Sandbox — Active'},
                    {label:'Applicable Law',value:'Securities and Exchange Act (Chapter 24:25)'},
                    {label:'KYC/AML Standard',value:'FATF-compliant, local FIU reporting'},
                    {label:'Investor Eligibility',value:'KYC-verified accredited and institutional investors'},
                    {label:'Asset Custody',value:'SPV structure — assets held in registered legal entities'},
                    {label:'Audit Requirement',value:'Quarterly data submissions, annual independent audit'},
                  ].map(({label,value},i)=>(
                    <div key={i} className="flex items-start justify-between bg-gray-800/50 rounded-lg px-3 py-2.5">
                      <span className="text-gray-400 text-xs w-40 flex-shrink-0">{label}</span>
                      <span className="text-sm font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Privacy & Data Policy</h3>
                <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
                  <p>TokenEquityX separates <strong className="text-white">public market data</strong> (prices, volumes, yields) from <strong className="text-white">protected issuer data</strong> (financial details, identity, documents).</p>
                  <p>DeFi partners receive access to:</p>
                  <ul className="space-y-1 ml-4">
                    {['Anonymised aggregate market statistics','Token price and volume data (public)','Oracle price feeds and update history','Settlement and blockchain metrics','Platform-level risk and compliance indicators','Yield curve and distribution data'].map((item,i)=>(
                      <li key={i} className="flex items-center gap-2"><span className="text-green-400">✓</span><span>{item}</span></li>
                    ))}
                  </ul>
                  <p>DeFi partners do <strong className="text-white">not</strong> receive access to:</p>
                  <ul className="space-y-1 ml-4">
                    {['Individual investor identities or wallets','Issuer financial statements or documents','KYC records or personal data','Order book counterparty information'].map((item,i)=>(
                      <li key={i} className="flex items-center gap-2"><span className="text-red-400">✗</span><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ API ══ */}
        {tab==='api'&&(
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold">API Access</h2><p className="text-gray-500 text-sm mt-1">Programmatic access to TokenEquityX market data for DeFi protocol integration.</p></div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Your API Key</h3>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-sm font-mono text-yellow-400">{apiKey}</code>
                <button onClick={copyKey} className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${copied?'bg-green-700 text-white':'bg-gray-700 hover:bg-gray-600 text-white'}`}>{copied?'✓ Copied':'Copy'}</button>
              </div>
              <p className="text-gray-600 text-xs mt-2">Keep this key private. Do not expose it in client-side code. Rate limit: 1,000 requests/hour.</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Available Endpoints</h3>
              <div className="space-y-3">
                {[
                  {method:'GET',path:'/api/ticker',desc:'All listed assets with live prices, volumes and yields',auth:false},
                  {method:'GET',path:'/api/assets/all',desc:'Full asset catalogue with market data',auth:false},
                  {method:'GET',path:'/api/oracle/prices',desc:'Current oracle prices for all tokens',auth:false},
                  {method:'GET',path:'/api/oracle/history/:symbol',desc:'Oracle price update history for a token',auth:false},
                  {method:'GET',path:'/api/trading/candles/:symbol',desc:'OHLCV candlestick data for a token',auth:true},
                  {method:'GET',path:'/api/trading/orderbook/:symbol',desc:'Current order book (bids and asks)',auth:true},
                  {method:'GET',path:'/api/governance/proposals',desc:'Active governance proposals and vote counts',auth:false},
                  {method:'GET',path:'/api/dividends/rounds/:symbol',desc:'Dividend/distribution round history',auth:true},
                  {method:'WS', path:'ws://localhost:3001',desc:'Real-time price and trade event stream',auth:true},
                ].map((e,i)=>(
                  <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${e.method==='GET'?'bg-green-900/60 text-green-300':e.method==='WS'?'bg-purple-900/60 text-purple-300':'bg-blue-900/60 text-blue-300'}`}>{e.method}</span>
                    <div className="flex-1">
                      <code className="text-yellow-400 text-sm font-mono">{e.path}</code>
                      <p className="text-gray-400 text-xs mt-1">{e.desc}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${e.auth?'bg-amber-900/50 text-amber-300':'bg-gray-700 text-gray-400'}`}>{e.auth?'API Key':'Public'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Quick Start</h3>
              <pre className="bg-gray-950 rounded-xl p-4 text-xs text-green-400 font-mono overflow-x-auto">{`// Get live ticker data
const response = await fetch('http://localhost:3001/api/ticker', {
  headers: { 'Authorization': 'Bearer ${apiKey}' }
});
const assets = await response.json();

// WebSocket real-time feed
const ws = new WebSocket('ws://localhost:3001');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'PRICE_UPDATE') {
    console.log(msg.symbol, msg.price);
  }
};`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
