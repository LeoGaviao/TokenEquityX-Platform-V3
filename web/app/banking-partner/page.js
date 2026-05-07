'use client';
import { useState, useEffect } from 'react';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const NAVY = '#1A3C5E';
const GOLD = '#C8972B';

function fmt(n) {
  const v = parseFloat(n||0);
  if (v >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function dt(d) {
  return d ? new Date(d).toLocaleString('en-GB') : '—';
}

export default function BankingPartnerPage() {
  const [token,        setToken]        = useState('');
  const [user,         setUser]         = useState(null);
  const [tab,          setTab]          = useState('settlements');
  const [dashboard,    setDashboard]    = useState(null);
  const [settlements,  setSettlements]  = useState([]);
  const [whtBatches,   setWhtBatches]   = useState([]);
  const [disbursements,setDisbursements]= useState([]);
  const [reconLogs,    setReconLogs]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [confirmModal, setConfirmModal] = useState(null);
  const [bankRef,      setBankRef]      = useState('');
  const [refNotes,     setRefNotes]     = useState('');
  const [batchDate,    setBatchDate]    = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!t || !['ADMIN','BANKING_PARTNER'].includes(u.role)) {
      window.location.href = '/login';
      return;
    }
    setToken(t); setUser(u);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadAll();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadSettlements();
  }, [token, statusFilter]);

  const hdrs = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dashRes, whtRes, disbRes, reconRes] = await Promise.allSettled([
        fetch(`${API}/banking-partner/dashboard`,     { headers: hdrs() }).then(r=>r.json()),
        fetch(`${API}/banking-partner/wht`,           { headers: hdrs() }).then(r=>r.json()),
        fetch(`${API}/banking-partner/disbursements`, { headers: hdrs() }).then(r=>r.json()),
        fetch(`${API}/banking-partner/reconciliation`,{ headers: hdrs() }).then(r=>r.json()),
      ]);
      if (dashRes.status==='fulfilled') setDashboard(dashRes.value);
      if (whtRes.status==='fulfilled'  && Array.isArray(whtRes.value))  setWhtBatches(whtRes.value);
      if (disbRes.status==='fulfilled' && Array.isArray(disbRes.value)) setDisbursements(disbRes.value);
      if (reconRes.status==='fulfilled'&& Array.isArray(reconRes.value))setReconLogs(reconRes.value);
    } catch {}
    setLoading(false);
  };

  const loadSettlements = async () => {
    try {
      const res = await fetch(`${API}/banking-partner/settlements?status=${statusFilter}`, { headers: hdrs() });
      const data = await res.json();
      if (Array.isArray(data)) setSettlements(data);
    } catch {}
  };

  const notify = (type, text) => { setMsg({type,text}); setTimeout(()=>setMsg(null), 4000); };

  const confirmSettlement = async () => {
    if (!bankRef) { notify('error','Bank reference number is required'); return; }
    try {
      const res = await fetch(`${API}/banking-partner/settlements/${confirmModal.id}/confirm`, {
        method: 'PUT', headers: hdrs(),
        body: JSON.stringify({ bank_reference: bankRef, notes: refNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', data.message);
        setConfirmModal(null); setBankRef(''); setRefNotes('');
        loadSettlements(); loadAll();
      } else notify('error', data.error);
    } catch { notify('error','Request failed'); }
  };

  const STATUS_COLORS = {
    PENDING:   'bg-amber-900/40 text-amber-300 border-amber-700/50',
    COMPLETED: 'bg-green-900/40 text-green-300 border-green-700/50',
    FAILED:    'bg-red-900/40 text-red-300 border-red-700/50',
    PROCESSING:'bg-blue-900/40 text-blue-300 border-blue-700/50',
    REMITTED:  'bg-green-900/40 text-green-300 border-green-700/50',
    DISBURSED: 'bg-green-900/40 text-green-300 border-green-700/50',
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between" style={{background:NAVY}}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold" style={{color:GOLD}}>⬡ TokenEquityX</span>
          <span className="text-xs text-gray-400 border border-gray-600 rounded px-2 py-0.5">Banking Partner Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">{user.email}</span>
          <button onClick={()=>{localStorage.clear();window.location.href='/login';}}
            className="text-xs text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>

      {/* Notification */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm border ${msg.type==='success'?'bg-green-900/90 border-green-700 text-green-200':'bg-red-900/90 border-red-700 text-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* KPI Row */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label:'Pending Settlements', value: dashboard.pending_settlements?.count, sub: fmt(dashboard.pending_settlements?.value), color:'text-amber-400', icon:'⏳' },
              { label:'Completed Today',     value: dashboard.completed_today?.count,     sub: fmt(dashboard.completed_today?.value),     color:'text-green-400', icon:'✅' },
              { label:'WHT Due to ZIMRA',    value: fmt(dashboard.wht_pending?.value),    sub: 'pending remittance',                      color:'text-purple-400',icon:'🏛' },
              { label:'Pending Disbursements',value: dashboard.disbursements_pending?.count,sub: fmt(dashboard.disbursements_pending?.value),color:'text-blue-400',icon:'💸' },
            ].map((k,i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">{k.icon} {k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-600 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
          {[
            { key:'settlements', label:'💳 Settlements' },
            { key:'disbursements',label:'💸 Disbursements' },
            { key:'wht',         label:'🏛 WHT Batches' },
            { key:'reconciliation',label:'🔄 Reconciliation' },
            { key:'batch',       label:'📥 Batch File' },
          ].map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'text-white':'text-gray-500 hover:text-gray-300'}`}
              style={tab===t.key?{background:NAVY}:{}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* SETTLEMENTS TAB */}
        {tab==='settlements' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {['PENDING','COMPLETED','FAILED'].map(s => (
                <button key={s} onClick={()=>setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter===s?'border-yellow-500 text-yellow-400 bg-yellow-900/20':'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                  {s}
                </button>
              ))}
            </div>
            {settlements.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-gray-400">No {statusFilter.toLowerCase()} settlements.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                      {['Type','Reference','Token','Investor','Gross','Fee','WHT','Net','Status','Created','Action'].map(h=>(
                        <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((s,i) => (
                      <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                        <td className="py-3 px-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">{s.type}</span></td>
                        <td className="py-3 px-3 font-mono text-xs text-gray-300">{s.reference}</td>
                        <td className="py-3 px-3 font-semibold text-yellow-400">{s.token_symbol||'—'}</td>
                        <td className="py-3 px-3">
                          <p className="text-xs font-medium">{s.investor_name||'—'}</p>
                          <p className="text-xs text-gray-500">{s.investor_email||''}</p>
                        </td>
                        <td className="py-3 px-3 font-mono">{fmt(s.amount_usd)}</td>
                        <td className="py-3 px-3 font-mono text-red-400">{fmt(s.fee_usd)}</td>
                        <td className="py-3 px-3 font-mono text-purple-400">{fmt(s.wht_usd)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-green-400">{fmt(s.net_amount_usd)}</td>
                        <td className="py-3 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status]||''}`}>{s.status}</span>
                          {s.bank_reference && <p className="text-xs text-gray-500 mt-0.5 font-mono">{s.bank_reference}</p>}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-500">{dt(s.created_at)}</td>
                        <td className="py-3 px-3">
                          {s.status==='PENDING' && (
                            <button onClick={()=>setConfirmModal(s)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-80"
                              style={{background:NAVY}}>
                              ✅ Confirm
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* DISBURSEMENTS TAB */}
        {tab==='disbursements' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {disbursements.length === 0 ? (
              <div className="p-8 text-center"><p className="text-gray-400">No pending disbursements.</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                    {['Token','Issuer','Bank','Account','Gross','Fees','Net','Status','Action'].map(h=>(
                      <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disbursements.map((d,i)=>(
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-3 px-3 font-semibold text-yellow-400">{d.token_symbol}</td>
                      <td className="py-3 px-3 text-xs">{d.entity_name}</td>
                      <td className="py-3 px-3 text-xs">{d.bank_name||'—'}</td>
                      <td className="py-3 px-3 font-mono text-xs">{d.account_number||'—'}</td>
                      <td className="py-3 px-3 font-mono">{fmt(d.gross_amount)}</td>
                      <td className="py-3 px-3 font-mono text-red-400">{fmt(parseFloat(d.platform_fee)+parseFloat(d.secz_levy)+parseFloat(d.vat_on_fees))}</td>
                      <td className="py-3 px-3 font-mono font-bold text-green-400">{fmt(d.net_amount)}</td>
                      <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[d.status]||''}`}>{d.status}</span></td>
                      <td className="py-3 px-3">
                        {d.status==='PENDING' && (
                          <button onClick={async()=>{
                            const ref = window.prompt(`Enter bank reference for ${d.token_symbol} disbursement of ${fmt(d.net_amount)}:`);
                            if (!ref) return;
                            const res = await fetch(`${API}/banking-partner/disbursements/${d.id}/process`,{method:'PUT',headers:hdrs(),body:JSON.stringify({bank_reference:ref})});
                            const data = await res.json();
                            if(res.ok){notify('success',data.message);loadAll();}else notify('error',data.error);
                          }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{background:NAVY}}>
                            💸 Process
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* WHT TAB */}
        {tab==='wht' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {whtBatches.length === 0 ? (
              <div className="p-8 text-center"><p className="text-gray-400">No WHT batches yet.</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                    {['Period','Type','Resident WHT','Non-Resident WHT','Total','Transactions','Status','ZIMRA Ref','Action'].map(h=>(
                      <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {whtBatches.map((w,i)=>(
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-3 px-3 font-semibold">{w.period}</td>
                      <td className="py-3 px-3 text-xs">{w.wht_type}</td>
                      <td className="py-3 px-3 font-mono">{fmt(w.resident_amount)}</td>
                      <td className="py-3 px-3 font-mono">{fmt(w.non_resident_amount)}</td>
                      <td className="py-3 px-3 font-mono font-bold text-purple-400">{fmt(w.total_amount_usd)}</td>
                      <td className="py-3 px-3 text-center">{w.transaction_count}</td>
                      <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[w.status]||''}`}>{w.status}</span></td>
                      <td className="py-3 px-3 font-mono text-xs text-gray-400">{w.zimra_reference||'—'}</td>
                      <td className="py-3 px-3">
                        {w.status==='PENDING' && (
                          <button onClick={async()=>{
                            const ref = window.prompt(`Enter ZIMRA reference for ${w.period} WHT remittance of ${fmt(w.total_amount_usd)}:`);
                            if (!ref) return;
                            const res = await fetch(`${API}/banking-partner/wht/${w.id}/remit`,{method:'PUT',headers:hdrs(),body:JSON.stringify({zimra_reference:ref})});
                            const data = await res.json();
                            if(res.ok){notify('success','WHT remittance recorded.');loadAll();}else notify('error',data.error);
                          }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{background:'#7c3aed'}}>
                            🏛 Record Remittance
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* RECONCILIATION TAB */}
        {tab==='reconciliation' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-sm">🔄 USDC Reconciliation History</h3>
              <p className="text-xs text-gray-500 mt-0.5">Daily reconciliation runs at 18:00 CAT. Compares omnibus wallet on-chain balance vs internal ledger.</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                  {['Time','Trigger','On-Chain Balance','Ledger Total','Variance','Status','Notes'].map(h=>(
                    <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconLogs.map((r,i)=>(
                  <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                    <td className="py-2 px-3 text-xs text-gray-400">{dt(r.reconciled_at)}</td>
                    <td className="py-2 px-3 text-xs">{r.trigger}</td>
                    <td className="py-2 px-3 font-mono">${parseFloat(r.on_chain_balance||0).toFixed(2)}</td>
                    <td className="py-2 px-3 font-mono">${parseFloat(r.ledger_total||0).toFixed(2)}</td>
                    <td className="py-2 px-3 font-mono">${parseFloat(r.variance||0).toFixed(4)}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status==='OK'?'bg-green-900/40 text-green-300 border-green-700/50':r.status==='WARNING'?'bg-amber-900/40 text-amber-300 border-amber-700/50':'bg-red-900/40 text-red-300 border-red-700/50'}`}>{r.status}</span>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">{r.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BATCH FILE TAB */}
        {tab==='batch' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-bold mb-1">📥 Daily Settlement Batch File</h3>
              <p className="text-xs text-gray-500">Download a CSV of all settlement instructions for a given date. Use this to reconcile with your banking system.</p>
            </div>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Date</label>
                <input type="date" value={batchDate} onChange={e=>setBatchDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"/>
              </div>
              <a href={`${API}/banking-partner/batch-file?date=${batchDate}`}
                onClick={e=>{e.currentTarget.href=`${API}/banking-partner/batch-file?date=${batchDate}`;}}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                style={{background:NAVY}}
                download>
                ⬇ Download CSV
              </a>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-4 text-xs text-gray-400 space-y-1">
              <p><strong className="text-gray-300">File includes:</strong> Settlement ID, Type, Reference, Token, Investor details, Gross amount, Fee, WHT, Net amount, Status, Bank reference, Timestamps</p>
              <p><strong className="text-gray-300">Naming convention:</strong> tokenequityx-settlements-YYYY-MM-DD.csv</p>
              <p><strong className="text-gray-300">Note:</strong> A batch file is also auto-generated daily at 16:00 CAT and retained for 90 days.</p>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Settlement Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">✅ Confirm Settlement</h3>
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Type</span><span>{confirmModal.type}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Reference</span><span className="font-mono text-xs">{confirmModal.reference}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Investor</span><span>{confirmModal.investor_name||'—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Net Amount</span><span className="font-bold text-green-400">{fmt(confirmModal.net_amount_usd)}</span></div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Bank Reference Number *</label>
              <input value={bankRef} onChange={e=>setBankRef(e.target.value)}
                placeholder="e.g. STB2026050700123"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 font-mono"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
              <input value={refNotes} onChange={e=>setRefNotes(e.target.value)}
                placeholder="Any notes about this settlement"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setConfirmModal(null);setBankRef('');setRefNotes('');}}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={confirmSettlement}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{background:NAVY}}>
                ✅ Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
