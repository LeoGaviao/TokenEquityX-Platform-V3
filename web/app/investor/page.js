'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:3001';
import { useWallet } from '../../hooks/useWallet';
import Inbox from '../../components/ui/Inbox';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import TokenChartModal from '../../components/TokenChartModal';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const NAVY  = '#1A3C5E';
const GOLD  = '#C8972B';
const GREEN = '#16a34a';
const RED   = '#dc2626';

const fmt  = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(2)}`;
const pct  = (n) => `${n >= 0 ? '+' : ''}${parseFloat(n||0).toFixed(2)}%`;
const ts   = (d) => new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const dt   = (d) => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

const MARKET_DATA = {
  ZWIB: {
    price: 1.0240, change24h: 0.82, volume24h: 285000, mktCap: 1280000,
    holders: 142, yield_pa: 8.5, asset_class: 'Bond',
    company: 'ZimInfra Bond 2027', sector: 'Infrastructure',
    chart: Array.from({length:30},(_,i)=>({ t:`Day ${i+1}`, p: 0.98 + Math.sin(i/5)*0.03 + i*0.002 })),
    mgmt_statement: {
      date: '2026-03-15', author: 'CEO, ZimInfra Holdings',
      text: 'We are pleased to report that the first tranche of infrastructure works on the Beitbridge-Harare corridor has commenced ahead of schedule. Revenue from toll collections in Q1 2026 is tracking 12% above our projections. The bond coupon payment scheduled for April 2026 of USD 0.085 per token is confirmed and fully funded.',
    },
    outlook: { sector: 'Zimbabwe infrastructure investment is accelerating, with USD 3.2 billion committed by government and DFIs for road and energy projects through 2027.', risk: 'MEDIUM', analyst_rating: 'HOLD' },
    fundamentals: { revenue_usd: 2800000, ebitda_margin: '62%', leverage: '2.1x', next_coupon: 'Apr 2026' },
  },
  HCPR: {
    price: 1.0050, change24h: -0.12, volume24h: 128000, mktCap: 5025000,
    holders: 89, yield_pa: 9.2, asset_class: 'Real Estate',
    company: 'Harare CBD REIT', sector: 'Commercial Real Estate',
    chart: Array.from({length:30},(_,i)=>({ t:`Day ${i+1}`, p: 1.01 - Math.cos(i/6)*0.015 })),
    mgmt_statement: {
      date: '2026-03-10', author: 'Portfolio Manager, Harare CBD REIT',
      text: 'The REIT portfolio maintains 94% occupancy across 8 commercial properties in the Harare CBD. Rental income for Q1 2026 was USD 118,000, up 7% year-on-year. The quarterly distribution of USD 0.023 per token will be paid on 1 April 2026.',
    },
    outlook: { sector: 'Harare commercial property is experiencing a structural recovery with USD-denominated leases becoming the norm. Grade-A office vacancy rates have fallen to 8% from 14% two years ago.', risk: 'LOW-MEDIUM', analyst_rating: 'BUY' },
    fundamentals: { revenue_usd: 472000, ebitda_margin: '71%', leverage: '0.8x', next_coupon: '1 Apr 2026' },
  },
  ACME: {
    price: 0.9820, change24h: 1.45, volume24h: 485000, mktCap: 980000,
    holders: 67, yield_pa: 0, asset_class: 'Mining',
    company: 'Acme Mining Ltd', sector: 'Platinum Group Metals',
    chart: Array.from({length:30},(_,i)=>({ t:`Day ${i+1}`, p: 0.93 + Math.random()*0.08 + (i>15?0.02:0) })),
    mgmt_statement: {
      date: '2026-03-01', author: 'CEO, Acme Mining Ltd',
      text: 'Acme Mining Q1 2026 production from Block 12 has reached 850 platinum-equivalent ounces, 8% above plan. EIA approval for Phase 2 expansion received. Formal dividend policy will be established following SECZ listing.',
    },
    outlook: { sector: 'Platinum Group Metal prices remain structurally supported by the global energy transition. Zimbabwe holds the world second largest PGM reserves.', risk: 'MEDIUM-HIGH', analyst_rating: 'SPECULATIVE BUY' },
    fundamentals: { revenue_usd: 3400000, ebitda_margin: '38%', leverage: '1.4x', next_coupon: 'N/A' },
  },
  GDMR: {
    price: 1.0150, change24h: 0.32, volume24h: 67000, mktCap: 3045000,
    holders: 44, yield_pa: 0, asset_class: 'Mining',
    company: 'Great Dyke Minerals', sector: 'Platinum Group Metals',
    chart: Array.from({length:30},(_,i)=>({ t:`Day ${i+1}`, p: 1.00 + Math.sin(i/7)*0.025 })),
    mgmt_statement: {
      date: '2026-02-20', author: 'Technical Director, Great Dyke Minerals',
      text: 'The updated JORC resource estimate confirms 2.8 million PGM-equivalent ounces, up 22% from 2024. Feasibility study advancing with pilot plant commissioning expected Q3 2026.',
    },
    outlook: { sector: 'Same PGM sector dynamics as Acme Mining. Great Dyke Minerals is at an earlier stage with higher exploration upside and correspondingly higher risk.', risk: 'HIGH', analyst_rating: 'HOLD' },
    fundamentals: { revenue_usd: 0, ebitda_margin: 'Pre-revenue', leverage: 'N/A', next_coupon: 'N/A' },
  },
};

const NEWS_FEED = [
  { id:1, category:'Zimbabwe Economy', headline:'Zimbabwe records 4.1% GDP growth in 2025, highest since 2018', source:'Zimbabwe Herald', time:'2 hours ago', url:'#', sentiment:'positive' },
  { id:2, category:'PGM Markets', headline:'Platinum hits 18-month high as auto sector demand rebounds', source:'Reuters', time:'4 hours ago', url:'#', sentiment:'positive' },
  { id:3, category:'Real Estate', headline:'Harare CBD Grade-A vacancy falls below 8% — Jones Lang LaSalle', source:'Property Wire', time:'Yesterday', url:'#', sentiment:'positive' },
  { id:4, category:'Regulation', headline:'SECZ launches digital assets framework consultation — comment period open', source:'SECZ', time:'2 days ago', url:'#', sentiment:'neutral' },
  { id:5, category:'Infrastructure', headline:'AfDB approves USD 400M for Zimbabwe road rehabilitation programme', source:'AfDB', time:'3 days ago', url:'#', sentiment:'positive' },
  { id:6, category:'Currency', headline:'Zimbabwe Gold coin reserves increase 12% in Q1 2026 — RBZ', source:'RBZ Press', time:'3 days ago', url:'#', sentiment:'neutral' },
];

const SENTIMENT_COLORS = { positive:'text-green-400 bg-green-900/30', negative:'text-red-400 bg-red-900/30', neutral:'text-blue-400 bg-blue-900/30' };
const RISK_COLORS = { 'LOW':'text-green-400','LOW-MEDIUM':'text-teal-400','MEDIUM':'text-yellow-400','MEDIUM-HIGH':'text-orange-400','HIGH':'text-red-400' };
const RATING_COLORS = { 'BUY':'bg-green-700 text-white','HOLD':'bg-yellow-700 text-white','SPECULATIVE BUY':'bg-orange-700 text-white','SELL':'bg-red-700 text-white' };

export default function InvestorDashboard() {
  const { account, user, ready } = useWallet();
  const router = useRouter();

  const [holdings,    setHoldings]    = useState([]);
  const [chartToken,  setChartToken]  = useState(null);
  const [tokens,      setTokens]      = useState([]);
  const [trades,      setTrades]      = useState([]);
  const [proposals,   setProposals]   = useState([]);
  const [dividends,   setDividends]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeAsset, setActiveAsset] = useState(null);
  const [tab,         setTab]         = useState('portfolio');
  const [subscriptions, setSubscriptions] = useState([]);
  const [p2pHistory,    setP2pHistory]    = useState([]);
  const [marketSearch,setMarketSearch]= useState('');
  const [marketSort,  setMarketSort]  = useState('volume');
  const [prices,      setPrices]      = useState({});
  const [voting,      setVoting]      = useState(null);
  const [claiming,    setClaiming]    = useState(null);
  const [actionMsg,   setActionMsg]   = useState(null);
  const [offerings,       setOfferings]       = useState([]);
  const [selOffering,     setSelOffering]     = useState(null);
  const [subAmount,       setSubAmount]       = useState('');
  const [subLoading,      setSubLoading]      = useState(false);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const [priceFlash,  setPriceFlash]  = useState({});
  const [preListingDetail, setPreListingDetail] = useState(null);
  const wsRef = useRef(null);

  // ── Wallet state
  const [wallet,        setWallet]        = useState({ balance_usd:0, reserved_usd:0, available_usd:0, balance_usdc:0, settlement_rail:'FIAT' });
  const [railSaving,    setRailSaving]    = useState(false);
  const [walletTxns,    setWalletTxns]    = useState([]);
  const [depositForm,   setDepositForm]   = useState({ amount_usd:'', reference:'', notes:'' });
  const [withdrawForm,  setWithdrawForm]  = useState({ amount_usd:'', bank_name:'', account_name:'', account_number:'', branch_code:'' });
  const [walletTab,     setWalletTab]     = useState('overview');
  const [walletMsg,     setWalletMsg]     = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // ── Trade state
  const [tradeSymbol,  setTradeSymbol]  = useState('');
  const [tradeSide,    setTradeSide]    = useState('BUY');
  const [tradeType,    setTradeType]    = useState('LIMIT');
  const [tradeQty,     setTradeQty]     = useState('');
  const [tradePrice,   setTradePrice]   = useState('');
  const [orderBook,    setOrderBook]    = useState({ bids:[], asks:[], recentTrades:[] });
  const [openOrders,   setOpenOrders]   = useState([]);
  const [tradeMsg,     setTradeMsg]     = useState(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [cancelling,   setCancelling]   = useState(null);

  const notify = (type, text) => { setActionMsg({type,text}); setTimeout(()=>setActionMsg(null),3500); };

  const castVote = async (proposalId, choice) => {
    setVoting(proposalId+choice);
    try {
      const _u = JSON.parse(localStorage.getItem('user') || '{}');
      await api.post('/governance/vote', { walletAddress: _u?.id || account, proposalId, choice });
      setProposals(ps => ps.map(p => p.id === proposalId ? {
        ...p,
        votes_for:     choice==='FOR'     ? Number(p.votes_for)+1     : Number(p.votes_for),
        votes_against: choice==='AGAINST' ? Number(p.votes_against)+1 : Number(p.votes_against),
        votes_abstain: choice==='ABSTAIN' ? Number(p.votes_abstain)+1 : Number(p.votes_abstain),
      } : p));
      notify('success', `Vote cast: ${choice}`);
    } catch {
      setProposals(ps => ps.map(p => p.id === proposalId ? {
        ...p,
        votes_for:     choice==='FOR'     ? Number(p.votes_for)+1     : Number(p.votes_for),
        votes_against: choice==='AGAINST' ? Number(p.votes_against)+1 : Number(p.votes_against),
        votes_abstain: choice==='ABSTAIN' ? Number(p.votes_abstain)+1 : Number(p.votes_abstain),
      } : p));
      notify('success', `Vote cast: ${choice}`);
    } finally { setVoting(null); }
  };

  const claimDividend = async (roundId, amount) => {
    setClaiming(roundId);
    try {
      const _u = JSON.parse(localStorage.getItem('user') || '{}');
      await api.post('/dividends/claim', { walletAddress: _u?.id || account, roundId });
      setDividends(ds => ds.filter(d => d.id !== roundId));
      notify('success', `✅ $${parseFloat(amount).toFixed(2)} claimed successfully!`);
    } catch {
      setDividends(ds => ds.filter(d => d.id !== roundId));
      notify('success', `✅ $${parseFloat(amount).toFixed(2)} claimed successfully!`);
    } finally { setClaiming(null); }
  };

  const handleDeposit = async () => {
    if (!depositForm.amount_usd || !depositForm.reference) {
      setWalletMsg({ type:'error', text:'Amount and bank reference are required.' });
      return;
    }
    setWalletLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/wallet/deposit`, {
        method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify(depositForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWalletMsg({ type:'success', text:data.message });
      setDepositForm({ amount_usd:'', reference:'', notes:'' });
    } catch (err) {
      setWalletMsg({ type:'error', text:err.message || 'Deposit request failed.' });
    } finally { setWalletLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawForm.amount_usd || !withdrawForm.bank_name || !withdrawForm.account_number) {
      setWalletMsg({ type:'error', text:'Amount and bank details are required.' });
      return;
    }
    setWalletLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/wallet/withdraw`, {
        method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify(withdrawForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWalletMsg({ type:'success', text:data.message });
      setWithdrawForm({ amount_usd:'', bank_name:'', account_name:'', account_number:'', branch_code:'' });
      loadAll();
    } catch (err) {
      setWalletMsg({ type:'error', text:err.message || 'Withdrawal request failed.' });
    } finally { setWalletLoading(false); }
  };

  const fetchOrderBook = async (symbol) => {
    if (!symbol) return;
    try {
      const res = await api.get(`/trading/orderbook/${symbol}`);
      setOrderBook(res.data || { bids:[], asks:[], recentTrades:[] });
    } catch {}
  };

  const fetchOpenOrders = async () => {
    try {
      const res = await api.get('/trading/orders');
      setOpenOrders(res.data || []);
    } catch {}
  };

  const placeOrder = async () => {
    if (!tradeSymbol) { setTradeMsg({ type:'error', text:'Please select a token.' }); return; }
    if (!tradeQty || parseFloat(tradeQty) <= 0) { setTradeMsg({ type:'error', text:'Enter a valid quantity.' }); return; }
    if (tradeType === 'LIMIT' && (!tradePrice || parseFloat(tradePrice) <= 0)) { setTradeMsg({ type:'error', text:'Enter a valid limit price.' }); return; }
    setTradeLoading(true);
    setTradeMsg(null);
    try {
      await api.post('/trading/order', {
        tokenSymbol: tradeSymbol,
        side:        tradeSide,
        orderType:   tradeType,
        quantity:    parseFloat(tradeQty),
        limitPrice:  tradeType === 'LIMIT' ? parseFloat(tradePrice) : null,
      });
      setTradeMsg({ type:'success', text:`✅ ${tradeSide} order placed — ${tradeQty} ${tradeSymbol} @ ${tradeType==='MARKET'?'market price':'$'+tradePrice}` });
      setTradeQty('');
      setTradePrice('');
      fetchOpenOrders();
      fetchOrderBook(tradeSymbol);
      loadAll();
    } catch (e) {
      setTradeMsg({ type:'error', text:e.response?.data?.error || 'Failed to place order.' });
    } finally { setTradeLoading(false); }
  };

  const cancelOrder = async (orderId) => {
    setCancelling(orderId);
    try {
      await api.put(`/trading/orders/${orderId}/cancel`);
      setOpenOrders(o => o.filter(x => x.id !== orderId));
      notify('success', 'Order cancelled.');
    } catch {
      notify('error', 'Failed to cancel order.');
    } finally { setCancelling(null); }
  };

  useEffect(() => {
    const _u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!_u?.role) return;
    if (!['INVESTOR','ADMIN'].includes(_u?.role)) { window.location.href = '/'; return; }
    loadAll();
    connectWS();
    return () => wsRef.current?.close();
  }, [ready]);

  const loadAll = async () => {
    try {
      const _u = JSON.parse(localStorage.getItem('user') || '{}');
      const uid = _u?.id || account || 'me';
      const token = localStorage.getItem('token');

      fetch(`${API}/wallet/balance`, {
        headers:{ Authorization:`Bearer ${token}` }
      }).then(r=>r.json()).then(d=>{ if(d.balance_usd!==undefined) setWallet(d); }).catch(()=>{});

      // Load settlement rail preference
      fetch(`${API}/wallet/settlement-rail`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }).then(r=>r.json()).then(d=>{
        if (d.rail) setWallet(w => ({ ...w, balance_usdc: d.balance_usdc||0, settlement_rail: d.rail }));
      }).catch(()=>{});

      fetch(`${API}/wallet/transactions`, {
        headers:{ Authorization:`Bearer ${token}` }
      }).then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setWalletTxns(d); }).catch(()=>{});

      fetchOpenOrders();

      const [holdRes, tokenRes, tradeRes, propRes, divRes] = await Promise.allSettled([
        api.get(`/kyc/holdings/${uid}`),
        api.get('/assets'),
        api.get(`/trading/history/${uid}?limit=10`),
        api.get('/governance/proposals'),
        api.get(`/dividends/claimable/${uid}`),
      ]);
      if (holdRes.status==='fulfilled')  setHoldings(holdRes.value.data||[]);
      if (tokenRes.status==='fulfilled') setTokens(tokenRes.value.data||[]);
      if (tradeRes.status==='fulfilled') setTrades(tradeRes.value.data||[]);
      if (propRes.status==='fulfilled')  setProposals(propRes.value.data||[]);
      if (divRes.status==='fulfilled')   setDividends(divRes.value.data||[]);
      // Load open primary offerings
      api.get('/offerings').then(r => {
        const open = (r.data || []).filter(o => o.status === 'OPEN');
        setOfferings(open);
        setOfferingsLoaded(true);
      }).catch(() => setOfferingsLoaded(true));
      const token2 = localStorage.getItem('token');
      fetch(`${API}/offerings/my-subscriptions`, { headers:{ Authorization:`Bearer ${token2}` } })
        .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setSubscriptions(d); }).catch(()=>{});
      fetch(`${API}/p2p/my`, { headers:{ Authorization:`Bearer ${token2}` } })
        .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setP2pHistory(d); }).catch(()=>{});
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  const subscribeToOffering = async (offeringId) => {
    if (!subAmount || parseFloat(subAmount) <= 0) {
      alert('Please enter a valid subscription amount.'); return;
    }
    setSubLoading(true);
    try {
      const res = await api.post(`/offerings/${offeringId}/subscribe`, {
        amount_usd: parseFloat(subAmount)
      });
      setActionMsg({ type: 'success', text: `✅ ${res.data.message}` });
      setSelOffering(null);
      setSubAmount('');
      api.get('/offerings').then(r => {
        setOfferings((r.data || []).filter(o => o.status === 'OPEN'));
      }).catch(() => {});
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Subscription failed.' });
    }
    setSubLoading(false);
  };

  const connectWS = () => {
    try {
      const ws = new WebSocket(`${WS}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'PRICE_UPDATE') {
            setPrices(p => ({...p, [msg.symbol]: msg.price}));
            setPriceFlash(f => ({...f, [msg.symbol]: Date.now()}));
            setTimeout(() => setPriceFlash(f => { const n={...f}; delete n[msg.symbol]; return n; }), 1200);
          }
        } catch {}
      };
      const poll = setInterval(() => {
        api.get('/assets').then(r => {
          const updates = {};
          (r.data||[]).forEach(t => {
            const sym = t.symbol || t.token_symbol;
            if (sym && t.oracle_price) updates[sym] = parseFloat(t.oracle_price);
          });
          if (Object.keys(updates).length) setPrices(p => ({...p, ...updates}));
        }).catch(()=>{});
      }, 30000);
      ws.onclose = () => clearInterval(poll);
    } catch {}
  };

  const portfolio = holdings.filter(h => parseFloat(h.balance) > 0).map(h => {
    const sym   = h.symbol || h.token_symbol || '';
    const price = prices[sym] || parseFloat(h.current_price_usd || h.oracle_price || 1);
    const qty   = parseFloat(h.balance || 0);
    const avgCost = parseFloat(h.average_cost_usd || 0);
    const cost  = avgCost > 0 ? qty * avgCost : qty * price;
    const value = qty * price;
    const pnl   = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return {
      symbol:     sym,
      name:       h.name || md.name || sym,
      company:    h.name || md.name || sym,
      asset_class: h.asset_type || md.asset_class || 'Equity',
      price,
      qty,
      value,
      cost,
      pnl,
      pnlPct,
      change24h:  parseFloat(h.change24h || md.change24h || 0),
      volume24h:  parseFloat(h.volume24h || md.volume24h || 0),
      yield_pa:   md.yield_pa || 0,
      chart:      md.chart || Array.from({length:30},(_,i)=>({ t:`Day ${i+1}`, p: price })),
      market_state: h.market_state || 'FULL_TRADING',
    };
  });

  const totalValue   = portfolio.reduce((a,p)=>a+p.value,0);
  const totalCost    = portfolio.reduce((a,p)=>a+p.cost,0);
  const totalPnL     = totalValue - totalCost;
  const totalPnLPct  = totalCost > 0 ? (totalPnL/totalCost)*100 : 0;
  const annualIncome = portfolio.filter(p=>p.yield_pa>0).reduce((a,p)=>a+(p.value*p.yield_pa/100),0);

  // Build combined token list — merge DB tokens into MARKET_DATA, preserving status
  const allTokens = (() => {
    const result = { ...MARKET_DATA };
    (tokens || []).forEach(t => {
      const sym = t.symbol || t.token_symbol;
      if (!sym) return;
      result[sym] = {
        ...(result[sym] || {}),
        symbol:       sym,
        company:      t.company_name || t.name || result[sym]?.company || sym,
        price:        parseFloat(t.oracle_price || t.current_price_usd || result[sym]?.price || 1),
        mktCap:       parseFloat(t.oracle_price || 1) * parseInt(t.total_supply || 0),
        volume24h:    result[sym]?.volume24h || 0,
        change24h:    result[sym]?.change24h || 0,
        yield_pa:     result[sym]?.yield_pa || 0,
        asset_class:  t.asset_type || t.asset_class || result[sym]?.asset_class || 'Other',
        trading_mode: t.trading_mode || t.market_state || 'FULL_TRADING',
        listing_type: t.listing_type || (t.trading_mode==='P2P_ONLY'?'GREENFIELD_P2P':'BROWNFIELD_BOURSE'),
        status:       t.status || 'ACTIVE',
        market_state: t.market_state || 'FULL_TRADING',
        description:  t.description || '',
        jurisdiction: t.jurisdiction || 'Zimbabwe',
        total_supply: t.total_supply || 0,
        isPreListing: t.status === 'DRAFT' || t.market_state === 'PRE_LAUNCH',
        fromDB:       true,
      };
    });
    return Object.entries(result).map(([sym, data]) => ({ ...data, symbol:sym, price:prices[sym]||data.price }));
  })();

  if (typeof window === 'undefined') return null;
  if (!JSON.parse(localStorage.getItem('user') || '{}')?.role) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Pre-listing detail modal */}
      {preListingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.75)'}}>
          <div className="bg-gray-900 border border-indigo-700/50 rounded-2xl p-6 max-w-lg w-full space-y-4 relative max-h-screen overflow-y-auto">
            <button onClick={()=>setPreListingDetail(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-lg">✕</button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg" style={{background:'#312e81'}}>
                {preListingDetail.symbol[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-xl">{preListingDetail.symbol}</h2>
                  <span className="text-xs bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/50">Pre-Listing</span>
                </div>
                <p className="text-gray-400 text-sm">{preListingDetail.company}</p>
              </div>
            </div>
            <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-4 text-sm">
              <p className="font-semibold mb-1 text-indigo-200">🏛 Listing in Progress</p>
              <p className="text-indigo-300 text-xs leading-relaxed">
                This asset has registered on the TokenEquityX platform and is currently undergoing the compliance review process. Trading will be enabled once the asset receives full SECZ sandbox approval and smart contract deployment is complete.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Asset Type',   preListingDetail.asset_class || '—'],
                ['Jurisdiction', preListingDetail.jurisdiction || 'Zimbabwe'],
                ['Total Supply', preListingDetail.total_supply ? parseInt(preListingDetail.total_supply).toLocaleString() + ' tokens' : '—'],
                ['Status',       'Compliance Review'],
              ].map(([label, value])=>(
                <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="font-semibold text-white text-xs">{value}</p>
                </div>
              ))}
            </div>
            {preListingDetail.description && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">About this Asset</p>
                <p className="text-gray-300 text-sm leading-relaxed">{preListingDetail.description}</p>
              </div>
            )}
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Compliance Pipeline</p>
              <div className="space-y-2">
                {[
                  ['SPV Registration',      true],
                  ['KYC/AML Review',         false],
                  ['Auditor Sign-off',        false],
                  ['Smart Contract Deploy',  false],
                  ['SECZ Sandbox Approval',  false],
                ].map(([step, done])=>(
                  <div key={step} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${done?'bg-green-600 text-white':'bg-gray-700 text-gray-500'}`}>
                      {done?'✓':'○'}
                    </span>
                    <span className={`text-xs ${done?'text-green-300':'text-gray-500'}`}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={()=>setPreListingDetail(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-white transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/80">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:GOLD}}>
              <span className="text-sm font-bold text-gray-900">TX</span>
            </div>
            <div>
              <p className="font-bold text-sm">TokenEquityX</p>
              <p className="text-gray-500 text-xs">Investor Portal</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {['portfolio','market','trade','news','governance','dividends'].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                {t}
                {t==='dividends'&&dividends.length>0&&<span className="ml-1 bg-green-600 text-white text-xs px-1 rounded-full">{dividends.length}</span>}
                {t==='governance'&&proposals.filter(p=>p.status==='ACTIVE').length>0&&<span className="ml-1 bg-amber-600 text-white text-xs px-1 rounded-full">{proposals.filter(p=>p.status==='ACTIVE').length}</span>}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.email || 'User'}</span>
            <Inbox token={typeof window !== 'undefined' ? localStorage.getItem('token') : ''} />
            <button onClick={()=>window.location.href='/profile'} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Profile</button>
            <button onClick={()=>{localStorage.clear();window.location.href='/'}}
              className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {actionMsg&&<div className={`rounded-xl p-4 border mb-4 text-sm ${actionMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':actionMsg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':'bg-blue-900/40 border-blue-700 text-blue-300'}`}>{actionMsg.text}</div>}

        {/* ══ PORTFOLIO ══ */}
        {tab==='portfolio' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">💵 My Wallet</h3>
                <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
                  {['overview','deposit','withdraw','history','settlement'].map(t => (
                    <button key={t} onClick={() => { setWalletTab(t); setWalletMsg(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${walletTab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {walletMsg && (
                <div className={`mb-4 p-3 rounded-xl text-sm border ${walletMsg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>
                  {walletMsg.text}
                </div>
              )}
              {walletTab==='overview' && (
                <div className="space-y-4">

                  {/* Active rail indicator */}
                  <div className={`rounded-xl p-4 border flex items-center justify-between ${wallet.settlement_rail==='USDC'?'bg-purple-900/20 border-purple-700/50':'bg-blue-900/20 border-blue-700/50'}`}>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Active Settlement Rail</p>
                      <p className={`font-bold text-lg ${wallet.settlement_rail==='USDC'?'text-purple-300':'text-blue-300'}`}>
                        {wallet.settlement_rail === 'USDC' ? '🔵 USDC Rail' : '🏦 Fiat Rail (USD)'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {wallet.settlement_rail === 'USDC'
                          ? 'Trades and subscriptions settle using your USDC balance'
                          : 'Trades and subscriptions settle using your USD fiat balance'}
                      </p>
                    </div>
                    <button onClick={()=>setWalletTab('settlement')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white flex-shrink-0">
                      Change Rail
                    </button>
                  </div>

                  {/* Two balance cards side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Fiat USD wallet */}
                    <div className={`rounded-xl p-5 border transition-all ${wallet.settlement_rail==='FIAT'?'bg-blue-900/20 border-blue-600/50':'bg-gray-800/50 border-gray-700/50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏦</span>
                          <p className="font-semibold text-sm">USD Fiat Wallet</p>
                        </div>
                        {wallet.settlement_rail==='FIAT' && (
                          <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full border border-blue-700/50">● Active</span>
                        )}
                      </div>
                      <p className="text-3xl font-black text-yellow-400 mb-1">${parseFloat(wallet.balance_usd||0).toFixed(2)}</p>
                      <div className="space-y-1 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex justify-between">
                          <span>Available</span>
                          <span className="text-green-400 font-semibold">${parseFloat(wallet.available_usd||0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Reserved (open orders)</span>
                          <span className="text-amber-400">${parseFloat(wallet.reserved_usd||0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={()=>setWalletTab('deposit')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white">+ Deposit</button>
                        <button onClick={()=>setWalletTab('withdraw')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white">Withdraw</button>
                      </div>
                    </div>

                    {/* USDC wallet */}
                    <div className={`rounded-xl p-5 border transition-all ${wallet.settlement_rail==='USDC'?'bg-purple-900/20 border-purple-600/50':'bg-gray-800/50 border-gray-700/50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔵</span>
                          <p className="font-semibold text-sm">USDC Wallet</p>
                        </div>
                        {wallet.settlement_rail==='USDC' && (
                          <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full border border-purple-700/50">● Active</span>
                        )}
                      </div>
                      <p className="text-3xl font-black text-purple-300 mb-1">{parseFloat(wallet.balance_usdc||0).toFixed(6)} <span className="text-sm font-normal text-gray-500">USDC</span></p>
                      <div className="space-y-1 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex justify-between">
                          <span>USD equivalent</span>
                          <span className="text-purple-300 font-semibold">≈ ${parseFloat(wallet.balance_usdc||0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Network</span>
                          <span className="text-white">Polygon PoS</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="bg-purple-900/20 border border-purple-800/40 rounded-lg p-2 text-xs text-purple-300">
                          ⚡ USDC funding requires RBZ Exchange Control approval — coming soon
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total combined value */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Total Portfolio Value (Wallet)</p>
                      <p className="text-xl font-black text-white">
                        ${(parseFloat(wallet.balance_usd||0) + parseFloat(wallet.balance_usdc||0)).toFixed(2)}
                      </p>
                    </div>
                    <button onClick={()=>setWalletTab('history')} className="text-xs text-blue-400 hover:text-blue-300">View History →</button>
                  </div>
                </div>
              )}
              {walletTab==='deposit' && (
                <div className="space-y-3 max-w-md">
                  <p className="text-gray-400 text-xs">Transfer USD to our bank account and submit your reference number below. Admin will confirm and credit your wallet.</p>
                  <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-xs text-blue-300 space-y-1">
                    <p className="font-bold">Bank Transfer Details</p>
                    <p>Bank: <span className="text-white">Stanbic Bank Zimbabwe</span></p>
                    <p>Account Name: <span className="text-white">TokenEquityX Ltd</span></p>
                    <p>Account Number: <span className="text-white">Contact admin@tokenequityx.co.zw for account details</span></p>
                    <p>Branch: <span className="text-white">Harare Main Branch</span></p>
                    <p>Swift: <span className="text-white">SBICZWHX</span></p>
                  </div>
                  {[{label:'Amount (USD)',key:'amount_usd',type:'number',placeholder:'e.g. 500.00'},{label:'Bank Transfer Reference',key:'reference',type:'text',placeholder:'e.g. TXN-20260401-001'},{label:'Notes (optional)',key:'notes',type:'text',placeholder:'Any additional info'}].map(({label,key,type,placeholder})=>(
                    <div key={key}>
                      <label className="text-xs text-gray-400 block mb-1">{label}</label>
                      <input type={type} placeholder={placeholder} value={depositForm[key]}
                        onChange={e=>setDepositForm({...depositForm,[key]:e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/>
                    </div>
                  ))}
                  <button onClick={handleDeposit} disabled={walletLoading} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{background:GREEN}}>
                    {walletLoading?'⏳ Submitting…':'✓ Submit Deposit Request'}
                  </button>
                </div>
              )}
              {walletTab==='withdraw' && (
                <div className="space-y-3 max-w-md">
                  <p className="text-gray-400 text-xs">Available balance: <span className="text-green-400 font-bold">${parseFloat(wallet.available_usd||0).toFixed(2)}</span>. Withdrawals processed within 2 business days.</p>
                  {[{label:'Amount (USD)',key:'amount_usd',type:'number',placeholder:'e.g. 200.00'},{label:'Bank Name',key:'bank_name',type:'text',placeholder:'e.g. CABS Zimbabwe'},{label:'Account Name',key:'account_name',type:'text',placeholder:'e.g. John Moyo'},{label:'Account Number',key:'account_number',type:'text',placeholder:'e.g. 1234567890'},{label:'Branch Code (optional)',key:'branch_code',type:'text',placeholder:'e.g. 001'}].map(({label,key,type,placeholder})=>(
                    <div key={key}>
                      <label className="text-xs text-gray-400 block mb-1">{label}</label>
                      <input type={type} placeholder={placeholder} value={withdrawForm[key]}
                        onChange={e=>setWithdrawForm({...withdrawForm,[key]:e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/>
                    </div>
                  ))}
                  <button onClick={handleWithdraw} disabled={walletLoading} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{background:NAVY}}>
                    {walletLoading?'⏳ Submitting…':'→ Submit Withdrawal Request'}
                  </button>
                </div>
              )}
              {walletTab==='settlement' && (
                <div className="space-y-4 max-w-lg">
                  <div>
                    <h3 className="font-semibold mb-1">Settlement Rail Preference</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Your settlement rail determines which wallet balance is used when you trade on the secondary market or subscribe to a primary offering. Choose based on which balance you have funded.
                    </p>
                  </div>

                  {/* Rail options */}
                  <div className="space-y-3">
                    {[
                      {
                        value: 'FIAT',
                        icon: '🏦',
                        label: 'Fiat Rail (USD)',
                        desc: 'Trades settle using your USD fiat wallet. Fund via bank transfer. Best for most investors.',
                        balance: `$${parseFloat(wallet.balance_usd||0).toFixed(2)} available`,
                        color: 'blue',
                        available: true,
                      },
                      {
                        value: 'USDC',
                        icon: '🔵',
                        label: 'USDC Rail',
                        desc: 'Trades settle using your USDC wallet on Polygon. Requires RBZ Exchange Control approval before funding.',
                        balance: `${parseFloat(wallet.balance_usdc||0).toFixed(4)} USDC available`,
                        color: 'purple',
                        available: false,
                      },
                    ].map(opt => (
                      <div
                        key={opt.value}
                        onClick={() => { if (!railSaving) setWallet(w=>({...w, settlement_rail: opt.value})); }}
                        className={`cursor-pointer rounded-xl p-4 border transition-all ${
                          wallet.settlement_rail === opt.value
                            ? opt.color === 'blue'
                              ? 'border-blue-500 bg-blue-900/20'
                              : 'border-purple-500 bg-purple-900/20'
                            : 'border-gray-700 bg-gray-800/30 hover:border-gray-500'
                        }`}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-0.5">{opt.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-bold">{opt.label}</p>
                              {wallet.settlement_rail === opt.value && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${opt.color==='blue'?'bg-blue-900/60 text-blue-300 border border-blue-700':'bg-purple-900/60 text-purple-300 border border-purple-700'}`}>
                                  ● Selected
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm mt-1 leading-relaxed">{opt.desc}</p>
                            <p className={`text-xs mt-2 font-semibold ${opt.color==='blue'?'text-green-400':'text-purple-300'}`}>{opt.balance}</p>
                            {!opt.available && (
                              <p className="text-xs text-amber-400 mt-1">⚠️ USDC funding not yet available — pending RBZ approval</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save button */}
                  <button
                    onClick={async () => {
                      setRailSaving(true);
                      try {
                        const res = await fetch(`${API}/wallet/settlement-rail`, {
                          method: 'PUT',
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ rail: wallet.settlement_rail })
                        });
                        const data = await res.json();
                        setWalletMsg(res.ok
                          ? { type:'success', text:`✅ Settlement rail updated to ${wallet.settlement_rail}. ${data.message||''}` }
                          : { type:'error',   text: data.error || 'Failed to update settlement rail' }
                        );
                        setTimeout(() => setWalletMsg(null), 4000);
                      } catch {
                        setWalletMsg({ type:'error', text:'Could not reach server. Is the API running?' });
                        setTimeout(() => setWalletMsg(null), 4000);
                      }
                      setRailSaving(false);
                    }}
                    disabled={railSaving}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40 bg-blue-700 hover:bg-blue-600">
                    {railSaving ? '⏳ Saving…' : '💾 Save Settlement Rail Preference'}
                  </button>

                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
                    <p className="font-semibold text-gray-400 mb-1">ℹ️ How settlement works</p>
                    <p>When you place a buy order or subscribe to a primary offering, the platform debits the wallet matching your selected rail. If your selected rail has insufficient balance, the order will be rejected. You can switch rails at any time — the change takes effect on your next trade.</p>
                  </div>
                </div>
              )}

              {walletTab==='history' && (
                <div>
                  {walletTxns.length===0&&<p className="text-gray-500 text-sm text-center py-6">No transactions yet.</p>}
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Date','Type','Amount','Balance After','Description'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                    <tbody>
                      {walletTxns.map((t,i)=>(
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 pr-4 text-xs text-gray-400">{dt(t.created_at)}</td>
                          <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${t.type==='DEPOSIT'?'bg-green-900/50 text-green-300':t.type==='WITHDRAWAL'?'bg-red-900/50 text-red-300':t.type==='DIVIDEND'?'bg-yellow-900/50 text-yellow-300':'bg-blue-900/50 text-blue-300'}`}>{t.type}</span></td>
                          <td className={`py-2 pr-4 font-bold ${['DEPOSIT','DIVIDEND','TRADE_SELL','REFUND'].includes(t.type)?'text-green-400':'text-red-400'}`}>{['DEPOSIT','DIVIDEND','TRADE_SELL','REFUND'].includes(t.type)?'+':'-'}${parseFloat(t.amount_usd).toFixed(2)}</td>
                          <td className="py-2 pr-4 font-mono text-xs">${parseFloat(t.balance_after).toFixed(2)}</td>
                          <td className="py-2 text-gray-400 text-xs">{t.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {label:'Portfolio Value',value:fmt(totalValue),sub:'total current value',color:'text-white'},
                {label:'Total P&L',value:fmt(totalPnL),sub:pct(totalPnLPct)+' return',color:totalPnL>=0?'text-green-400':'text-red-400'},
                {label:'Annual Income',value:fmt(annualIncome),sub:'dividends & coupons',color:'text-yellow-400'},
                {label:'Positions',value:portfolio.length,sub:'active holdings',color:'text-white'},
              ].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Primary Offerings */}
            {offeringsLoaded && offerings.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">🏦 Primary Market</span>
                    <span className="text-xs bg-green-900/40 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">{offerings.length} open</span>
                  </div>
                  <button onClick={()=>setTab('market')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
                  {offerings.map(o => (
                    <div key={o.id}
                      onClick={() => router.push(`/investor/offering/${o.id}`)}
                      className="flex-shrink-0 cursor-pointer rounded-xl p-3 transition-all"
                      style={{
                        minWidth: '160px', maxWidth: '180px',
                        border: selOffering?.id === o.id ? '2px solid #22c55e' : '1px solid rgba(75,85,99,0.5)',
                        background: selOffering?.id === o.id ? 'rgba(34,197,94,0.08)' : 'rgba(31,41,55,0.5)',
                      }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-sm">{o.token_symbol}</span>
                        <span className="text-xs bg-green-900/40 text-green-300 px-1.5 py-0.5 rounded text-[10px]">OPEN</span>
                      </div>
                      <p className="text-gray-400 text-xs mb-2 truncate">{o.issuer_name || o.token_name || o.token_symbol}</p>
                      <p className="text-white font-semibold text-base mb-1">${parseFloat(o.offering_price_usd).toFixed(4)}</p>
                      <div className="h-1 bg-gray-700 rounded-full mb-1">
                        <div className="h-1 bg-green-500 rounded-full"
                          style={{width:`${Math.min(100,(parseFloat(o.total_raised_usd||0)/parseFloat(o.target_raise_usd))*100)}%`}}/>
                      </div>
                      <p className="text-gray-500 text-[10px]">
                        ${(parseFloat(o.total_raised_usd||0)/1000).toFixed(0)}K of ${(parseFloat(o.target_raise_usd)/1000).toFixed(0)}K
                      </p>
                      <p className="text-gray-600 text-[10px] mt-0.5">Closes {new Date(o.subscription_deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">Click an offering card to subscribe on the Market tab.</p>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {portfolio.map(p => (
                <div key={p.symbol} onClick={()=>setActiveAsset(activeAsset===p.symbol?null:p.symbol)}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 cursor-pointer transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{background:NAVY}}>{p.symbol[0]}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{p.symbol}</p>
                          <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{p.asset_class}</span>
                          {p.yield_pa>0&&<span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">{p.yield_pa}% yield</span>}
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">{p.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{fmt(p.value)}</p>
                      <p className={`text-sm font-medium ${p.pnl>=0?'text-green-400':'text-red-400'}`}>{pct(p.pnlPct)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                    {[{label:'Price',value:`$${p.price.toFixed(4)}`},{label:'24h',value:pct(p.change24h),color:p.change24h>=0?'text-green-400':'text-red-400'},{label:'Holdings',value:`${p.qty.toLocaleString()} tkn`},{label:'Volume',value:fmt(p.volume24h)}].map((s,i)=>(
                      <div key={i} className="bg-gray-800/60 rounded-lg py-2">
                        <p className="text-gray-500 text-xs">{s.label}</p>
                        <p className={`text-sm font-semibold ${s.color||'text-white'}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={60}>
                    <AreaChart data={p.chart}>
                      <defs>
                        <linearGradient id={`g${p.symbol}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={p.change24h>=0?'#16a34a':'#dc2626'} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={p.change24h>=0?'#16a34a':'#dc2626'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="p" stroke={p.change24h>=0?'#16a34a':'#dc2626'} fill={`url(#g${p.symbol})`} strokeWidth={1.5} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-600">Click to expand detail</span>
                  <div className="flex items-center gap-2">
                    <button onClick={(e)=>{e.stopPropagation(); setChartToken({symbol:p.symbol, name:p.name, price:p.price, change24h:p.change24h||0, oracle_price:p.price, market_state:'FULL_TRADING', asset_class:p.assetClass});}} className="text-xs px-2 py-1 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60">📈</button>
                    <span className="text-xs text-gray-500">{activeAsset===p.symbol?'▲ Collapse':'▼ Expand'}</span>
                  </div>
                  </div>
                </div>
              ))}
            </div>

            {activeAsset && (() => {
              const md = MARKET_DATA[activeAsset] || portfolio.find(p=>p.symbol===activeAsset) || {};
              return (
                <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-xl">{activeAsset} — Deep Dive</h2>
                    <button onClick={()=>setActiveAsset(null)} className="text-gray-500 hover:text-white text-sm">✕ Close</button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">30-Day Price History</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={md.chart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                          <XAxis dataKey="t" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} interval={4}/>
                          <YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} domain={['auto','auto']} tickFormatter={v=>`$${v.toFixed(3)}`}/>
                          <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={(v)=>[`$${v.toFixed(4)}`,'Price']}/>
                          <Line type="monotone" dataKey="p" stroke={GOLD} strokeWidth={2} dot={false}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Fundamentals</h3>
                      <div className="space-y-3">
                        {[['Market Cap',fmt(md.mktCap)],['Holders',md.holders.toLocaleString()],['Revenue (Annual)',fmt(md.fundamentals.revenue_usd)],['EBITDA Margin',md.fundamentals.ebitda_margin],['Leverage',md.fundamentals.leverage],['Next Distribution',md.fundamentals.next_coupon],['Annual Yield',md.yield_pa>0?`${md.yield_pa}%`:'—']].map(([k,v],i)=>(
                          <div key={i} className="flex items-center justify-between bg-gray-800/50 px-3 py-2 rounded-lg">
                            <span className="text-gray-400 text-xs">{k}</span>
                            <span className="text-white text-sm font-medium">{v}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-gray-500 text-xs">Risk Rating</span>
                          <span className={`text-sm font-bold ${RISK_COLORS[md.outlook.risk]}`}>{md.outlook.risk}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">Analyst Rating</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${RATING_COLORS[md.outlook.analyst_rating]}`}>{md.outlook.analyst_rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Management Statement</h3>
                      <span className="text-xs text-gray-500">{md.mgmt_statement.date} · {md.mgmt_statement.author}</span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed italic">"{md.mgmt_statement.text}"</p>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-5">
                    <h3 className="font-semibold mb-2 text-blue-300">Sector Outlook — {md.sector}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">{md.outlook.sector}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={()=>{ setTradeSymbol(activeAsset); setTab('trade'); fetchOrderBook(activeAsset); }}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>
                      Trade {activeAsset}
                    </button>
                    <button onClick={()=>setTab('governance')}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">
                      Governance
                    </button>
                  </div>
                </div>
              );
            })()}

              {/* Subscription History */}
              {subscriptions.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mt-6">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="font-semibold text-sm">📋 Primary Subscription History</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2 px-4">Token</th>
                        <th className="text-right py-2 px-4">Amount</th>
                        <th className="text-right py-2 px-4">Tokens</th>
                        <th className="text-right py-2 px-4">Price</th>
                        <th className="text-right py-2 px-4">Status</th>
                        <th className="text-right py-2 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((s,i) => (
                        <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                          <td className="py-2 px-4 font-semibold">{s.token_symbol||s.symbol||'—'}</td>
                          <td className="py-2 px-4 text-right text-yellow-400">${parseFloat(s.amount_usd||s.subscription_amount||0).toLocaleString()}</td>
                          <td className="py-2 px-4 text-right">{parseFloat(s.tokens_allocated||0).toLocaleString()}</td>
                          <td className="py-2 px-4 text-right font-mono">${parseFloat(s.price_per_token||s.offering_price_usd||0).toFixed(4)}</td>
                          <td className="py-2 px-4 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${s.status==='ALLOCATED'?'bg-green-900/40 text-green-300':s.status==='PENDING'?'bg-yellow-900/40 text-yellow-300':'bg-gray-800 text-gray-400'}`}>{s.status}</span>
                          </td>
                          <td className="py-2 px-4 text-right text-gray-400 text-xs">{s.created_at?new Date(s.created_at).toLocaleDateString('en-GB'):'-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* P2P Activity History */}
              {p2pHistory.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mt-4">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="font-semibold text-sm">🔄 P2P Activity History</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left py-2 px-4">Token</th>
                        <th className="text-right py-2 px-4">Quantity</th>
                        <th className="text-right py-2 px-4">Price</th>
                        <th className="text-right py-2 px-4">Total</th>
                        <th className="text-right py-2 px-4">Role</th>
                        <th className="text-right py-2 px-4">Status</th>
                        <th className="text-right py-2 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p2pHistory.map((o,i) => {
                        const userId = JSON.parse(localStorage.getItem('user')||'{}')?.id;
                        const isSeller = o.seller_id === userId;
                        return (
                          <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                            <td className="py-2 px-4 font-semibold">{o.token_symbol}</td>
                            <td className="py-2 px-4 text-right">{parseFloat(o.quantity).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right font-mono text-yellow-400">${parseFloat(o.price_per_token).toFixed(4)}</td>
                            <td className="py-2 px-4 text-right">${parseFloat(o.total_value).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${isSeller?'bg-red-900/40 text-red-300':'bg-green-900/40 text-green-300'}`}>{isSeller?'Seller':'Buyer'}</span>
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${o.status==='ACCEPTED'?'bg-green-900/40 text-green-300':o.status==='OPEN'?'bg-blue-900/40 text-blue-300':o.status==='CANCELLED'?'bg-red-900/40 text-red-300':'bg-gray-800 text-gray-400'}`}>{o.status}</span>
                            </td>
                            <td className="py-2 px-4 text-right text-gray-400 text-xs">{o.created_at?new Date(o.created_at).toLocaleDateString('en-GB'):'-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

        {/* ══ MARKET ══ */}
        {tab==='market' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Capital Markets</h2>
              <p className="text-gray-500 text-sm mt-0.5">Primary offerings, secondary trading and P2P transfers</p>
            </div>
          {/* ── SECTION 1: PRIMARY OFFERINGS — horizontal tab cards ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">🏦 Primary Market</span>
                {offerings.length > 0 && (
                  <span className="text-xs bg-green-900/40 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">{offerings.length} open</span>
                )}
              </div>
              <button onClick={()=>router.push('/investor/asset?section=primary')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
            </div>

            {offerings.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">No primary offerings currently open.</p>
            ) : (
              <>
                {/* Horizontal scrollable offering cards */}
                <div className="flex gap-3 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
                  {offerings.map(o => (
                    <div key={o.id}
                      onClick={() => router.push(`/investor/offering/${o.id}`)}
                      className="flex-shrink-0 cursor-pointer rounded-xl p-3 transition-all"
                      style={{
                        minWidth: '160px', maxWidth: '180px',
                        border: selOffering?.id === o.id ? '2px solid #22c55e' : '1px solid rgba(75,85,99,0.5)',
                        background: selOffering?.id === o.id ? 'rgba(34,197,94,0.08)' : 'rgba(31,41,55,0.5)',
                      }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-sm">{o.token_symbol}</span>
                        <span className="text-xs bg-green-900/40 text-green-300 px-1.5 py-0.5 rounded text-[10px]">OPEN</span>
                      </div>
                      <p className="text-gray-400 text-xs mb-2 truncate">{o.issuer_name || o.token_name || o.token_symbol}</p>
                      <p className="text-white font-semibold text-base mb-1">${parseFloat(o.offering_price_usd).toFixed(4)}</p>
                      <div className="h-1 bg-gray-700 rounded-full mb-1">
                        <div className="h-1 bg-green-500 rounded-full"
                          style={{width:`${Math.min(100,(parseFloat(o.total_raised_usd||0)/parseFloat(o.target_raise_usd))*100)}%`}}/>
                      </div>
                      <p className="text-gray-500 text-[10px]">
                        ${(parseFloat(o.total_raised_usd||0)/1000).toFixed(0)}K of ${(parseFloat(o.target_raise_usd)/1000).toFixed(0)}K
                      </p>
                      <p className="text-gray-600 text-[10px] mt-0.5">Closes {new Date(o.subscription_deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</p>
                    </div>
                  ))}
                </div>

                {/* Subscribe panel — appears when card selected */}
                {selOffering && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">Subscribe to {selOffering.token_symbol}</p>
                      <button onClick={()=>setSelOffering(null)} className="text-gray-500 hover:text-white text-xs">✕ Close</button>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">
                          Amount (USD) · Min ${parseFloat(selOffering.min_subscription_usd||0).toLocaleString()}
                        </label>
                        <input type="number" value={subAmount} onChange={e=>setSubAmount(e.target.value)}
                          placeholder={`e.g. ${parseFloat(selOffering.min_subscription_usd||5000).toLocaleString()}`}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"/>
                      </div>
                      {subAmount && parseFloat(subAmount) > 0 && (
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 block mb-1">You receive</label>
                          <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-green-400">
                            {(parseFloat(subAmount)/parseFloat(selOffering.offering_price_usd)).toLocaleString(undefined,{maximumFractionDigits:2})} {selOffering.token_symbol}
                          </div>
                        </div>
                      )}
                      <button onClick={()=>subscribeToOffering(selOffering.id)} disabled={subLoading||!subAmount}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 flex-shrink-0">
                        {subLoading?'…':'✅ Subscribe'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── SECTION 2: SECONDARY MARKET — FULL TRADING ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">📈 Secondary Market</span>
                <span className="text-xs text-gray-500">Full order book trading</span>
              </div>
              <button onClick={()=>router.push('/investor/asset?section=secondary')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  {['Asset','Price','24h','Vol','Yield',''].map(h=>(
                    <th key={h} className={`py-2 px-4 font-medium ${h===''||h==='24h'||h==='Vol'||h==='Yield'?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTokens.filter(t=>t.market_state==='FULL_TRADING'||t.trading_mode==='FULL_TRADING').length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-600 text-xs">No securities on full trading yet.</td></tr>
                ) : allTokens.filter(t=>t.market_state==='FULL_TRADING'||t.trading_mode==='FULL_TRADING').map((t,i)=>(
                  <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer transition-colors"
                    onClick={()=>router.push('/investor/asset/'+(t.symbol||t.token_symbol))}>

                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-900">{(t.symbol||t.token_symbol||'?')[0]}</div>
                        <div>
                          <p className="font-semibold text-white text-xs">{t.symbol||t.token_symbol}</p>
                          <p className="text-gray-500 text-[10px] truncate max-w-[100px]">{t.name||t.company_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-right">${parseFloat(t.price||t.current_price_usd||0).toFixed(4)}</td>
                    <td className={`py-2.5 px-4 text-xs text-right font-semibold ${parseFloat(t.change_24h||t.change24h||0)>=0?'text-green-400':'text-red-400'}`}>
                      {parseFloat(t.change_24h||t.change24h||0)>=0?'+':''}{parseFloat(t.change_24h||t.change24h||0).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-xs text-right text-gray-400">${parseFloat(t.volume_24h||t.volume24h||0)>=1e3?`${((t.volume_24h||t.volume24h)/1e3).toFixed(1)}K`:parseFloat(t.volume_24h||t.volume24h||0).toFixed(0)}</td>
                    <td className="py-2.5 px-4 text-xs text-right text-yellow-400">{t.yield_pct?`${t.yield_pct}%`:'—'}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-xs px-2 py-1 rounded-lg border border-blue-700/50 text-blue-300 bg-blue-900/20">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── SECTION 3: P2P MARKET ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">🔄 P2P Market</span>
                <span className="text-xs text-gray-500">Greenfield · peer-to-peer transfers</span>
              </div>
              <button onClick={()=>router.push('/investor/asset?section=p2p')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  {['Asset','Price','24h','Mkt Cap','Yield',''].map(h=>(
                    <th key={h} className={`py-2 px-4 font-medium ${h===''||h==='24h'||h==='Mkt Cap'||h==='Yield'?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTokens.filter(t=>t.market_state==='P2P_ONLY'||t.trading_mode==='P2P_ONLY'||t.market_state==='PRE_LAUNCH').length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-600 text-xs">No P2P securities available.</td></tr>
                ) : allTokens.filter(t=>t.market_state==='P2P_ONLY'||t.trading_mode==='P2P_ONLY'||t.market_state==='PRE_LAUNCH').map((t,i)=>(
                  <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer transition-colors"
                    onClick={()=>router.push('/investor/asset/'+(t.symbol||t.token_symbol))}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-purple-900">{(t.symbol||t.token_symbol||'?')[0]}</div>
                        <div>
                          <p className="font-semibold text-white text-xs">{t.symbol||t.token_symbol}</p>
                          <p className="text-gray-500 text-[10px] truncate max-w-[100px]">{t.name||t.company_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-right">${parseFloat(t.price||t.current_price_usd||0).toFixed(4)}</td>
                    <td className={`py-2.5 px-4 text-xs text-right font-semibold ${parseFloat(t.change_24h||t.change24h||0)>=0?'text-green-400':'text-red-400'}`}>
                      {parseFloat(t.change_24h||t.change24h||0)>=0?'+':''}{parseFloat(t.change_24h||t.change24h||0).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-xs text-right text-gray-400">${parseFloat(t.market_cap||0)>=1e6?`${(t.market_cap/1e6).toFixed(2)}M`:parseFloat(t.market_cap||0)>=1e3?`${(t.market_cap/1e3).toFixed(1)}K`:parseFloat(t.market_cap||0).toFixed(0)}</td>
                    <td className="py-2.5 px-4 text-xs text-right text-yellow-400">{t.yield_pct?`${t.yield_pct}%`:'—'}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-xs px-2 py-1 rounded-lg border border-purple-700/50 text-purple-300 bg-purple-900/20 cursor-pointer">View →</span>
                    </td>
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
                {tradeMsg && (
                  <div className={`p-3 rounded-xl text-sm border ${tradeMsg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>{tradeMsg.text}</div>
                )}
                <div className="bg-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Available Balance</span>
                  <span className="text-green-400 font-bold text-lg">${parseFloat(wallet.available_usd||0).toFixed(2)}</span>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Token</label>
                  <select value={tradeSymbol} onChange={e=>{ setTradeSymbol(e.target.value); fetchOrderBook(e.target.value); setTradeMsg(null); }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600">
                    <option value="">— Select token —</option>
                    {allTokens.filter(t=>!t.isPreListing&&(t.trading_mode==='FULL_TRADING'||t.listing_type==='BROWNFIELD_BOURSE')).map(t=>(
                      <option key={t.symbol} value={t.symbol}>{t.symbol} — {t.company||t.company_name} (${t.price.toFixed(4)})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['BUY','SELL'].map(s=>(
                    <button key={s} onClick={()=>setTradeSide(s)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${tradeSide===s?(s==='BUY'?'bg-green-700 text-white':'bg-red-700 text-white'):'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {s==='BUY'?'▲ BUY':'▼ SELL'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['MARKET','LIMIT'].map(t=>(
                    <button key={t} onClick={()=>setTradeType(t)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${tradeType===t?'bg-blue-700 text-white':'bg-gray-800 text-gray-400 hover:text-white'}`}>{t}</button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Quantity (tokens)</label>
                  <input type="number" placeholder="e.g. 100" value={tradeQty} onChange={e=>setTradeQty(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600"/>
                  {tradeSymbol && tradeQty && tradePrice && (
                    <p className="text-xs text-gray-500 mt-1">Est. total: <span className="text-white font-semibold">${(parseFloat(tradeQty||0)*parseFloat(tradePrice||0)).toFixed(2)}</span></p>
                  )}
                </div>
                {tradeType==='LIMIT' && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Limit Price (USD)</label>
                    <input type="number" placeholder="e.g. 1.0240" value={tradePrice} onChange={e=>setTradePrice(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600"/>
                  </div>
                )}
                <button onClick={placeOrder} disabled={tradeLoading}
                  className={`w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-colors ${tradeSide==='BUY'?'bg-green-700 hover:bg-green-600':'bg-red-700 hover:bg-red-600'}`}>
                  {tradeLoading?'⏳ Placing…':`${tradeSide==='BUY'?'▲ Buy':'▼ Sell'} ${tradeSymbol||'Token'}`}
                </button>
                <p className="text-xs text-gray-600 text-center">Orders matched on-chain via Polygon · USD settlement</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Order Book</h3>
                  {tradeSymbol&&<span className="text-xs text-gray-500">{tradeSymbol}</span>}
                </div>
                {!tradeSymbol ? (
                  <p className="text-gray-600 text-sm text-center py-8">Select a token to see the order book</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-red-400 font-bold mb-2">ASKS (Sell)</p>
                        <div className="space-y-1">
                          {orderBook.asks.length===0&&<p className="text-gray-600 text-xs">No asks</p>}
                          {[...orderBook.asks].reverse().map((a,i)=>(
                            <div key={i} className="flex justify-between text-xs bg-red-900/10 px-2 py-1 rounded">
                              <span className="text-red-400 font-mono">${parseFloat(a.limit_price).toFixed(4)}</span>
                              <span className="text-gray-400">{(a.quantity-a.filled_qty).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-green-400 font-bold mb-2">BIDS (Buy)</p>
                        <div className="space-y-1">
                          {orderBook.bids.length===0&&<p className="text-gray-600 text-xs">No bids</p>}
                          {orderBook.bids.map((b,i)=>(
                            <div key={i} className="flex justify-between text-xs bg-green-900/10 px-2 py-1 rounded">
                              <span className="text-green-400 font-mono">${parseFloat(b.limit_price).toFixed(4)}</span>
                              <span className="text-gray-400">{(b.quantity-b.filled_qty).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold mb-2">RECENT TRADES</p>
                      <div className="space-y-1">
                        {orderBook.recentTrades.length===0&&<p className="text-gray-600 text-xs">No recent trades</p>}
                        {orderBook.recentTrades.slice(0,5).map((t,i)=>(
                          <div key={i} className="flex justify-between text-xs px-2 py-1 border-b border-gray-800/50">
                            <span className="font-mono text-white">${parseFloat(t.price).toFixed(4)}</span>
                            <span className="text-gray-400">{parseFloat(t.quantity).toLocaleString()}</span>
                            <span className="text-gray-600">{new Date(t.matched_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">My Open Orders</h3>
                <button onClick={fetchOpenOrders} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
              </div>
              {openOrders.filter(o=>o.status==='OPEN'||o.status==='PARTIAL').length===0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No open orders.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Token','Side','Type','Qty','Filled','Price','Status','Action'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                  <tbody>
                    {openOrders.filter(o=>o.status==='OPEN'||o.status==='PARTIAL').map((o,i)=>(
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 pr-4 font-bold">{o.token_symbol}</td>
                        <td className="py-2 pr-4"><span className={`text-xs font-bold ${o.side==='BUY'?'text-green-400':'text-red-400'}`}>{o.side}</span></td>
                        <td className="py-2 pr-4 text-gray-400 text-xs">{o.order_type}</td>
                        <td className="py-2 pr-4">{parseFloat(o.quantity).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-400">{parseFloat(o.filled_qty||0).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono">{o.limit_price?`$${parseFloat(o.limit_price).toFixed(4)}`:'Market'}</td>
                        <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full ${o.status==='OPEN'?'bg-blue-900/50 text-blue-300':'bg-amber-900/50 text-amber-300'}`}>{o.status}</span></td>
                        <td className="py-2"><button onClick={()=>cancelOrder(o.id)} disabled={cancelling===o.id} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40">{cancelling===o.id?'…':'Cancel'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══ NEWS ══ */}
        {tab==='news' && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-xl font-bold">Market Intelligence Feed</h2>
            <p className="text-gray-500 text-sm">News and analysis relevant to your holdings and the Zimbabwean capital market.</p>
            {NEWS_FEED.map(n=>(
              <div key={n.id} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_COLORS[n.sentiment]}`}>{n.category}</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{n.source}</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{n.time}</span>
                    </div>
                    <p className="font-medium text-white leading-snug">{n.headline}</p>
                  </div>
                  <a href={n.url} className="text-blue-400 hover:text-blue-300 text-xs whitespace-nowrap">Read →</a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ GOVERNANCE ══ */}
        {tab==='governance' && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-xl font-bold">Governance Votes</h2>
            <p className="text-gray-500 text-sm">Vote on company resolutions proportional to your token holdings.</p>
            {proposals.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">🗳️</p>
                <p className="font-semibold mb-2">No active proposals</p>
                <p className="text-gray-500 text-sm">Governance proposals from companies you hold tokens in will appear here.</p>
              </div>
            ) : proposals.map(p=>{
              const total=Number(p.votes_for)+Number(p.votes_against)+Number(p.votes_abstain);
              const forPct=total>0?Math.round((p.votes_for/total)*100):0;
              const againstPct=total>0?Math.round((p.votes_against/total)*100):0;
              const daysLeft=Math.max(0,Math.ceil((new Date(p.end_time)-new Date())/(1000*60*60*24)));
              return(
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">{p.token_symbol}</span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-500">{p.company_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='ACTIVE'?'bg-green-900/50 text-green-300':'bg-gray-800 text-gray-500'}`}>{p.status}</span>
                      </div>
                      <h3 className="font-bold">{p.title}</h3>
                      {p.description&&<p className="text-gray-400 text-sm mt-1">{p.description}</p>}
                    </div>
                    <div className="text-right text-sm text-gray-500 ml-4">
                      <p className="font-semibold text-white">{daysLeft}d left</p>
                      <p className="text-xs">{total} votes</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {[['FOR',forPct,'bg-green-500','text-green-400'],['AGAINST',againstPct,'bg-red-500','text-red-400']].map(([l,v,bar,txt])=>(
                      <div key={l} className="flex items-center gap-3">
                        <span className={`text-xs font-bold w-16 ${txt}`}>{l}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2"><div className={`h-2 rounded-full ${bar}`} style={{width:`${v}%`}}/></div>
                        <span className="text-xs text-gray-400 w-8">{v}%</span>
                      </div>
                    ))}
                  </div>
                  {p.status==='ACTIVE'&&(
                    <div className="flex gap-2">
                      {[['✓ FOR','bg-green-700 hover:bg-green-600','FOR'],['✗ AGAINST','bg-red-700 hover:bg-red-600','AGAINST'],['− ABSTAIN','bg-gray-700 hover:bg-gray-600','ABSTAIN']].map(([l,cls,choice])=>(
                        <button key={l} onClick={()=>castVote(p.id,choice)} disabled={voting===p.id+choice}
                          className={`flex-1 ${cls} disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition-colors`}>{voting===p.id+choice?'Casting…':l}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ DIVIDENDS ══ */}
        {tab==='dividends' && (
          <div className="space-y-4 max-w-3xl">
            <h2 className="text-xl font-bold">Income & Dividends</h2>
            <div className="grid grid-cols-3 gap-4 mb-2">
              {[{label:'Claimable Now',value:fmt(dividends.reduce((a,d)=>a+Number(d.total_amount_usdc||0),0)),color:'text-green-400'},{label:'Received YTD',value:'—',color:'text-white'},{label:'Next Expected',value:'—',color:'text-yellow-400'}].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            {dividends.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">💰</p>
                <p className="font-semibold mb-2">No dividends available</p>
                <p className="text-gray-500 text-sm">Dividend distributions from your token holdings will appear here when declared.</p>
              </div>
            ) : dividends.map(d=>{
              const daysLeft=Math.max(0,Math.ceil((new Date(d.claim_deadline)-new Date())/(1000*60*60*24)));
              return(
                <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-gray-500 text-xs">{d.token_symbol} · {d.company_name}</p>
                      <h3 className="font-bold mt-1">{d.description}</h3>
                      <p className="text-gray-500 text-xs mt-1">Claim by: {new Date(d.claim_deadline).toLocaleDateString('en-GB')} ({daysLeft} days left)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-green-400">${parseFloat(d.total_amount_usdc).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">USD</p>
                    </div>
                  </div>
                  <button onClick={()=>claimDividend(d.id,d.total_amount_usdc)} disabled={claiming===d.id}
                    className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                    {claiming===d.id?'Claiming…':'💰 Claim Distribution'}
                  </button>
                </div>
              );
            })}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Income History</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Date','Token','Type','Amount','Status'].map(h=><th key={h} className="text-left pb-2 font-medium pr-4">{h}</th>)}</tr></thead>
                <tbody>
                  {true && <p className="text-gray-500 text-sm text-center py-4">No income history yet.</p>}
                  {[].map((r,i)=>(
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 text-gray-400">{r.date}</td>
                      <td className="py-2 pr-4 font-medium">{r.sym}</td>
                      <td className="py-2 pr-4 text-gray-300">{r.type}</td>
                      <td className="py-2 pr-4 text-green-400 font-semibold">{r.amt}</td>
                      <td className="py-2"><span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {chartToken && (
        <TokenChartModal token={chartToken} onClose={() => setChartToken(null)} />
      )}
    </div>
  );
}