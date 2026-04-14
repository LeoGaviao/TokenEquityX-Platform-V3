'use client';
import { useWallet } from '../../hooks/useWallet';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

const NAVY = '#1A3C5E';
const GOLD = '#C8972B';
const GREEN = '#16a34a';

const fmt = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(2)}`;
const dt  = (d) => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});

const PIPELINE_STAGES = ['Lead Identified','Contact Made','Proposal Sent','Onboarding','Active Client'];
const STAGE_COLORS = ['bg-gray-700','bg-blue-900/60','bg-purple-900/60','bg-amber-900/60','bg-green-900/60'];
const STAGE_TEXT   = ['text-gray-300','text-blue-300','text-purple-300','text-amber-300','text-green-300'];

const mockPipeline = [
  { id:1, name:'CBZ Bank Holdings', type:'Banking Partner (White-Label)', stage:4, contact:'T. Chirimuuta — Head of Digital', value_usd:100000, submitted:'2026-02-15', notes:'MOU signed. Technical integration scoping in progress. Go-live target: Q3 2026.' },
  { id:2, name:'Old Mutual Zimbabwe', type:'Institutional Investor', stage:3, contact:'R. Mupfupi — Portfolio Manager', value_usd:500000, submitted:'2026-03-01', notes:'Proposal for 250,000 ZWIB tokens submitted. Awaiting investment committee approval.' },
  { id:3, name:'Nicoz Diamond Insurance', type:'Institutional Investor', stage:2, contact:'L. Zvanyanya — CIO', value_usd:150000, submitted:'2026-03-10', notes:'Initial meeting completed. Interested in REIT exposure. Follow-up scheduled 4 Apr.' },
  { id:4, name:'ZB Financial Holdings', type:'Issuer (Equity Token)', stage:2, contact:'S. Mutseyami — CFO', value_usd:2000000, submitted:'2026-03-15', notes:'Preliminary discussion. Exploring equity tokenisation of ZB Bank shares. Next step: formal presentation.' },
  { id:5, name:'First Mutual Life', type:'Institutional Investor', stage:1, contact:'T. Chikohora — Investment Director', value_usd:300000, submitted:'2026-03-22', notes:'Warm referral from CBZ. Initial outreach sent. Awaiting response.' },
  { id:6, name:'TelOne Zimbabwe', type:'Issuer (Infrastructure Bond)', stage:1, contact:'A. Mudimu — Group Treasurer', value_usd:5000000, submitted:'2026-03-24', notes:'Infrastructure bond tokenisation opportunity. Early stage qualification.' },
];

const mockActiveClients = [
  { name:'ZimInfra Holdings', token:'ZWIB', referred:'2026-01-10', volume_mtd:285000, commission_mtd:712.50, total_commission:1890, status:'Active' },
  { name:'Harare CBD REIT Mgmt', token:'HCPR', referred:'2026-01-25', volume_mtd:128000, commission_mtd:320.00, total_commission:920, status:'Active' },
];

const mockCommHistory = Array.from({length:6},(_,i)=>({
  month:['Oct','Nov','Dec','Jan','Feb','Mar'][i],
  earned:[0,0,0,245,580,1032.50][i],
}));

const mockRefLinks = [
  { label:'Investor Onboarding', url:'https://tokenequityx.com/ref/PARTNER_CODE/invest', clicks:48, signups:12 },
  { label:'Issuer Application', url:'https://tokenequityx.com/ref/PARTNER_CODE/issue',  clicks:23, signups:4 },
  { label:'Platform Overview',  url:'https://tokenequityx.com/ref/PARTNER_CODE/about',  clicks:112, signups:16 },
];

export default function PartnerDashboard() {
  const { account, user, ready } = useWallet();
  const router = useRouter();

  const [pipeline,  setPipeline]  = useState(mockPipeline);
  const [clients,   setClients]   = useState(mockActiveClients);
  const [tab,       setTab]       = useState('overview');
  const [loading,   setLoading]   = useState(true);
  const [newLead,   setNewLead]   = useState({ name:'', type:'', contact:'', value:'', notes:'' });
  const [msg,       setMsg]       = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);

  useEffect(() => {
   const _u = JSON.parse(localStorage.getItem('user') || '{}');
if (!_u?.role) return;
    
    if (!['PARTNER','ADMIN'].includes(_u?.role)) { window.location.href = '/'; return; }
    setLoading(false);
  }, [ready]);

  const addLead = () => {
    if (!newLead.name) return;
    setPipeline(p=>[...p,{id:p.length+1,...newLead,value_usd:parseFloat(newLead.value)||0,stage:0,submitted:new Date().toISOString()}]);
    setNewLead({name:'',type:'',contact:'',value:'',notes:''});
    setMsg({type:'success', text:`Lead "${newLead.name}" added to your pipeline.`});
    setTimeout(()=>setMsg(null),3000);
  };

  const advanceStage = (id) => {
    setPipeline(p=>p.map(item=>item.id===id && item.stage<4?{...item,stage:item.stage+1}:item));
  };

  const copyLink = (url, i) => {
    navigator.clipboard?.writeText(url).catch(()=>{});
    setCopiedLink(i);
    setTimeout(()=>setCopiedLink(null),2000);
  };

  const totalCommMTD   = clients.reduce((a,c)=>a+c.commission_mtd,0);
  const totalCommYTD   = clients.reduce((a,c)=>a+c.total_commission,0);
  const totalPipeValue = pipeline.reduce((a,p)=>a+p.value_usd,0);
  const activeLeads    = pipeline.filter(p=>p.stage<4).length;

  if (!JSON.parse(localStorage.getItem('user') || '{}')?.role) return null;

  const stageGroups = PIPELINE_STAGES.map((s,si)=>({stage:s, idx:si, items:pipeline.filter(p=>p.stage===si)}));

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/80">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:GOLD}}>
              <span className="text-sm font-bold text-gray-900">TX</span>
            </div>
            <div>
              <p className="font-bold text-sm">TokenEquityX</p>
              <p className="text-gray-500 text-xs">Partner Portal</p>
            </div>
            <span className="ml-2 text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full">PARTNER</span>
          </div>
          <nav className="flex gap-1">
            {['overview','pipeline','clients','commission','tools'].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.email || 'User'}</span>
            <button onClick={()=>{localStorage.clear();window.location.href='/'}} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Disconnect</button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {msg && (
          <div className={`rounded-xl p-4 border mb-6 ${msg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':'bg-red-900/40 border-red-700 text-red-300'}`}>
            {msg.text}
          </div>
        )}

        {/* ══════ TAB: OVERVIEW ══════ */}
        {tab==='overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Commission MTD',     value:fmt(totalCommMTD),    sub:'this month',           color:'text-yellow-400' },
                { label:'Commission YTD',     value:fmt(totalCommYTD),    sub:'year to date',         color:'text-green-400' },
                { label:'Active Clients',     value:clients.length,       sub:'generating commission', color:'text-white' },
                { label:'Pipeline Value',     value:fmt(totalPipeValue),  sub:`${activeLeads} active leads`, color:'text-blue-400' },
              ].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Commission chart */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Monthly Commission Earned (USD)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mockCommHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                    <XAxis dataKey="month" tick={{fill:'#6b7280',fontSize:11}} tickLine={false}/>
                    <YAxis tick={{fill:'#6b7280',fontSize:11}} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={(v)=>[`$${v.toFixed(2)}`,'Commission']}/>
                    <Bar dataKey="earned" fill={GOLD} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Commission structure */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Your Commission Structure</h3>
                <div className="space-y-3">
                  {[
                    { stream:'Trading Fee Revenue Share', rate:'25%', desc:'Of platform trading fees generated by your referred investors' },
                    { stream:'Issuance Fee Revenue Share', rate:'20%', desc:'Of issuance fees from your referred issuers' },
                    { stream:'Platform Fee Revenue Share', rate:'15%', desc:'Of annual platform fees from your referred listings' },
                    { stream:'White-Label Referral Bonus', rate:'10%', desc:'One-time bonus on first year white-label licence value' },
                    { stream:'KYC Fee Share', rate:'30%', desc:'Of KYC onboarding fees from your referred investors' },
                  ].map((c,i)=>(
                    <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
                      <span className="font-bold text-yellow-400 text-sm w-10 flex-shrink-0">{c.rate}</span>
                      <div>
                        <p className="text-sm font-medium">{c.stream}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active client performance */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Active Client Performance</h3>
                <button onClick={()=>setTab('clients')} className="text-xs text-blue-400 hover:text-blue-300">Full view →</button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {clients.map((c,i)=>(
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold">{c.name}</p>
                        <p className="text-gray-500 text-xs">{c.token} · Referred {dt(c.referred)}</p>
                      </div>
                      <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">{c.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      {[
                        ['Vol MTD',     fmt(c.volume_mtd),   'text-white'],
                        ['Comm MTD',    fmt(c.commission_mtd), 'text-yellow-400'],
                        ['Total Comm',  fmt(c.total_commission), 'text-green-400'],
                      ].map(([k,v,col],j)=>(
                        <div key={j} className="bg-gray-800/60 rounded-lg py-2">
                          <p className="text-gray-500 text-xs">{k}</p>
                          <p className={`font-semibold ${col}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════ TAB: PIPELINE ══════ */}
        {tab==='pipeline' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Deal Pipeline</h2>
              <button onClick={()=>setTab('tools')} className="text-sm px-4 py-2 rounded-xl font-semibold text-white" style={{background:NAVY}}>
                + Add New Lead
              </button>
            </div>

            {/* Kanban */}
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max pb-4">
                {stageGroups.map(({stage,idx,items})=>(
                  <div key={idx} className="w-72 flex-shrink-0">
                    <div className={`rounded-t-xl px-3 py-2 flex items-center justify-between ${STAGE_COLORS[idx]}`}>
                      <span className={`text-sm font-semibold ${STAGE_TEXT[idx]}`}>{stage}</span>
                      <span className={`text-xs font-bold ${STAGE_TEXT[idx]}`}>{items.length}</span>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 border-t-0 rounded-b-xl p-3 space-y-3 min-h-48">
                      {items.map(item=>(
                        <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm">{item.name}</p>
                              <span className="text-xs text-gray-500">{item.type}</span>
                            </div>
                            <span className="text-xs text-green-400 font-bold">{fmt(item.value_usd)}</span>
                          </div>
                          <p className="text-gray-500 text-xs mb-2">📋 {item.contact}</p>
                          <p className="text-gray-400 text-xs line-clamp-2">{item.notes}</p>
                          {item.stage < 4 && (
                            <button onClick={()=>advanceStage(item.id)}
                              className={`w-full mt-3 py-1.5 rounded-lg text-xs font-semibold ${STAGE_COLORS[idx+1]||'bg-green-700'} ${STAGE_TEXT[idx+1]||'text-green-200'} border border-transparent hover:border-current`}>
                              → Move to {PIPELINE_STAGES[item.stage+1]}
                            </button>
                          )}
                          {item.stage === 4 && (
                            <p className="text-xs text-green-400 font-semibold mt-2 text-center">✓ Active Client</p>
                          )}
                        </div>
                      ))}
                      {items.length===0 && (
                        <p className="text-gray-700 text-xs text-center py-4">No leads at this stage</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline table view */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Pipeline Summary</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    {['Company','Type','Stage','Est. Value','Contact','Added','Notes'].map(h=>(
                      <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((p,i)=>(
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{p.type}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[p.stage]} ${STAGE_TEXT[p.stage]}`}>
                          {PIPELINE_STAGES[p.stage]}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-yellow-400 font-semibold">{fmt(p.value_usd)}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{p.contact}</td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">{dt(p.submitted)}</td>
                      <td className="py-2 text-gray-500 text-xs max-w-xs truncate">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════ TAB: CLIENTS ══════ */}
        {tab==='clients' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Active Clients</h2>
            {clients.map((c,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{background:NAVY}}>{c.name[0]}</div>
                    <div>
                      <p className="font-bold">{c.name}</p>
                      <p className="text-gray-500 text-xs">{c.token} · Referred {c.referred} · {c.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-400">{fmt(c.total_commission)}</p>
                    <p className="text-gray-500 text-xs">total commission earned</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['Trading Volume MTD', fmt(c.volume_mtd)],
                    ['Commission MTD', fmt(c.commission_mtd)],
                    ['Total Commission', fmt(c.total_commission)],
                    ['Client Since', dt(c.referred)],
                  ].map(([k,v],j)=>(
                    <div key={j} className="bg-gray-800/60 rounded-xl p-3 text-center">
                      <p className="text-gray-500 text-xs mb-1">{k}</p>
                      <p className="font-bold">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {clients.length===0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">🤝</p>
                <p className="text-gray-400">No active clients yet. Move pipeline leads to Active Client to start earning commission.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════ TAB: COMMISSION ══════ */}
        {tab==='commission' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Commission Breakdown</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'This Month',  value:fmt(totalCommMTD),  color:'text-yellow-400' },
                { label:'Year to Date', value:fmt(totalCommYTD),  color:'text-green-400' },
                { label:'Lifetime',    value:fmt(totalCommYTD+1024), color:'text-white' },
              ].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                  <p className="text-gray-500 text-xs uppercase mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Commission by Month</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mockCommHistory}>
                  <defs>
                    <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.5}/>
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis dataKey="month" tick={{fill:'#6b7280',fontSize:11}} tickLine={false}/>
                  <YAxis tick={{fill:'#6b7280',fontSize:11}} tickLine={false} tickFormatter={v=>`$${v}`}/>
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={(v)=>[`$${v.toFixed(2)}`,'Commission']}/>
                  <Area type="monotone" dataKey="earned" stroke={GOLD} fill="url(#commGrad)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Transaction History</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    {['Date','Client','Stream','Source Amount','Rate','Commission'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date:'28 Mar 2026', client:'ZimInfra Holdings', stream:'Trading Fee Share',   src:'$5,700',   rate:'25%', comm:'$712.50' },
                    { date:'28 Mar 2026', client:'Harare CBD REIT',    stream:'Trading Fee Share',   src:'$1,280',   rate:'25%', comm:'$320.00' },
                    { date:'01 Mar 2026', client:'ZimInfra Holdings', stream:'Platform Fee Share',  src:'$5,000',   rate:'15%', comm:'$750.00' },
                    { date:'01 Mar 2026', client:'Harare CBD REIT',    stream:'Platform Fee Share',  src:'$5,000',   rate:'15%', comm:'$750.00' },
                    { date:'15 Jan 2026', client:'ZimInfra Holdings', stream:'KYC Onboarding Share', src:'$1,500', rate:'30%', comm:'$450.00' },
                  ].map((r,i)=>(
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 text-gray-400">{r.date}</td>
                      <td className="py-2 pr-4 font-medium">{r.client}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{r.stream}</td>
                      <td className="py-2 pr-4">{r.src}</td>
                      <td className="py-2 pr-4 text-blue-400">{r.rate}</td>
                      <td className="py-2 text-yellow-400 font-semibold">{r.comm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════ TAB: TOOLS ══════ */}
        {tab==='tools' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Partner Tools</h2>

            {/* Add new lead */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Add New Lead</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[
                  {field:'name',    label:'Company Name',         ph:'e.g. Stanbic Bank Zimbabwe'},
                  {field:'type',    label:'Lead Type',            ph:'e.g. Banking Partner / Institutional Investor / Issuer'},
                  {field:'contact', label:'Primary Contact',      ph:'e.g. J. Moyo — Head of Digital'},
                  {field:'value',   label:'Estimated Value (USD)', ph:'e.g. 500000'},
                ].map(({field,label,ph})=>(
                  <div key={field}>
                    <label className="text-sm text-gray-400 block mb-1">{label}</label>
                    <input value={newLead[field]} onChange={e=>setNewLead(l=>({...l,[field]:e.target.value}))}
                      placeholder={ph}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600"/>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-400 block mb-1">Notes</label>
                <textarea value={newLead.notes} onChange={e=>setNewLead(l=>({...l,notes:e.target.value}))} rows={3}
                  placeholder="Context, meeting notes, next steps"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 resize-none"/>
              </div>
              <button onClick={addLead}
                className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>
                + Add to Pipeline
              </button>
            </div>

            {/* Referral links */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Your Referral Links</h3>
              <p className="text-gray-500 text-sm mb-4">Share these links with prospects. All sign-ups and activity through your links are attributed to your partner account.</p>
              <div className="space-y-3">
                {mockRefLinks.map((l,i)=>(
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{l.label}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{l.clicks} clicks</span>
                        <span className="text-green-400">{l.signups} sign-ups</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">{l.url}</code>
                      <button onClick={()=>copyLink(l.url,i)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${copiedLink===i?'bg-green-700 text-white':'bg-gray-700 hover:bg-gray-600 text-white'}`}>
                        {copiedLink===i?'✓ Copied':'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Marketing assets */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Marketing Assets</h3>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { name:'Platform Overview Deck',    format:'PPTX', size:'4.2 MB' },
                  { name:'Investor Brochure',          format:'PDF',  size:'1.8 MB' },
                  { name:'Issuer Guide',               format:'PDF',  size:'2.1 MB' },
                  { name:'TokenEquityX Logo Pack',     format:'ZIP',  size:'0.9 MB' },
                  { name:'One-Pager (English)',         format:'PDF',  size:'0.5 MB' },
                  { name:'Whitepaper V3.0',            format:'PDF',  size:'3.4 MB' },
                  { name:'Financial Model (Excel)',    format:'XLSX', size:'1.2 MB' },
                  { name:'Social Media Templates',    format:'ZIP',  size:'6.1 MB' },
                ].map((a,i)=>(
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 flex flex-col items-center text-center">
                    <span className="text-2xl mb-2">{a.format==='PDF'?'📄':a.format==='PPTX'?'📊':a.format==='XLSX'?'📈':'📦'}</span>
                    <p className="text-sm font-medium leading-tight mb-1">{a.name}</p>
                    <p className="text-xs text-gray-500 mb-2">{a.format} · {a.size}</p>
                    <button className="text-xs text-blue-400 hover:text-blue-300">Download</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
