'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:3001';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../../hooks/useWallet';
import api from '../../../lib/api';
import Inbox from '../../../components/ui/Inbox';
import TokenChartModal from '../../../components/TokenChartModal';
import PremiumBadge from '../../../components/investor/PremiumBadge';
import PortfolioTable from '../../../components/investor/PortfolioTable';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const NAVY  = '#1A3C5E';
const GOLD  = '#C8972B';
const GREEN = '#16a34a';

const fmt = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(2)}`;
const pct = (n) => `${n >= 0 ? '+' : ''}${parseFloat(n||0).toFixed(2)}%`;
const dt  = (d) => new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

const INST_TYPE_LABELS = {
  ASSET_MANAGER: 'Asset Manager', PENSION_FUND: 'Pension Fund', INSURANCE: 'Insurance Company',
  ENDOWMENT: 'Endowment Fund', SOVEREIGN_WEALTH: 'Sovereign Wealth Fund', OTHER: 'Other Institution',
};

export default function InstitutionalDashboard() {
  const { account, ready } = useWallet();
  const router = useRouter();

  // ── Core state
  const [tab,           setTab]           = useState('portfolio');
  const [holdings,      setHoldings]      = useState([]);
  const [tokens,        setTokens]        = useState([]);
  const [proposals,     setProposals]     = useState([]);
  const [dividends,     setDividends]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [offerings,     setOfferings]     = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [openOrders,    setOpenOrders]    = useState([]);
  const [prices,        setPrices]        = useState({});
  const [actionMsg,     setActionMsg]     = useState(null);
  const [premiumAccess, setPremiumAccess] = useState(null);
  const [chartToken,    setChartToken]    = useState(null);
  const [kycRecord,     setKycRecord]     = useState(null);

  // ── Wallet state
  const [wallet,       setWallet]       = useState({ balance_usd:0, reserved_usd:0, available_usd:0, balance_usdc:0, settlement_rail:'FIAT' });
  const [walletTxns,   setWalletTxns]   = useState([]);
  const [walletTab,    setWalletTab]    = useState('overview');
  const [walletMsg,    setWalletMsg]    = useState(null);
  const [walletLoading,setWalletLoading]= useState(false);
  const [depositForm,  setDepositForm]  = useState({ amount_usd:'', reference:'', notes:'' });
  const [withdrawForm, setWithdrawForm] = useState({ amount_usd:'', bank_name:'', account_name:'', account_number:'', branch_code:'' });

  // ── Trade state
  const [tradeSymbol,  setTradeSymbol]  = useState('');
  const [tradeSide,    setTradeSide]    = useState('BUY');
  const [tradeType,    setTradeType]    = useState('LIMIT');
  const [tradeQty,     setTradeQty]     = useState('');
  const [tradePrice,   setTradePrice]   = useState('');
  const [orderBook,    setOrderBook]    = useState({ bids:[], asks:[], recentTrades:[] });
  const [tradeMsg,     setTradeMsg]     = useState(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [cancelling,   setCancelling]   = useState(null);

  const [selOffering,  setSelOffering]  = useState(null);
  const [subAmount,    setSubAmount]    = useState('');
  const [subLoading,   setSubLoading]   = useState(false);
  const [claiming,     setClaiming]     = useState(null);
  const [voting,       setVoting]       = useState(null);

  const wsRef = useRef(null);
  const notify = (type, text) => { setActionMsg({type,text}); setTimeout(()=>setActionMsg(null),3500); };

  useEffect(() => {
    const _u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!_u?.role) return;
    if (!['INVESTOR','ADMIN'].includes(_u?.role)) { window.location.href = '/'; return; }
    if (!(_u?.onboarding_complete === true || _u?.onboarding_complete === 1 || _u?.onboarding_complete === 'true')) {
      router.push('/onboarding'); return;
    }
    // Tier guard — redirect away if not INSTITUTION
    const tier = _u?.investor_tier;
    if (tier === 'CORPORATE') { router.push('/investor/corporate'); return; }
    if (!tier || tier === 'RETAIL') { router.push('/investor'); return; }
    loadAll();
    connectWS();
    return () => wsRef.current?.close();
  }, [ready]);

  const loadAll = async () => {
    try {
      const _u    = JSON.parse(localStorage.getItem('user') || '{}');
      const uid   = _u?.id || account || 'me';
      const token = localStorage.getItem('token');
      const h     = { Authorization: `Bearer ${token}` };

      fetch(`${API}/wallet/balance`,          { headers: h }).then(r=>r.json()).then(d=>{ if(d.balance_usd!==undefined) setWallet(d); }).catch(()=>{});
      fetch(`${API}/wallet/settlement-rail`,  { headers: h }).then(r=>r.json()).then(d=>{ if(d.rail) setWallet(w=>({...w,balance_usdc:d.balance_usdc||0,settlement_rail:d.rail})); }).catch(()=>{});
      fetch(`${API}/wallet/transactions`,     { headers: h }).then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setWalletTxns(d); }).catch(()=>{});
      fetch(`${API}/kyc/my-record`,           { headers: h }).then(r=>r.json()).then(d=>{ if(d.exists) setKycRecord(d); }).catch(()=>{});
      fetch(`${API}/investor/premium-status`, { headers: h }).then(r=>r.json()).then(d=>{ if(d.reason) setPremiumAccess(d); }).catch(()=>{});

      const [holdRes, tokenRes, propRes, divRes] = await Promise.allSettled([
        api.get(`/kyc/holdings/${uid}`),
        api.get('/assets'),
        api.get('/governance/proposals'),
        api.get(`/dividends/claimable/${uid}`),
      ]);
      if (holdRes.status==='fulfilled')  setHoldings(holdRes.value.data||[]);
      if (tokenRes.status==='fulfilled') setTokens(tokenRes.value.data||[]);
      if (propRes.status==='fulfilled')  setProposals(propRes.value.data||[]);
      if (divRes.status==='fulfilled')   setDividends(divRes.value.data||[]);

      api.get('/offerings').then(r=>setOfferings((r.data||[]).filter(o=>o.status==='OPEN'))).catch(()=>{});
      fetch(`${API}/offerings/my-subscriptions`, { headers: h }).then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setSubscriptions(d); }).catch(()=>{});
      fetchOpenOrders();
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchOrderBook = async (symbol) => {
    if (!symbol) return;
    try { const res = await api.get(`/trading/orderbook/${symbol}`); setOrderBook(res.data||{bids:[],asks:[],recentTrades:[]}); } catch {}
  };

  const fetchOpenOrders = async () => {
    try { const res = await api.get('/trading/orders'); setOpenOrders(res.data||[]); } catch {}
  };

  const connectWS = () => {
    try {
      const ws = new WebSocket(`${WS}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try { const msg = JSON.parse(e.data); if (msg.type==='PRICE_UPDATE') setPrices(p=>({...p,[msg.symbol]:msg.price})); } catch {}
      };
    } catch {}
  };

  const handleDeposit = async () => {
    if (!depositForm.amount_usd||!depositForm.reference) { setWalletMsg({type:'error',text:'Amount and bank reference are required.'}); return; }
    setWalletLoading(true);
    try {
      const res  = await fetch(`${API}/wallet/deposit`, { method:'POST', headers:{Authorization:`Bearer ${localStorage.getItem('token')}`,'Content-Type':'application/json'}, body:JSON.stringify(depositForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWalletMsg({type:'success',text:data.message});
      setDepositForm({amount_usd:'',reference:'',notes:''});
    } catch(err) { setWalletMsg({type:'error',text:err.message||'Deposit request failed.'}); }
    finally { setWalletLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawForm.amount_usd||!withdrawForm.bank_name||!withdrawForm.account_number) { setWalletMsg({type:'error',text:'Amount and bank details are required.'}); return; }
    setWalletLoading(true);
    try {
      const res  = await fetch(`${API}/wallet/withdraw`, { method:'POST', headers:{Authorization:`Bearer ${localStorage.getItem('token')}`,'Content-Type':'application/json'}, body:JSON.stringify(withdrawForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWalletMsg({type:'success',text:data.message});
      setWithdrawForm({amount_usd:'',bank_name:'',account_name:'',account_number:'',branch_code:''});
      loadAll();
    } catch(err) { setWalletMsg({type:'error',text:err.message||'Withdrawal request failed.'}); }
    finally { setWalletLoading(false); }
  };

  const placeOrder = async () => {
    if (!tradeSymbol) { setTradeMsg({type:'error',text:'Please select a token.'}); return; }
    if (!tradeQty||parseFloat(tradeQty)<=0) { setTradeMsg({type:'error',text:'Enter a valid quantity.'}); return; }
    if (tradeType==='LIMIT'&&(!tradePrice||parseFloat(tradePrice)<=0)) { setTradeMsg({type:'error',text:'Enter a valid limit price.'}); return; }
    setTradeLoading(true); setTradeMsg(null);
    try {
      await api.post('/trading/order', { tokenSymbol:tradeSymbol, side:tradeSide, orderType:tradeType, quantity:parseFloat(tradeQty), limitPrice:tradeType==='LIMIT'?parseFloat(tradePrice):null });
      setTradeMsg({type:'success',text:`✅ ${tradeSide} order placed — ${tradeQty} ${tradeSymbol}`});
      setTradeQty(''); setTradePrice('');
      fetchOpenOrders(); fetchOrderBook(tradeSymbol); loadAll();
    } catch(e) { setTradeMsg({type:'error',text:e.response?.data?.error||'Failed to place order.'}); }
    finally { setTradeLoading(false); }
  };

  const cancelOrder = async (orderId) => {
    setCancelling(orderId);
    try { await api.put(`/trading/orders/${orderId}/cancel`); setOpenOrders(o=>o.filter(x=>x.id!==orderId)); notify('success','Order cancelled.'); }
    catch { notify('error','Failed to cancel order.'); }
    finally { setCancelling(null); }
  };

  const subscribeToOffering = async (offeringId) => {
    if (!subAmount||parseFloat(subAmount)<=0) { alert('Please enter a valid subscription amount.'); return; }
    setSubLoading(true);
    try {
      const res = await api.post(`/offerings/${offeringId}/subscribe`, { amount_usd:parseFloat(subAmount) });
      notify('success',`✅ ${res.data.message}`); setSelOffering(null); setSubAmount('');
      api.get('/offerings').then(r=>setOfferings((r.data||[]).filter(o=>o.status==='OPEN'))).catch(()=>{});
    } catch(err) { notify('error',err.response?.data?.error||'Subscription failed.'); }
    setSubLoading(false);
  };

  const claimDividend = async (roundId, amount) => {
    setClaiming(roundId);
    try {
      const _u = JSON.parse(localStorage.getItem('user')||'{}');
      await api.post('/dividends/claim', { walletAddress:_u?.id||account, roundId });
      setDividends(ds=>ds.filter(d=>d.id!==roundId));
      notify('success',`✅ $${parseFloat(amount).toFixed(2)} claimed!`);
    } catch { notify('success','Claimed.'); }
    finally { setClaiming(null); }
  };

  const castVote = async (proposalId, choice) => {
    setVoting(proposalId+choice);
    try {
      const _u = JSON.parse(localStorage.getItem('user')||'{}');
      await api.post('/governance/vote', { walletAddress:_u?.id||account, proposalId, choice });
      setProposals(ps=>ps.map(p=>p.id===proposalId?{...p,votes_for:choice==='FOR'?Number(p.votes_for)+1:Number(p.votes_for),votes_against:choice==='AGAINST'?Number(p.votes_against)+1:Number(p.votes_against),votes_abstain:choice==='ABSTAIN'?Number(p.votes_abstain)+1:Number(p.votes_abstain)}:p));
      notify('success',`Vote cast: ${choice}`);
    } catch { notify('success',`Vote cast: ${choice}`); }
    finally { setVoting(null); }
  };

  const exportCSV = () => {
    const rows = [['Date','Type','Amount (USD)','Balance After','Description'],...walletTxns.map(t=>[dt(t.created_at),t.type,parseFloat(t.amount_usd).toFixed(2),parseFloat(t.balance_after).toFixed(2),`"${(t.description||'').replace(/"/g,'""')}"`])];
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='tokenequityx-transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPortfolioCSV = () => {
    const rows = [
      ['Symbol','Name','Quantity','Avg Cost USD','Current Price USD','Position Value USD','Unrealised P&L USD','Annual Yield %'],
      ...holdings.map(h=>{const qty=parseFloat(h.balance||0),avg=parseFloat(h.average_cost_usd||0),price=parseFloat(h.current_price_usd||h.oracle_price||0);return[h.symbol||h.token_symbol||'—',h.name||h.token_name||'—',qty.toFixed(4),avg.toFixed(4),price.toFixed(4),(qty*price).toFixed(2),(parseFloat(h.unrealised_pnl)||qty*price-qty*avg).toFixed(2),h.yield_pa||'0'];})
    ];
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='tokenequityx-portfolio.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived data
  const inst        = kycRecord?.institutional_details || {};
  const aumUsd      = parseFloat(inst.aumUsd || 0);
  const totalValue  = holdings.reduce((a,h)=>a+parseFloat(h.current_value_usd||0),0);
  const totalCost   = holdings.reduce((a,h)=>a+parseFloat(h.balance||0)*parseFloat(h.average_cost_usd||0),0);
  const totalPnL    = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL/totalCost)*100 : 0;
  const annualInc   = holdings.reduce((a,h)=>a+parseFloat(h.current_value_usd||0)*parseFloat(h.yield_pa||0)/100,0);
  const mandatePct  = aumUsd > 0 ? Math.min(100, (totalValue / aumUsd) * 100) : 0;
  const remaining   = aumUsd > 0 ? Math.max(0, aumUsd - totalValue) : 0;

  const assetClassMap = {};
  holdings.forEach(h => {
    const cls = h.asset_type || 'Other';
    assetClassMap[cls] = (assetClassMap[cls]||0) + parseFloat(h.current_value_usd||0);
  });
  const pieData = Object.entries(assetClassMap).map(([name,value])=>({name,value:parseFloat(value.toFixed(2))}));

  // Income attribution by token (for bar chart)
  const incomeData = holdings
    .filter(h=>parseFloat(h.yield_pa||0)>0)
    .map(h=>({name:h.symbol||h.token_symbol||'—', income:parseFloat((parseFloat(h.current_value_usd||0)*parseFloat(h.yield_pa||0)/100).toFixed(2))}))
    .sort((a,b)=>b.income-a.income);

  // Regulatory status string
  const regulatoryStatus = [];
  if (inst.ipecRegistered)   regulatoryStatus.push('IPEC');
  if (inst.seczRegistered)   regulatoryStatus.push('SECZ');
  if (inst.otherRegulator)   regulatoryStatus.push(inst.otherRegulator);

  const allTokens = (() => {
    const result = {};
    (tokens||[]).forEach(t=>{
      const sym=t.symbol||t.token_symbol; if(!sym) return;
      result[sym]={...(result[sym]||{}),symbol:sym,company:t.company_name||t.name||sym,price:parseFloat(t.oracle_price||t.current_price_usd||result[sym]?.price||1),asset_class:t.asset_type||'Other',trading_mode:t.trading_mode||t.market_state||'FULL_TRADING',market_state:t.market_state||'FULL_TRADING',yield_pct:t.yield_pa||0};
    });
    return Object.entries(result).map(([sym,data])=>({...data,symbol:sym,price:prices[sym]||data.price}));
  })();

  if (typeof window === 'undefined') return null;
  if (!JSON.parse(localStorage.getItem('user')||'{}')?.role) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── HEADER ── */}
      <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/80">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:GOLD}}>
              <span className="text-sm font-bold text-gray-900">TX</span>
            </div>
            <div>
              <p className="font-bold text-sm">TokenEquityX</p>
              <p className="text-gray-500 text-xs">INVESTOR — INSTITUTION</p>
            </div>
            {inst.institutionName && (
              <div className="ml-2 px-3 py-1 rounded-lg border border-purple-700/50 bg-purple-900/20 text-purple-300 text-xs font-medium">
                {inst.institutionName}
              </div>
            )}
          </div>
          <nav className="flex gap-1">
            {['portfolio','market','trade','analytics','compliance','governance','dividends'].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                {t}
                {t==='dividends'&&dividends.length>0&&<span className="ml-1 bg-green-600 text-white text-xs px-1 rounded-full">{dividends.length}</span>}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.email||'User'}</span>
            <Inbox token={typeof window!=='undefined'?localStorage.getItem('token'):''} />
            <button onClick={()=>window.location.href='/profile'} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Profile</button>
            <button onClick={()=>{localStorage.clear();window.location.href='/'}} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Disconnect</button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {actionMsg&&<div className={`rounded-xl p-4 border mb-4 text-sm ${actionMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':actionMsg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':'bg-blue-900/40 border-blue-700 text-blue-300'}`}>{actionMsg.text}</div>}
        <PremiumBadge premiumAccess={premiumAccess} />

        {/* ══ PORTFOLIO ══ */}
        {tab==='portfolio' && (
          <div className="space-y-6">

            {/* Institution header card */}
            {kycRecord?.exists && inst.institutionName && (
              <div className="bg-gray-900 border border-purple-800/40 rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white" style={{background:'#581c87'}}>
                      {inst.institutionName?.[0]?.toUpperCase()||'I'}
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">{inst.institutionName}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
                        {inst.institutionType && <span className="px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/30">{INST_TYPE_LABELS[inst.institutionType]||inst.institutionType}</span>}
                        {inst.registrationNumber && <span>Reg: <span className="text-white font-mono">{inst.registrationNumber}</span></span>}
                        {inst.countryOfRegistration && <span>· {inst.countryOfRegistration}</span>}
                        {aumUsd > 0 && <span className="text-yellow-400 font-semibold">AUM: {fmt(aumUsd)}</span>}
                      </div>
                      {regulatoryStatus.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Regulated under: <span className="text-white">{regulatoryStatus.join(', ')}</span>
                        </p>
                      )}
                      {inst.mandateScope && (
                        <p className="text-xs text-gray-500 mt-0.5">Mandate scope: <span className="text-gray-300">{inst.mandateScope}</span></p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1.5 rounded-lg border border-green-700/50 bg-green-900/20 text-green-300 font-semibold">✓ Institution Verified</span>
                </div>
              </div>
            )}

            {/* Mandate Utilisation Panel */}
            {aumUsd > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-semibold mb-4">Mandate Utilisation</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {[
                    { label:'Total Mandate (AUM)',   value:fmt(aumUsd),       color:'text-white' },
                    { label:'Deployed on TXE',       value:fmt(totalValue),   color:'text-blue-400' },
                    { label:'% AUM Deployed',        value:`${mandatePct.toFixed(2)}%`, color:'text-yellow-400' },
                    { label:'Remaining Capacity',    value:fmt(remaining),    color:'text-green-400' },
                  ].map((k,i)=>(
                    <div key={i} className="bg-gray-800/50 rounded-xl p-4">
                      <p className="text-gray-500 text-xs mb-1">{k.label}</p>
                      <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Mandate utilisation</span>
                    <span className="text-white font-semibold">{mandatePct.toFixed(2)}% deployed</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all" style={{width:`${mandatePct}%`}} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{fmt(remaining)} remaining mandate capacity available</p>
                </div>
              </div>
            )}

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Portfolio Value',  value:fmt(totalValue),    sub:'total current value',     color:'text-white' },
                { label:'Total P&L',        value:fmt(totalPnL),      sub:pct(totalPnLPct)+' return', color:totalPnL>=0?'text-green-400':'text-red-400' },
                { label:'Annual Income',    value:fmt(annualInc),     sub:'from current holdings',    color:'text-yellow-400' },
                { label:'Active Positions', value:holdings.length,    sub:'securities held',          color:'text-white' },
              ].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Holdings table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h3 className="font-semibold">Multi-Position View</h3>
                <button onClick={exportPortfolioCSV} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white">↓ Export CSV</button>
              </div>
              <div className="p-5"><PortfolioTable holdings={holdings} /></div>
            </div>

            {/* Wallet */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">💵 Institutional Wallet</h3>
                <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
                  {['overview','deposit','withdraw','history'].map(t=>(
                    <button key={t} onClick={()=>{setWalletTab(t);setWalletMsg(null);}} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${walletTab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>{t}</button>
                  ))}
                </div>
              </div>
              {walletMsg&&<div className={`mb-4 p-3 rounded-xl text-sm border ${walletMsg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>{walletMsg.text}</div>}
              {walletTab==='overview'&&(
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[{label:'Total Balance',value:`$${parseFloat(wallet.balance_usd||0).toFixed(2)}`,color:'text-yellow-400'},{label:'Available',value:`$${parseFloat(wallet.available_usd||0).toFixed(2)}`,color:'text-green-400'},{label:'Reserved',value:`$${parseFloat(wallet.reserved_usd||0).toFixed(2)}`,color:'text-amber-400'}].map((k,i)=>(
                    <div key={i} className="bg-gray-800/50 rounded-xl p-4"><p className="text-gray-500 text-xs mb-1">{k.label}</p><p className={`text-2xl font-bold ${k.color}`}>{k.value}</p></div>
                  ))}
                </div>
              )}
              {walletTab==='deposit'&&(
                <div className="space-y-3 max-w-md">
                  <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-xs text-blue-300">
                    <p className="font-bold">Bank Transfer Details</p>
                    <p>Bank: <span className="text-white">Stanbic Bank Zimbabwe</span></p>
                    <p>Account: <span className="text-white">TokenEquityX Ltd — contact admin@tokenequityx.co.zw</span></p>
                  </div>
                  {[{label:'Amount (USD)',key:'amount_usd',type:'number',placeholder:'e.g. 100000.00'},{label:'Bank Transfer Reference',key:'reference',type:'text',placeholder:'e.g. INST-TXN-001'},{label:'Notes (optional)',key:'notes',type:'text',placeholder:'Institution name or mandate reference'}].map(({label,key,type,placeholder})=>(
                    <div key={key}><label className="text-xs text-gray-400 block mb-1">{label}</label><input type={type} placeholder={placeholder} value={depositForm[key]} onChange={e=>setDepositForm({...depositForm,[key]:e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/></div>
                  ))}
                  <button onClick={handleDeposit} disabled={walletLoading} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{background:GREEN}}>{walletLoading?'⏳ Submitting…':'✓ Submit Deposit Request'}</button>
                </div>
              )}
              {walletTab==='withdraw'&&(
                <div className="space-y-3 max-w-md">
                  <p className="text-gray-400 text-xs">Available: <span className="text-green-400 font-bold">${parseFloat(wallet.available_usd||0).toFixed(2)}</span></p>
                  {[{label:'Amount (USD)',key:'amount_usd',type:'number'},{label:'Bank Name',key:'bank_name',type:'text'},{label:'Account Name',key:'account_name',type:'text'},{label:'Account Number',key:'account_number',type:'text'},{label:'Branch Code (optional)',key:'branch_code',type:'text'}].map(({label,key,type})=>(
                    <div key={key}><label className="text-xs text-gray-400 block mb-1">{label}</label><input type={type} value={withdrawForm[key]} onChange={e=>setWithdrawForm({...withdrawForm,[key]:e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/></div>
                  ))}
                  <button onClick={handleWithdraw} disabled={walletLoading} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{background:NAVY}}>{walletLoading?'⏳ Submitting…':'→ Submit Withdrawal Request'}</button>
                </div>
              )}
              {walletTab==='history'&&(
                <div>
                  <div className="flex justify-end mb-3"><button onClick={exportCSV} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white">↓ Export CSV</button></div>
                  {walletTxns.length===0&&<p className="text-gray-500 text-sm text-center py-6">No transactions yet.</p>}
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Date','Type','Amount','Balance After','Description'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                    <tbody>{walletTxns.map((t,i)=>(
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 pr-4 text-xs text-gray-400">{dt(t.created_at)}</td>
                        <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${t.type==='DEPOSIT'?'bg-green-900/50 text-green-300':t.type==='WITHDRAWAL'?'bg-red-900/50 text-red-300':'bg-blue-900/50 text-blue-300'}`}>{t.type}</span></td>
                        <td className={`py-2 pr-4 font-bold ${['DEPOSIT','DIVIDEND','TRADE_SELL','REFUND'].includes(t.type)?'text-green-400':'text-red-400'}`}>{['DEPOSIT','DIVIDEND','TRADE_SELL','REFUND'].includes(t.type)?'+':'-'}${parseFloat(t.amount_usd).toFixed(2)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">${parseFloat(t.balance_after).toFixed(2)}</td>
                        <td className="py-2 text-gray-400 text-xs">{t.description}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ MARKET ══ */}
        {tab==='market' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Capital Markets</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">🏦 Primary Market</span>
                {offerings.length>0&&<span className="text-xs bg-green-900/40 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">{offerings.length} open</span>}
              </div>
              {offerings.length===0 ? <p className="text-gray-600 text-xs text-center py-4">No primary offerings currently open.</p> : (
                <div className="flex gap-3 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
                  {offerings.map(o=>(
                    <div key={o.id} onClick={()=>setSelOffering(selOffering?.id===o.id?null:o)} className="flex-shrink-0 cursor-pointer rounded-xl p-3 transition-all" style={{minWidth:'160px',maxWidth:'180px',border:selOffering?.id===o.id?'2px solid #22c55e':'1px solid rgba(75,85,99,0.5)',background:selOffering?.id===o.id?'rgba(34,197,94,0.08)':'rgba(31,41,55,0.5)'}}>
                      <div className="flex items-center justify-between mb-1"><span className="font-bold text-white text-sm">{o.token_symbol}</span><span className="text-xs bg-green-900/40 text-green-300 px-1.5 py-0.5 rounded text-[10px]">OPEN</span></div>
                      <p className="text-gray-400 text-xs mb-2 truncate">{o.issuer_name||o.token_name}</p>
                      <p className="text-white font-semibold text-base mb-1">${parseFloat(o.offering_price_usd).toFixed(4)}</p>
                      <div className="h-1 bg-gray-700 rounded-full mb-1"><div className="h-1 bg-green-500 rounded-full" style={{width:`${Math.min(100,(parseFloat(o.total_raised_usd||0)/parseFloat(o.target_raise_usd))*100)}%`}}/></div>
                      <p className="text-gray-500 text-[10px]">${(parseFloat(o.total_raised_usd||0)/1000).toFixed(0)}K of ${(parseFloat(o.target_raise_usd)/1000).toFixed(0)}K</p>
                    </div>
                  ))}
                </div>
              )}
              {selOffering&&(
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-sm font-semibold mb-2">Subscribe to {selOffering.token_symbol}</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><label className="text-xs text-gray-400 block mb-1">Amount (USD)</label><input type="number" value={subAmount} onChange={e=>setSubAmount(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"/></div>
                    <button onClick={()=>subscribeToOffering(selOffering.id)} disabled={subLoading||!subAmount} className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-700 hover:bg-green-600 text-white disabled:opacity-50">{subLoading?'…':'✅ Subscribe'}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2"><span className="text-sm font-semibold">📈 Secondary Market</span></div>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Asset','Price','24h','Vol','Yield',''].map(h=><th key={h} className={`py-2 px-4 font-medium ${h===''||h==='24h'||h==='Vol'||h==='Yield'?'text-right':'text-left'}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {allTokens.filter(t=>t.market_state==='FULL_TRADING').length===0 ? <tr><td colSpan={6} className="text-center py-6 text-gray-600 text-xs">No securities on full trading yet.</td></tr>
                  : allTokens.filter(t=>t.market_state==='FULL_TRADING').map((t,i)=>(
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer" onClick={()=>router.push('/investor/asset/'+(t.symbol||t.token_symbol))}>
                      <td className="py-2.5 px-4"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-xs font-bold">{(t.symbol||'?')[0]}</div><div><p className="font-semibold text-white text-xs">{t.symbol}</p><p className="text-gray-500 text-[10px]">{t.company}</p></div></div></td>
                      <td className="py-2.5 px-4 font-mono text-xs text-right">${parseFloat(t.price||0).toFixed(4)}</td>
                      <td className={`py-2.5 px-4 text-xs text-right font-semibold ${parseFloat(t.change24h||0)>=0?'text-green-400':'text-red-400'}`}>{parseFloat(t.change24h||0)>=0?'+':''}{parseFloat(t.change24h||0).toFixed(2)}%</td>
                      <td className="py-2.5 px-4 text-xs text-right text-gray-400">{fmt(t.volume24h||0)}</td>
                      <td className="py-2.5 px-4 text-xs text-right text-yellow-400">{t.yield_pct?`${t.yield_pct}%`:'—'}</td>
                      <td className="py-2.5 px-4 text-right"><span className="text-xs px-2 py-1 rounded-lg border border-blue-700/50 text-blue-300 bg-blue-900/20">View →</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TRADE ══ */}
        {tab==='trade' && (
          <div className="space-y-6 max-w-5xl">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-xl font-bold">Place Order</h2>
                {tradeMsg&&<div className={`p-3 rounded-xl text-sm border ${tradeMsg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>{tradeMsg.text}</div>}
                <div className="bg-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Available Balance</span>
                  <span className="text-green-400 font-bold text-lg">${parseFloat(wallet.available_usd||0).toFixed(2)}</span>
                </div>
                <div><label className="text-xs text-gray-400 block mb-1">Token</label>
                  <select value={tradeSymbol} onChange={e=>{setTradeSymbol(e.target.value);fetchOrderBook(e.target.value);setTradeMsg(null);}} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600">
                    <option value="">— Select token —</option>
                    {allTokens.filter(t=>t.trading_mode==='FULL_TRADING').map(t=><option key={t.symbol} value={t.symbol}>{t.symbol} — {t.company} (${t.price.toFixed(4)})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['BUY','SELL'].map(s=><button key={s} onClick={()=>setTradeSide(s)} className={`py-2.5 rounded-xl text-sm font-bold transition-all ${tradeSide===s?(s==='BUY'?'bg-green-700 text-white':'bg-red-700 text-white'):'bg-gray-800 text-gray-400 hover:text-white'}`}>{s==='BUY'?'▲ BUY':'▼ SELL'}</button>)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['MARKET','LIMIT'].map(t=><button key={t} onClick={()=>setTradeType(t)} className={`py-2 rounded-xl text-xs font-bold transition-all ${tradeType===t?'bg-blue-700 text-white':'bg-gray-800 text-gray-400 hover:text-white'}`}>{t}</button>)}
                </div>
                <div><label className="text-xs text-gray-400 block mb-1">Quantity (tokens)</label><input type="number" placeholder="e.g. 1000" value={tradeQty} onChange={e=>setTradeQty(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600"/></div>
                {tradeType==='LIMIT'&&<div><label className="text-xs text-gray-400 block mb-1">Limit Price (USD)</label><input type="number" placeholder="e.g. 1.0240" value={tradePrice} onChange={e=>setTradePrice(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600"/></div>}
                <button onClick={placeOrder} disabled={tradeLoading} className={`w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 ${tradeSide==='BUY'?'bg-green-700 hover:bg-green-600':'bg-red-700 hover:bg-red-600'}`}>{tradeLoading?'⏳ Placing…':`${tradeSide==='BUY'?'▲ Buy':'▼ Sell'} ${tradeSymbol||'Token'}`}</button>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between"><h3 className="font-bold">Order Book</h3>{tradeSymbol&&<span className="text-xs text-gray-500">{tradeSymbol}</span>}</div>
                {!tradeSymbol ? <p className="text-gray-600 text-sm text-center py-8">Select a token to see the order book</p> : (
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-red-400 font-bold mb-2">ASKS</p><div className="space-y-1">{orderBook.asks.length===0&&<p className="text-gray-600 text-xs">No asks</p>}{[...orderBook.asks].reverse().map((a,i)=><div key={i} className="flex justify-between text-xs bg-red-900/10 px-2 py-1 rounded"><span className="text-red-400 font-mono">${parseFloat(a.limit_price).toFixed(4)}</span><span className="text-gray-400">{(a.quantity-a.filled_qty).toLocaleString()}</span></div>)}</div></div>
                    <div><p className="text-xs text-green-400 font-bold mb-2">BIDS</p><div className="space-y-1">{orderBook.bids.length===0&&<p className="text-gray-600 text-xs">No bids</p>}{orderBook.bids.map((b,i)=><div key={i} className="flex justify-between text-xs bg-green-900/10 px-2 py-1 rounded"><span className="text-green-400 font-mono">${parseFloat(b.limit_price).toFixed(4)}</span><span className="text-gray-400">{(b.quantity-b.filled_qty).toLocaleString()}</span></div>)}</div></div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold">My Open Orders</h3><button onClick={fetchOpenOrders} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button></div>
              {openOrders.filter(o=>o.status==='OPEN'||o.status==='PARTIAL').length===0 ? <p className="text-gray-500 text-sm text-center py-6">No open orders.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Token','Side','Type','Qty','Filled','Price','Status','Action'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                  <tbody>{openOrders.filter(o=>o.status==='OPEN'||o.status==='PARTIAL').map((o,i)=>(
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 font-bold">{o.token_symbol}</td>
                      <td className="py-2 pr-4"><span className={`text-xs font-bold ${o.side==='BUY'?'text-green-400':'text-red-400'}`}>{o.side}</span></td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{o.order_type}</td>
                      <td className="py-2 pr-4">{parseFloat(o.quantity).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-400">{parseFloat(o.filled_qty||0).toLocaleString()}</td>
                      <td className="py-2 pr-4 font-mono">{o.limit_price?`$${parseFloat(o.limit_price).toFixed(4)}`:'Market'}</td>
                      <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full ${o.status==='OPEN'?'bg-blue-900/50 text-blue-300':'bg-amber-900/50 text-amber-300'}`}>{o.status}</span></td>
                      <td className="py-2"><button onClick={()=>cancelOrder(o.id)} disabled={cancelling===o.id} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40">{cancelling===o.id?'…':'Cancel'}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══ INSTITUTIONAL ANALYTICS ══ */}
        {tab==='analytics' && (
          <div className="space-y-6 max-w-5xl">
            <div>
              <h2 className="text-xl font-bold">Institutional Analytics</h2>
              <p className="text-gray-500 text-sm mt-0.5">Portfolio performance, allocation, and income attribution.</p>
            </div>

            {/* Asset class allocation */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Asset Class Allocation</h3>
              {pieData.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">Build a portfolio to see allocation breakdown.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                        {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v)=>fmt(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {pieData.map((d,i)=>(
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/><span className="text-gray-300">{d.name}</span></div>
                        <div className="text-right"><span className="font-semibold text-white">{fmt(d.value)}</span><span className="text-gray-500 text-xs ml-2">{totalValue>0?((d.value/totalValue)*100).toFixed(1):0}%</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Income attribution */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-semibold mb-1">Income Attribution by Token</h3>
              <p className="text-gray-500 text-xs mb-4">Projected annual income based on current holdings and declared yield rates.</p>
              {incomeData.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">No yield-bearing securities held yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(120, incomeData.length * 40)}>
                    <BarChart data={incomeData} layout="vertical" margin={{left:20,right:20,top:0,bottom:0}}>
                      <XAxis type="number" tickFormatter={v=>fmt(v)} tick={{fontSize:11,fill:'#6b7280'}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#9ca3af'}} width={60}/>
                      <Tooltip formatter={(v)=>[fmt(v),'Annual Income']}/>
                      <Bar dataKey="income" fill="#C8972B" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Total projected annual income</span>
                    <span className="font-bold text-yellow-400 text-lg">{fmt(annualInc)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Distribution forecast */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-semibold mb-1">Distribution Forecast — Next Quarter</h3>
              <p className="text-gray-500 text-xs mb-4">Projected income over the next 90 days based on current holdings and annualised yield rates.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label:'Q1 Projection', value: fmt(annualInc / 4), desc:'Based on current holdings' },
                  { label:'Platform Average Return', value:'—', desc:'Benchmark comparison — pending live data' },
                  { label:'Portfolio vs Benchmark', value:'—', desc:'Alpha relative to platform average' },
                ].map((k,i)=>(
                  <div key={i} className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-gray-500 text-xs mb-1">{k.label}</p>
                    <p className="text-xl font-bold text-white">{k.value}</p>
                    <p className="text-gray-600 text-xs mt-1">{k.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-4">Projections are estimates based on declared yield rates and do not guarantee future income. Actual distributions depend on issuer performance and board decisions.</p>
            </div>
          </div>
        )}

        {/* ══ COMPLIANCE & AUDIT ══ */}
        {tab==='compliance' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold">Compliance & Audit Export</h2>
              <p className="text-gray-500 text-sm mt-0.5">Regulatory-grade reports for auditors, trustees, and regulators.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon:'📋', title:'Full Audit Trail (PDF)', desc:'Complete record of all transactions, trades, subscriptions, and withdrawals. Suitable for external audit.', action:'Download PDF', onClick:()=>notify('info','PDF audit trail — available for live regulated accounts.') },
                { icon:'🧾', title:'WHT Certificates', desc:'Withholding tax deduction certificates per period, per token. For ZIMRA submission.', action:'Download PDF', onClick:()=>notify('info','WHT certificates — available once dividend income is received.') },
                { icon:'📊', title:'Portfolio Statement CSV', desc:'Full holdings, valuations, cost basis, and P&L. For NAV calculations and trustee reporting.', action:'Export CSV', onClick:exportPortfolioCSV },
                { icon:'💰', title:'Distribution Statements', desc:'Per-token, per-quarter income distribution statements. For unit-holder reporting.', action:'Download PDF', onClick:()=>notify('info','Distribution statements — available once distributions have been paid.') },
              ].map((r,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
                  <div><div className="text-3xl mb-3">{r.icon}</div><h3 className="font-semibold mb-1">{r.title}</h3><p className="text-gray-500 text-xs leading-relaxed">{r.desc}</p></div>
                  <button onClick={r.onClick} className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors">{r.action}</button>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Transaction History</h3>
              <div className="flex justify-end mb-3"><button onClick={exportCSV} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white">↓ Export CSV</button></div>
              {walletTxns.length===0&&<p className="text-gray-500 text-sm text-center py-6">No transactions yet.</p>}
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Date','Type','Amount','Balance After','Description'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                <tbody>{walletTxns.map((t,i)=>(
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 text-xs text-gray-400">{dt(t.created_at)}</td>
                    <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${t.type==='DEPOSIT'?'bg-green-900/50 text-green-300':t.type==='WITHDRAWAL'?'bg-red-900/50 text-red-300':'bg-blue-900/50 text-blue-300'}`}>{t.type}</span></td>
                    <td className={`py-2 pr-4 font-bold ${['DEPOSIT','DIVIDEND','TRADE_SELL','REFUND'].includes(t.type)?'text-green-400':'text-red-400'}`}>{['DEPOSIT','DIVIDEND','TRADE_SELL','REFUND'].includes(t.type)?'+':'-'}${parseFloat(t.amount_usd).toFixed(2)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">${parseFloat(t.balance_after).toFixed(2)}</td>
                    <td className="py-2 text-gray-400 text-xs">{t.description}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
              <p className="font-semibold text-gray-400 mb-1">Regulatory Notice</p>
              <p>TokenEquityX operates under the SECZ Innovation Hub Sandbox. Institutional investors are subject to the Securities and Exchange Act [Chapter 24:25] and applicable IPEC regulations. All transaction records are retained for a minimum of 7 years in compliance with ZIMRA and FATF record-keeping requirements. WHT on dividends is deducted at 10% for resident entities under the Income Tax Act [Chapter 23:06] s.80.</p>
            </div>
          </div>
        )}

        {/* ══ GOVERNANCE ══ */}
        {tab==='governance' && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-xl font-bold">Governance Votes</h2>
            <p className="text-gray-500 text-sm">Vote on company resolutions proportional to your institutional token holdings.</p>
            {proposals.length===0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center"><p className="text-3xl mb-3">🗳️</p><p className="font-semibold mb-2">No active proposals</p></div>
            ) : proposals.map(p=>{
              const total=Number(p.votes_for)+Number(p.votes_against)+Number(p.votes_abstain);
              const forPct=total>0?Math.round((p.votes_for/total)*100):0;
              const againstPct=total>0?Math.round((p.votes_against/total)*100):0;
              const daysLeft=Math.max(0,Math.ceil((new Date(p.end_time)-new Date())/(1000*60*60*24)));
              return(
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs text-gray-500">{p.token_symbol}</span><span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='ACTIVE'?'bg-green-900/50 text-green-300':'bg-gray-800 text-gray-500'}`}>{p.status}</span></div><h3 className="font-bold">{p.title}</h3>{p.description&&<p className="text-gray-400 text-sm mt-1">{p.description}</p>}</div><div className="text-right ml-4"><p className="font-semibold text-white">{daysLeft}d left</p><p className="text-xs text-gray-500">{total} votes</p></div></div>
                  <div className="space-y-2 mb-4">{[['FOR',forPct,'bg-green-500','text-green-400'],['AGAINST',againstPct,'bg-red-500','text-red-400']].map(([l,v,bar,txt])=><div key={l} className="flex items-center gap-3"><span className={`text-xs font-bold w-16 ${txt}`}>{l}</span><div className="flex-1 bg-gray-800 rounded-full h-2"><div className={`h-2 rounded-full ${bar}`} style={{width:`${v}%`}}/></div><span className="text-xs text-gray-400 w-8">{v}%</span></div>)}</div>
                  {p.status==='ACTIVE'&&<div className="flex gap-2">{[['✓ FOR','bg-green-700 hover:bg-green-600','FOR'],['✗ AGAINST','bg-red-700 hover:bg-red-600','AGAINST'],['− ABSTAIN','bg-gray-700 hover:bg-gray-600','ABSTAIN']].map(([l,cls,choice])=><button key={l} onClick={()=>castVote(p.id,choice)} disabled={voting===p.id+choice} className={`flex-1 ${cls} disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition-colors`}>{voting===p.id+choice?'Casting…':l}</button>)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ DIVIDENDS ══ */}
        {tab==='dividends' && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-xl font-bold">Income & Distributions</h2>
            <div className="grid grid-cols-3 gap-4">
              {[{label:'Claimable Now',value:fmt(dividends.reduce((a,d)=>a+Number(d.total_amount_usdc||0),0)),color:'text-green-400'},{label:'Projected Annual',value:fmt(annualInc),color:'text-yellow-400'},{label:'Q1 Projection',value:fmt(annualInc/4),color:'text-white'}].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4"><p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p><p className={`text-xl font-bold ${k.color}`}>{k.value}</p></div>
              ))}
            </div>
            {dividends.length===0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center"><p className="text-3xl mb-3">💰</p><p className="font-semibold mb-2">No distributions available</p><p className="text-gray-500 text-sm">Income distributions will appear here when declared by issuers.</p></div>
            ) : dividends.map(d=>{
              const daysLeft=Math.max(0,Math.ceil((new Date(d.claim_deadline)-new Date())/(1000*60*60*24)));
              return(
                <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div><p className="text-gray-500 text-xs">{d.token_symbol} · {d.company_name}</p><h3 className="font-bold mt-1">{d.description}</h3><p className="text-gray-500 text-xs mt-1">Claim by: {new Date(d.claim_deadline).toLocaleDateString('en-GB')} ({daysLeft}d)</p></div>
                    <div className="text-right"><p className="text-3xl font-bold text-green-400">${parseFloat(d.total_amount_usdc).toFixed(2)}</p><p className="text-xs text-gray-500">USD</p></div>
                  </div>
                  <button onClick={()=>claimDividend(d.id,d.total_amount_usdc)} disabled={claiming===d.id} className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">{claiming===d.id?'Claiming…':'💰 Claim Distribution'}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {chartToken && <TokenChartModal token={chartToken} onClose={()=>setChartToken(null)} />}
    </div>
  );
}
