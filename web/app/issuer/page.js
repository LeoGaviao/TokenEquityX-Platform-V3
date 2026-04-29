'use client';
import { useWallet } from '../../hooks/useWallet';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import Inbox from '../../components/ui/Inbox';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const NAVY  = '#1A3C5E';
const GOLD  = '#C8972B';
const GREEN = '#16a34a';

const fmt = (n) => {
  const num = parseFloat(n||0);
  if (num >= 1e9) return `$${(num/1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num/1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num/1e3).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
};
const dt = (d) => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

// ── FINANCIALS TAB ──────────────────────────────────────────────
function FinancialsTab({ t, price, account, setPostMsg, NAVY }) {
  const [form, setForm] = useState({
    period:'Q1 2026', revenue:'', ebitda:'', netAssets:'',
    netLiabilities:'', occupancy:'', unitCount:'', managementStatement:'',
  });
  const [files, setFiles]         = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory]     = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/submissions/my').then(r => {
      setHistory((r.data||[]).filter(s=>s.submission_type !== 'TOKENISATION_APPLICATION'));
    }).catch(()=>{});
  }, []);

  const submit = async () => {
    if (!form.revenue && !form.ebitda) {
      setPostMsg({ type:'error', text:'Please enter at least Revenue or EBITDA before submitting.' });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('tokenSymbol', t?.symbol || t?.token_symbol || 'HCPR');
      fd.append('period', form.period);
      fd.append('revenue', form.revenue);
      fd.append('ebitda', form.ebitda);
      fd.append('netAssets', form.netAssets);
      fd.append('netLiabilities', form.netLiabilities);
      fd.append('managementStatement', form.managementStatement);
      fd.append('operationalKpis', JSON.stringify({ occupancy: form.occupancy, unitCount: form.unitCount }));
      files.forEach(f => fd.append('documents', f));
      const res = await api.post('/submissions/financial', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setPostMsg({ type:'success', text:`✅ ${res.data.message} ${res.data.documentsUploaded} document(s) uploaded.` });
      setForm({ ...form, revenue:'', ebitda:'', netAssets:'', netLiabilities:'', managementStatement:'' });
      setFiles([]);
      api.get('/submissions/my').then(r => setHistory((r.data||[]).filter(s=>s.submission_type !== 'TOKENISATION_APPLICATION'))).catch(()=>{});
    } catch(err) {
      setPostMsg({ type:'error', text: err.response?.data?.error || 'Submission failed. Please try again.' });
    } finally { setSubmitting(false); }
  };

  const STATUS_COLORS = {
    APPROVED:'bg-green-900/50 text-green-300', REJECTED:'bg-red-900/50 text-red-300',
    PENDING:'bg-amber-900/50 text-amber-300', UNDER_REVIEW:'bg-blue-900/50 text-blue-300',
    INFO_REQUESTED:'bg-purple-900/50 text-purple-300',
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold">Financial Data Submission</h2>
      <p className="text-gray-500 text-sm">Submit quarterly financial data and supporting documents. Your auditor reviews the data and updates your oracle price on approval.</p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Next Due', value:'15 Apr 2026', sub:'Q1 2026', color:'text-amber-400' },
          { label:'Oracle Price', value:`$${(price||1).toFixed(4)}`, sub:'Current certified price', color:'text-white' },
          { label:'Pending', value: history.filter(h=>h.status==='PENDING').length || '0', sub:'Awaiting auditor review', color:'text-blue-400' },
        ].map((k,i)=>(
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-600 text-xs">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4">Submit Quarterly Data</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Reporting Period</label>
            <select value={form.period} onChange={e=>setForm(f=>({...f,period:e.target.value}))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600">
              {['Q1 2026','Q4 2025','Q3 2025','Q2 2025'].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Revenue (USD)','revenue','e.g. 128000'],['EBITDA (USD)','ebitda','e.g. 91000'],['Total Assets (USD)','netAssets','e.g. 5400000'],['Net Liabilities (USD)','netLiabilities','e.g. 1200000']].map(([label,field,ph])=>(
              <div key={field}>
                <label className="text-xs text-gray-400 block mb-1">{label}</label>
                <input type="number" placeholder={ph} value={form[field]}
                  onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/>
              </div>
            ))}
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Management Statement</label>
            <textarea rows={4} value={form.managementStatement}
              onChange={e=>setForm(f=>({...f,managementStatement:e.target.value}))}
              placeholder="Describe the quarter's performance, key developments, and outlook..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600 resize-none"/>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Supporting Documents</label>
            <div onClick={()=>fileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl px-4 py-5 text-center cursor-pointer transition-colors">
              <p className="text-2xl mb-2">📎</p>
              <p className="text-sm text-gray-400">Click to upload — or drag and drop</p>
              <p className="text-xs text-gray-600 mt-1">PDF, Word, Excel, JPG, PNG — max 10MB each</p>
            </div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              className="hidden" onChange={e=>setFiles(Array.from(e.target.files))}/>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f,i)=>(
                  <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-gray-300">📄 {f.name}</span>
                    <span className="text-gray-500">{(f.size/1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={submit} disabled={submitting}
          className="w-full mt-5 py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition-all"
          style={{background:NAVY}}>
          {submitting ? '⏳ Submitting...' : '📤 Submit for Auditor Review'}
        </button>
        <p className="text-gray-600 text-xs mt-2">Once submitted, your auditor will review the data. You cannot edit a submitted entry but can submit a corrected version.</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4">Submission History</h3>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No submissions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
              {['Period','Submitted','Reference','Docs','Status','Notes'].map(h=><th key={h} className="text-left pb-2 pr-3">{h}</th>)}
            </tr></thead>
            <tbody>
              {history.map((r,i)=>(
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-3 font-medium">{r.period}</td>
                  <td className="py-2 pr-3 text-gray-400 text-xs">{dt(r.created_at)}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-gray-400">{r.reference_number||'—'}</td>
                  <td className="py-2 pr-3 text-center">{r.document_count||0}</td>
                  <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]||'bg-gray-700 text-gray-300'}`}>{r.status}</span></td>
                  <td className="py-2 text-gray-500 text-xs">{r.auditor_notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── APPLICATIONS TAB ────────────────────────────────────────────
function ApplicationsTab({ myApplications, setTab, NAVY, GOLD }) {
  const [expanded, setExpanded] = useState(null);
  const [detail,   setDetail]   = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const toggleExpand = async (app) => {
    if (expanded === app.id) { setExpanded(null); return; }
    setExpanded(app.id);
    if (detail[app.id]) return;
    setLoadingId(app.id);
    try {
      const res = await api.get(`/submissions/${app.id}`);
      const sub = res.data;
      let parsedData = {};
      try { parsedData = typeof sub.data_json === 'string' ? JSON.parse(sub.data_json) : (sub.data_json || {}); } catch {}
      const financialData = parsedData.financialData || parsedData;
      const hasFinancials = financialData && (
        financialData.revenueTTM || financialData.faceValue ||
        financialData.propertyValuation || financialData.totalResourceTonnes || financialData.annualRevenue
      );
      let valuation = null;
      if (hasFinancials && app.token_symbol) {
        try {
          const vRes = await api.post('/pipeline/preview', { tokenSymbol: app.token_symbol, financialData });
          valuation = vRes.data;
        } catch {}
      }
      setDetail(d => ({...d, [app.id]: { sub, parsedData, financialData, valuation }}));
    } catch {
      setDetail(d => ({...d, [app.id]: { error: 'Could not load submission details.' }}));
    } finally { setLoadingId(null); }
  };

  const deleteSubmission = async (subId, symbol) => {
    if (!window.confirm(`Are you sure you want to delete the ${symbol} submission?\n\nThis will permanently delete:\n• The tokenisation application\n• The registered token and SPV\n\nThis action cannot be undone. Type the token symbol to confirm.`)) return;
    const typed = window.prompt(`Type "${symbol}" to confirm deletion:`);
    if (typed !== symbol) { alert('Symbol did not match. Deletion cancelled.'); return; }
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/submissions/${subId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Request failed. Please try again.');
    }
  };

  const STATUS_CONFIG = {
    PENDING:          { color:'text-amber-400',  bg:'bg-amber-900/30 border-amber-700/50',   label:'Pending Review',   icon:'⏳' },
    UNDER_REVIEW:     { color:'text-blue-400',   bg:'bg-blue-900/30 border-blue-700/50',     label:'Under Review',     icon:'🔍' },
    INFO_REQUESTED:   { color:'text-purple-400', bg:'bg-purple-900/30 border-purple-700/50', label:'Info Requested',   icon:'📋' },
    APPROVED:         { color:'text-green-400',  bg:'bg-green-900/30 border-green-700/50',   label:'Approved',         icon:'✅' },
    AUDITOR_APPROVED: { color:'text-green-400',  bg:'bg-green-900/30 border-green-700/50',   label:'Auditor Approved', icon:'✅' },
    REJECTED:         { color:'text-red-400',    bg:'bg-red-900/30 border-red-700/50',       label:'Rejected',         icon:'❌' },
  };

  const FIELD_LABELS = {
    revenueTTM:'Revenue (TTM)', ebitdaTTM:'EBITDA (TTM)', freeCashFlow:'Free Cash Flow',
    totalDebt:'Total Debt', cash:'Cash & Equivalents', growthRatePct:'Growth Rate %',
    discountRatePct:'Discount Rate %', faceValue:'Face Value', couponRatePct:'Coupon Rate %',
    marketYieldPct:'Market Yield %', periodsRemaining:'Periods Remaining', periodsPerYear:'Periods/Year',
    propertyValuation:'Property Valuation', netOperatingIncome:'Net Operating Income', capRate:'Cap Rate %',
    totalResourceTonnes:'Total Resource (t)', gradePercent:'Grade %', commodityPricePerTonne:'Commodity Price/t',
    miningCostPerTonne:'Mining Cost/t', recoveryRate:'Recovery Rate', mineLifeYears:'Mine Life (yrs)',
    annualRevenue:'Annual Revenue', operatingMarginPct:'Operating Margin %', contractYears:'Contract Years',
    sector:'Sector', periodLabel:'Period',
  };
  const MONEY_FIELDS = ['revenueTTM','ebitdaTTM','freeCashFlow','totalDebt','cash','faceValue',
    'propertyValuation','netOperatingIncome','commodityPricePerTonne','miningCostPerTonne','annualRevenue'];
  const PCT_FIELDS = ['growthRatePct','discountRatePct','couponRatePct','marketYieldPct',
    'gradePercent','operatingMarginPct','capRate'];
  const MODEL_LABELS = {
    revenueMultiple:'Revenue Multiple', ebitdaMultiple:'EBITDA Multiple',
    dcf:'Discounted Cash Flow (DCF)', nav:'Net Asset Value (NAV)',
    capRate:'Capitalisation Rate', resourceValuation:'Resource NPV',
    bondPricing:'Bond Present Value', infrastructure:'Infrastructure DCF',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">My Applications & Listing Progress</h2>
        <p className="text-gray-500 text-sm mt-1">Click any submission to see your financial data, how the valuation engine interpreted it, and the auditor-facing summary.</p>
      </div>

      {myApplications.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold mb-2">No applications yet</p>
          <p className="text-gray-500 text-sm mb-4">Submit a tokenisation proposal to list a new asset on the platform.</p>
          <button onClick={()=>setTab('journey')} className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>
            🚀 Submit Tokenisation Proposal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {myApplications.map((app) => {
            const isTokenisation = app.submission_type === 'TOKENISATION_APPLICATION';
            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
            const isOpen = expanded === app.id;
            const d = detail[app.id];
            const isLoading = loadingId === app.id;

            const STAGES = isTokenisation
              ? ['Submitted','Compliance Check','Auditor Review','SECZ Application','Approved']
              : ['Submitted','Auditor Review','Oracle Updated','Approved'];
            const stageIndex = ({
              PENDING:0, UNDER_REVIEW:1, INFO_REQUESTED:1,
              AUDITOR_APPROVED: STAGES.length - 2,
              APPROVED: STAGES.length - 1, REJECTED:-1,
            })[app.status] ?? 0;

            return (
              <div key={app.id} className={`rounded-2xl border transition-all ${cfg.bg}`}>

                {/* Header — click to expand */}
                <div className="p-5 cursor-pointer select-none" onClick={()=>toggleExpand(app)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{cfg.icon}</span>
                        <h3 className="font-bold text-base">
                          {app.token_symbol} — {isTokenisation ? 'Tokenisation Application' : `Financial Submission (${app.period})`}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        {app.reference_number && <span className="font-mono">Ref: {app.reference_number}</span>}
                        <span>Submitted: {dt(app.created_at)}</span>
                        <span>{app.document_count||0} documents</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full border ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                      <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Pipeline bar */}
                  {isTokenisation && app.status !== 'REJECTED' && (
                    <div className="mt-4">
                      <div className="flex items-start justify-between mb-2">
                        {STAGES.map((stage, idx) => (
                          <div key={idx} className="flex flex-col items-center flex-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                              idx < stageIndex ? 'bg-green-600 text-white' :
                              idx === stageIndex ? 'text-white' : 'bg-gray-700 text-gray-500'
                            }`} style={idx === stageIndex ? {background:NAVY} : {}}>
                              {idx < stageIndex ? '✓' : idx + 1}
                            </div>
                            <span className={`text-xs text-center leading-tight ${idx <= stageIndex ? 'text-white' : 'text-gray-600'}`}>{stage}</span>
                          </div>
                        ))}
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                        <div className="h-1.5 rounded-full transition-all duration-700"
                          style={{
                            width:`${app.status==='APPROVED'?100:Math.round((stageIndex/(STAGES.length-1))*100)}%`,
                            background: app.status==='APPROVED'?'#16a34a':NAVY
                          }}/>
                      </div>
                    </div>
                  )}

                  {/* Auditor note preview when collapsed */}
                  {app.auditor_notes && !isOpen && (
                    <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                      app.status==='INFO_REQUESTED'?'bg-purple-900/30 text-purple-300':
                      app.status==='REJECTED'?'bg-red-900/30 text-red-300':'bg-blue-900/20 text-blue-300'
                    }`}>
                      <span className="font-bold mr-1">
                        {app.status==='INFO_REQUESTED'?'📋 Action required:':app.status==='REJECTED'?'❌ Rejection:':'📝 Auditor:'}
                      </span>
                      {app.auditor_notes.slice(0,120)}{app.auditor_notes.length>120?'…':''}
                    </div>
                  )}

                  <p className="text-xs text-gray-600 mt-2">{isOpen?'▲ Click to collapse':'▼ Click to view your submitted data and valuation breakdown'}</p>
                </div>

                {/* Expanded drawer */}
                {isOpen && (
                  <div className="border-t border-gray-700/50 px-5 pb-6 pt-4 space-y-5">

                    {isLoading && (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-2xl mb-2">⏳</p>
                        <p className="text-sm">Loading submission details...</p>
                      </div>
                    )}

                    {d?.error && (
                      <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-300 text-sm">{d.error}</div>
                    )}

                    {d && !d.error && !isLoading && (
                      <>
                        {/* Financial data submitted */}
                        {d.financialData && Object.keys(d.financialData).filter(k => !['documents','submittedAt','type','dataHash'].includes(k)).length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-300 mb-3">📊 Financial Data You Submitted</h4>
                            <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {Object.entries(d.financialData)
                                  .filter(([k,v]) => v !== null && v !== undefined && v !== '' && !['documents','submittedAt','type','dataHash','periodLabel'].includes(k))
                                  .map(([key, val]) => {
                                    const isMoney = MONEY_FIELDS.includes(key);
                                    const isPct   = PCT_FIELDS.includes(key);
                                    const displayVal = isMoney ? fmt(val) : isPct ? `${val}%` : String(val);
                                    return (
                                      <div key={key} className="bg-gray-800/50 rounded-lg p-3">
                                        <p className="text-xs text-gray-500 mb-1">{FIELD_LABELS[key] || key}</p>
                                        <p className="font-semibold text-sm text-white">{displayVal}</p>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Valuation breakdown */}
                        {d.valuation && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-300 mb-3">🧮 How the Valuation Engine Interpreted Your Data</h4>
                            <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 space-y-4">
                              <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                                  <p className="text-xs text-gray-500 mb-1">Asset Type</p>
                                  <p className="font-bold text-yellow-400">{d.valuation.assetType}</p>
                                </div>
                                <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                                  <p className="text-xs text-gray-500 mb-1">Blended Enterprise Value</p>
                                  <p className="font-bold text-green-400 text-lg">{fmt(d.valuation.blended)}</p>
                                </div>
                                <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                                  <p className="text-xs text-gray-500 mb-1">Reference Price / Token</p>
                                  <p className="font-bold text-white text-lg">${parseFloat(d.valuation.pricePerToken||0).toFixed(4)}</p>
                                </div>
                              </div>

                              {d.valuation.models && Object.entries(d.valuation.models)
                                .filter(([,v]) => v && (v.enterpriseValue > 0 || v.price > 0 || v.nav > 0)).length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Model Breakdown</p>
                                  <div className="space-y-2">
                                    {Object.entries(d.valuation.models)
                                      .filter(([,v]) => v && (v.enterpriseValue > 0 || v.price > 0 || v.nav > 0))
                                      .map(([modelName, modelData]) => {
                                        const val = modelData?.enterpriseValue || modelData?.price || modelData?.nav || 0;
                                        return (
                                          <div key={modelName} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
                                            <div>
                                              <p className="text-sm font-medium">{MODEL_LABELS[modelName] || modelName}</p>
                                              {modelData?.multiple && <p className="text-xs text-gray-500">Multiple: {modelData.multiple}x</p>}
                                              {modelData?.macaulayDuration && <p className="text-xs text-gray-500">Duration: {modelData.macaulayDuration} yrs</p>}
                                              {modelData?.premiumDiscount && <p className="text-xs text-gray-500">Premium/Discount: {modelData.premiumDiscount}%</p>}
                                            </div>
                                            <p className="font-bold text-yellow-400">{fmt(val)}</p>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                              <p className="text-xs text-gray-600 border-t border-gray-700/50 pt-3">
                                This is a system-generated preview. The auditor will review this calculation and may apply adjustments before certifying the final oracle price.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Auditor-facing summary */}
                        <div>
                          <h4 className="font-semibold text-sm text-gray-300 mb-3">🔍 Auditor-Facing Summary</h4>
                          <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4 space-y-2 text-sm">
                            {[
                              ['Submission ID',    String(app.id)],
                              ['Token Symbol',     app.token_symbol],
                              ['Period',           app.period],
                              ['Assigned Auditor', app.assigned_auditor || 'Not yet assigned'],
                              ['Current Status',   cfg.label],
                              ...(d.valuation ? [['System Reference Price', `$${parseFloat(d.valuation.pricePerToken||0).toFixed(6)}`]] : []),
                            ].map(([label, value])=>(
                              <div key={label} className="flex justify-between">
                                <span className="text-gray-400">{label}</span>
                                <span className={
                                  label==='Assigned Auditor' && !app.assigned_auditor ? 'text-amber-400' :
                                  label==='System Reference Price' ? 'text-yellow-400 font-bold' :
                                  label==='Token Symbol' ? 'font-bold' : 'text-gray-200'
                                }>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Full auditor notes */}
                        {app.auditor_notes && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-300 mb-2">Auditor Feedback</h4>
                            <div className={`rounded-xl p-4 text-sm ${
                              app.status==='INFO_REQUESTED'?'bg-purple-900/30 border border-purple-700/50 text-purple-200':
                              app.status==='REJECTED'?'bg-red-900/30 border border-red-700/50 text-red-200':
                              'bg-blue-900/20 border border-blue-800/40 text-blue-200'
                            }`}>
                              {app.auditor_notes}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {app.status==='INFO_REQUESTED' && (
                          <div className="flex gap-3 pt-1">
                            <button onClick={()=>setTab('financials')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>
                              📤 Submit Additional Information
                            </button>
                            <button onClick={()=>setTab('journey')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">
                              📋 Resubmit Application
                            </button>
                          </div>
                        )}
                        {app.status==='APPROVED' && isTokenisation && (
                          <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 text-center">
                            <p className="text-green-300 font-bold">🎉 Application Approved!</p>
                            <p className="text-gray-400 text-sm mt-1">Your token will be listed. The compliance team will contact you with next steps for smart contract deployment.</p>
                          </div>
                        )}
                        {['PENDING','UNDER_REVIEW','REJECTED'].includes(app.status) && (
                          <button
                            onClick={() => deleteSubmission(app.id, app.token_symbol || app.reference_number)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800/50">
                            🗑 Delete & Start Fresh
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {myApplications.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Want to list another asset?</p>
            <p className="text-gray-500 text-xs mt-0.5">Submit a new tokenisation proposal for a different asset.</p>
          </div>
          <button onClick={()=>setTab('journey')} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>
            + New Application
          </button>
        </div>
      )}
    </div>
  );
}

// ── ENTITY KYC TAB ──────────────────────────────────────────────
function EntityKycTab({ entityKyc, kycLoaded, onSubmitted, API, NAVY, GOLD }) {
  const [step,        setStep]        = useState(1);
  const [submitting,  setSubmitting]  = useState(false);
  const [msg,         setMsg]         = useState(null);
  const [directors,   setDirectors]   = useState([{ name:'', id_number:'', email:'', pep: false }]);
  const [owners,      setOwners]      = useState([{ name:'', ownership_pct:'', id_number:'', nationality:'' }]);
  const [form, setForm] = useState({
    entity_name: '', registration_number: '', registration_country: 'Zimbabwe',
    registered_address: '', business_description: '', business_type: '',
    date_incorporated: '', tax_clearance_number: '', source_of_funds: '',
    pep_declaration: false, sanctions_declaration: false, aml_declaration: false,
  });
  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500';
  const set = (f, v) => setForm(p => ({...p, [f]: v}));

  const addDirector = () => setDirectors(d => [...d, { name:'', id_number:'', email:'', pep: false }]);
  const setDir = (i, f, v) => setDirectors(d => d.map((x,j) => j===i ? {...x,[f]:v} : x));
  const addOwner = () => setOwners(o => [...o, { name:'', ownership_pct:'', id_number:'', nationality:'' }]);
  const setOwn = (i, f, v) => setOwners(o => o.map((x,j) => j===i ? {...x,[f]:v} : x));

  const submit = async () => {
    if (!form.entity_name || !form.registration_number) {
      setMsg({ type:'error', text:'Entity name and registration number are required.' }); return;
    }
    if (!form.aml_declaration) {
      setMsg({ type:'error', text:'You must confirm the AML declaration to proceed.' }); return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/entity-kyc/submit`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, directors, beneficial_owners: owners }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type:'success', text: data.message });
        onSubmitted({ ...form, status: 'PENDING', id: data.kycId });
      } else {
        setMsg({ type:'error', text: data.error });
      }
    } catch { setMsg({ type:'error', text:'Request failed. Please try again.' }); }
    setSubmitting(false);
  };

  const STEPS = ['Entity', 'Directors', 'Ownership', 'Compliance', 'Submit'];
  const statusColor = s => s === 'APPROVED' ? 'bg-green-900/40 border-green-700/50 text-green-300' :
                           s === 'REJECTED'  ? 'bg-red-900/40 border-red-700/50 text-red-300' :
                           'bg-yellow-900/40 border-yellow-700/50 text-yellow-300';

  if (!kycLoaded) return <div className="text-center py-8 text-gray-500 text-sm">Loading KYC status...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {entityKyc && (
        <div className={`rounded-2xl p-5 border ${statusColor(entityKyc.status)}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">Entity KYC Status</h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusColor(entityKyc.status)}`}>
              {entityKyc.status}
            </span>
          </div>
          <p className="text-sm opacity-80">{entityKyc.entity_name} · {entityKyc.registration_number}</p>
          {entityKyc.status === 'APPROVED' && (
            <p className="text-xs mt-2 text-green-300">✅ Your entity KYC is approved. You may proceed with tokenisation applications.</p>
          )}
          {entityKyc.status === 'PENDING' && (
            <p className="text-xs mt-2">⏳ Under review. Our compliance team will respond within 3-5 business days.</p>
          )}
          {entityKyc.status === 'REJECTED' && (
            <div className="mt-2">
              <p className="text-xs text-red-300 mb-1">❌ Reason: {entityKyc.rejection_reason}</p>
              <p className="text-xs">Please address the issues and resubmit below.</p>
            </div>
          )}
        </div>
      )}

      {(!entityKyc || entityKyc.status === 'REJECTED') && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="font-bold text-lg">Entity KYC & AML Verification</h3>
            <p className="text-gray-500 text-xs mt-0.5">Required before submitting a tokenisation application</p>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Step {step} of {STEPS.length}</p>
              <p className="text-xs text-white font-semibold">{STEPS[step-1]}</p>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-1.5 rounded-full transition-all" style={{width:`${(step/STEPS.length)*100}%`,background:GOLD}}/>
            </div>
          </div>

          {msg && (
            <div className={`rounded-xl p-3 border mb-4 text-sm ${msg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':'bg-green-900/40 border-green-700 text-green-300'}`}>
              {msg.text}
            </div>
          )}

          {/* STEP 1: Entity Details */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Provide details about your registered entity.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Legal Entity Name *</label>
                  <input value={form.entity_name} onChange={e=>set('entity_name',e.target.value)} className={inputCls} placeholder="As registered"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Registration Number *</label>
                  <input value={form.registration_number} onChange={e=>set('registration_number',e.target.value)} className={inputCls} placeholder="e.g. ZW2024-001"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Country of Registration</label>
                  <input value={form.registration_country} onChange={e=>set('registration_country',e.target.value)} className={inputCls} placeholder="Zimbabwe"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Business Type</label>
                  <select value={form.business_type} onChange={e=>set('business_type',e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {['Private Company (Pvt Ltd)','Public Company','Partnership','Trust','Non-Profit','Government Entity','Other'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Date Incorporated</label>
                  <input type="date" value={form.date_incorporated} onChange={e=>set('date_incorporated',e.target.value)} className={inputCls}/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tax Clearance Number</label>
                  <input value={form.tax_clearance_number} onChange={e=>set('tax_clearance_number',e.target.value)} className={inputCls} placeholder="e.g. ZIMRA-2024-12345"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Registered Address *</label>
                <textarea rows={2} value={form.registered_address} onChange={e=>set('registered_address',e.target.value)} className={inputCls+' resize-none'} placeholder="Full registered office address"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Business Description *</label>
                <textarea rows={3} value={form.business_description} onChange={e=>set('business_description',e.target.value)} className={inputCls+' resize-none'} placeholder="Describe your principal business activities"/>
              </div>
              <button onClick={()=>{ if(!form.entity_name||!form.registration_number){setMsg({type:'error',text:'Please fill required fields.'});return;} setMsg(null);setStep(2); }}
                className="w-full py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>
                Next: Directors →
              </button>
            </div>
          )}

          {/* STEP 2: Directors */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">List all directors and officers of the entity. All must complete individual KYC.</p>
              {directors.map((d, i) => (
                <div key={i} className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-300">Director {i+1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-gray-500 block mb-1">Full Name *</label><input value={d.name} onChange={e=>setDir(i,'name',e.target.value)} className={inputCls} placeholder="Full legal name"/></div>
                    <div><label className="text-xs text-gray-500 block mb-1">National ID / Passport *</label><input value={d.id_number} onChange={e=>setDir(i,'id_number',e.target.value)} className={inputCls} placeholder="ID number"/></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Email</label><input value={d.email} onChange={e=>setDir(i,'email',e.target.value)} className={inputCls} placeholder="email@example.com"/></div>
                    <div className="flex items-center gap-2 mt-4">
                      <input type="checkbox" checked={d.pep} onChange={e=>setDir(i,'pep',e.target.checked)} id={`pep-${i}`}/>
                      <label htmlFor={`pep-${i}`} className="text-xs text-gray-400">Politically Exposed Person (PEP)</label>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addDirector} className="w-full py-2 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500">+ Add Another Director</button>
              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
                <button onClick={()=>{setMsg(null);setStep(3);}} className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>Next: Ownership →</button>
              </div>
            </div>
          )}

          {/* STEP 3: Beneficial Ownership */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">List all beneficial owners holding 25% or more of the entity.</p>
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-xs text-blue-300">
                ℹ️ FATF requirements mandate disclosure of all beneficial owners with ≥25% ownership or control.
              </div>
              {owners.map((o, i) => (
                <div key={i} className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-300">Beneficial Owner {i+1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-gray-500 block mb-1">Full Name *</label><input value={o.name} onChange={e=>setOwn(i,'name',e.target.value)} className={inputCls} placeholder="Full legal name"/></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Ownership % *</label><input type="number" value={o.ownership_pct} onChange={e=>setOwn(i,'ownership_pct',e.target.value)} className={inputCls} placeholder="e.g. 35"/></div>
                    <div><label className="text-xs text-gray-500 block mb-1">National ID / Passport</label><input value={o.id_number} onChange={e=>setOwn(i,'id_number',e.target.value)} className={inputCls} placeholder="ID number"/></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Nationality</label><input value={o.nationality} onChange={e=>setOwn(i,'nationality',e.target.value)} className={inputCls} placeholder="e.g. Zimbabwean"/></div>
                  </div>
                </div>
              ))}
              <button onClick={addOwner} className="w-full py-2 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500">+ Add Beneficial Owner</button>
              <div className="flex gap-3">
                <button onClick={()=>setStep(2)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
                <button onClick={()=>{setMsg(null);setStep(4);}} className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>Next: Compliance →</button>
              </div>
            </div>
          )}

          {/* STEP 4: Compliance Declarations */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Complete all compliance declarations. All declarations are mandatory.</p>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Source of Funds *</label>
                <textarea rows={3} value={form.source_of_funds} onChange={e=>set('source_of_funds',e.target.value)} className={inputCls+' resize-none'}
                  placeholder="Describe the source of funds for this entity's operations and planned token issuance..."/>
              </div>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer bg-gray-800/50 rounded-xl p-4">
                  <input type="checkbox" checked={form.pep_declaration} onChange={e=>set('pep_declaration',e.target.checked)} className="mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="text-sm text-white font-medium">PEP Declaration</p>
                    <p className="text-xs text-gray-400 mt-0.5">I confirm that neither the entity nor any of its directors or beneficial owners are Politically Exposed Persons (PEPs), unless already disclosed in the Directors section above.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer bg-gray-800/50 rounded-xl p-4">
                  <input type="checkbox" checked={form.sanctions_declaration} onChange={e=>set('sanctions_declaration',e.target.checked)} className="mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="text-sm text-white font-medium">Sanctions Declaration</p>
                    <p className="text-xs text-gray-400 mt-0.5">I confirm that neither the entity nor any of its directors or beneficial owners appear on any international sanctions list (OFAC, UN, EU, FATF).</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer bg-gray-800/50 rounded-xl p-4 border border-yellow-700/40">
                  <input type="checkbox" checked={form.aml_declaration} onChange={e=>set('aml_declaration',e.target.checked)} className="mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="text-sm text-white font-medium">AML/CFT Declaration *</p>
                    <p className="text-xs text-gray-400 mt-0.5">I confirm that all funds associated with this entity are from legitimate sources. I understand that TokenEquityX is required to report suspicious activity to the Financial Intelligence Unit (FIU) of Zimbabwe under the Money Laundering and Proceeds of Crime Act (Chapter 9:24).</p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setStep(3)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
                <button onClick={()=>{ if(!form.source_of_funds){setMsg({type:'error',text:'Source of funds is required.'});return;} if(!form.aml_declaration){setMsg({type:'error',text:'AML declaration is required.'});return;} setMsg(null);setStep(5); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Review and submit your Entity KYC application.</p>
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                {[
                  ['Entity Name',       form.entity_name],
                  ['Reg. Number',       form.registration_number],
                  ['Country',           form.registration_country],
                  ['Business Type',     form.business_type || '—'],
                  ['Incorporated',      form.date_incorporated || '—'],
                  ['Tax Clearance',     form.tax_clearance_number || '—'],
                  ['Directors',         `${directors.filter(d=>d.name).length} listed`],
                  ['Beneficial Owners', `${owners.filter(o=>o.name).length} listed`],
                  ['PEP Declared',      form.pep_declaration ? 'Yes' : 'No'],
                  ['Sanctions Clear',   form.sanctions_declaration ? 'Confirmed' : 'Not confirmed'],
                  ['AML Declaration',   form.aml_declaration ? '✅ Confirmed' : '❌ Not confirmed'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-gray-700/50 last:border-0">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 text-xs text-amber-300">
                ⚠️ By submitting, you confirm that all information provided is true and accurate. Providing false information is a criminal offence under the Money Laundering and Proceeds of Crime Act (Chapter 9:24).
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setStep(4)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
                <button onClick={submit} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
                  style={{background:NAVY}}>
                  {submitting ? '⏳ Submitting...' : '🚀 Submit Entity KYC'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TOKENISATION TAB ────────────────────────────────────────────
function TokenisationTab({ notify, entityKyc, setTab }) {
  const API     = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const FORM_KEY = 'texz_unified_app_draft';
  const savedDraft = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(FORM_KEY) || 'null') : null;
  const [step,       setStep]       = useState(savedDraft?.step || 1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(null);
  const [files,      setFiles]      = useState({});
  const fileRefs = useRef({});
  const [symbolStatus, setSymbolStatus] = useState(null);
  const [symbolTimer,  setSymbolTimer]  = useState(null);
  const [postMsg,      setPostMsg]      = useState(null);
  const [applications, setApplications] = useState([]);
  const [loadingApps,  setLoadingApps]  = useState(true);
  const [form, setForm] = useState(savedDraft?.form || {
    legalName: '', registrationNumber: '', jurisdiction: 'ZW',
    sector: 'OTHER', assetType: 'EQUITY', description: '',
    websiteUrl: '', foundedYear: '', headquarters: '', useOfProceeds: '', numEmployees: '',
    tokenName: '', tokenSymbol: '', assetClass: 'Private Equity',
    authorisedShares: '', nominalValueCents: '100',
    targetRaiseUsd: '', tokenIssuePrice: '1.00', totalSupply: '',
    expectedYield: '', distributionFrequency: 'Quarterly',
    ceo_name: '', ceo_email: '', ceo_id: '',
    cfo_name: '', cfo_email: '', cfo_id: '',
    legal_name: '', legal_email: '', legal_id: '',
    termsAccepted: false,
  });
  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500';

  const set = (field, val) => {
    setForm(f => {
      const updated = { ...f, [field]: val };
      localStorage.setItem(FORM_KEY, JSON.stringify({ step, form: updated }));
      return updated;
    });
  };

  const goToStep = (n) => {
    setStep(n);
    localStorage.setItem(FORM_KEY, JSON.stringify({ step: n, form }));
  };

  const checkSymbol = (sym) => {
    if (!sym || sym.length < 2) { setSymbolStatus(null); return; }
    setSymbolStatus('checking');
    clearTimeout(symbolTimer);
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/assets/check-symbol?symbol=${sym}`);
        const data = await res.json();
        setSymbolStatus(data.available ? 'available' : 'taken');
      } catch { setSymbolStatus(null); }
    }, 600);
    setSymbolTimer(timer);
  };

  const handleFile = (docName) => (e) => {
    const f = e.target.files[0];
    if (f) setFiles(prev => ({ ...prev, [docName]: f }));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/submissions/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setApplications(d); })
      .catch(() => {})
      .finally(() => setLoadingApps(false));
  }, [submitted]);

  const deleteSubmission = async (subId, symbol) => {
    if (!window.confirm(`Delete the ${symbol} application?\n\nThis will permanently delete the token, SPV and all related data.\n\nThis cannot be undone.`)) return;
    const typed = window.prompt(`Type "${symbol}" to confirm:`);
    if (typed !== symbol) { alert('Symbol did not match. Deletion cancelled.'); return; }
    const token = localStorage.getItem('token');
    const res   = await fetch(`${API}/submissions/${subId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) { alert(`✅ ${data.message}`); window.location.reload(); }
    else alert(`Error: ${data.error}`);
  };

  const submit = async () => {
    if (!form.termsAccepted) { setPostMsg({ type: 'error', text: 'Please accept the declaration.' }); return; }
    if (!form.legalName || !form.tokenSymbol || !form.tokenName) {
      setPostMsg({ type: 'error', text: 'Please complete all required fields.' }); return;
    }
    if (symbolStatus === 'taken') { setPostMsg({ type: 'error', text: 'Token symbol is already taken.' }); return; }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/submissions/unified`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem(FORM_KEY);
        setSubmitted(data);
      } else {
        setPostMsg({ type: 'error', text: data.error || 'Submission failed.' });
      }
    } catch { setPostMsg({ type: 'error', text: 'Request failed. Please try again.' }); }
    setSubmitting(false);
  };

  const STEPS = ['Company', 'Token', 'Economics', 'Personnel', 'Documents', 'Review'];

  if (submitted) return (
    <div className="bg-gray-900 border border-green-700/40 rounded-2xl p-8 text-center max-w-lg mx-auto">
      <p className="text-5xl mb-4">🎉</p>
      <h3 className="font-bold text-xl mb-2 text-green-400">Application Submitted!</h3>
      <p className="text-gray-300 text-sm mb-4">{submitted.message}</p>
      <div className="bg-gray-800 rounded-xl p-3 mb-4">
        <p className="text-xs text-gray-500">Reference Number</p>
        <p className="font-mono text-yellow-400 text-sm">{submitted.referenceNumber}</p>
      </div>
      <p className="text-gray-500 text-xs">Your application will be reviewed at the next Tuesday Applications Appraisal Meeting. You will receive a notification once reviewed.</p>
      <button onClick={() => setSubmitted(null)} className="mt-6 text-sm text-blue-400 hover:text-blue-300">Submit another application</button>
    </div>
  );

  return (
    <>
      {(!entityKyc || entityKyc.status !== 'APPROVED') && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-2xl p-6 text-center max-w-2xl">
          <p className="text-3xl mb-3">🔒</p>
          <h3 className="font-bold text-lg mb-2 text-amber-300">Entity KYC Required</h3>
          <p className="text-gray-400 text-sm mb-4">
            {!entityKyc
              ? 'You must complete and receive approval for your Entity KYC & AML verification before submitting a tokenisation application.'
              : entityKyc.status === 'PENDING'
              ? 'Your Entity KYC is under review. You will be notified once approved — typically within 3–5 business days.'
              : 'Your Entity KYC was not approved. Please review the feedback and resubmit via the KYC & AML tab.'}
          </p>
          <button onClick={()=>setTab('kyc')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{background:'#1A3C5E'}}>
            {!entityKyc ? 'Start Entity KYC →' : entityKyc.status === 'PENDING' ? 'View KYC Status →' : 'Resubmit KYC →'}
          </button>
        </div>
      )}

      {entityKyc?.status === 'APPROVED' && (
    <div className="space-y-6 max-w-2xl">
      {/* Existing applications */}
      {!loadingApps && applications.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">My Applications</h3>
            <span className="text-xs text-gray-500">{applications.length} application(s)</span>
          </div>
          <div className="space-y-2">
            {applications.map(app => (
              <div key={app.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-sm">{app.token_symbol} — {app.entity_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ref: {app.reference_number?.substring(0,16)}... · {new Date(app.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    app.status === 'ADMIN_APPROVED' ? 'bg-green-900/40 text-green-300 border-green-700/50' :
                    app.status === 'REJECTED'       ? 'bg-red-900/40 text-red-300 border-red-700/50' :
                    app.status === 'UNDER_REVIEW'   ? 'bg-blue-900/40 text-blue-300 border-blue-700/50' :
                    'bg-yellow-900/40 text-yellow-300 border-yellow-700/50'
                  }`}>{app.application_status || app.status}</span>
                  {['PENDING','UNDER_REVIEW','REJECTED'].includes(app.status) && (
                    <button onClick={() => deleteSubmission(app.id, app.token_symbol)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/50">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New application form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg">New Tokenisation Application</h3>
            <p className="text-gray-500 text-xs mt-0.5">Apply to list a new asset on TokenEquityX</p>
          </div>
          {savedDraft?.step > 1 && (
            <button onClick={() => { localStorage.removeItem(FORM_KEY); setStep(1); setForm({ legalName:'',registrationNumber:'',jurisdiction:'ZW',sector:'OTHER',assetType:'EQUITY',description:'',websiteUrl:'',foundedYear:'',headquarters:'',useOfProceeds:'',numEmployees:'',tokenName:'',tokenSymbol:'',assetClass:'Private Equity',authorisedShares:'',nominalValueCents:'100',targetRaiseUsd:'',tokenIssuePrice:'1.00',totalSupply:'',expectedYield:'',distributionFrequency:'Quarterly',ceo_name:'',ceo_email:'',ceo_id:'',cfo_name:'',cfo_email:'',cfo_id:'',legal_name:'',legal_email:'',legal_id:'',termsAccepted:false }); }}
              className="text-xs text-red-400 hover:text-red-300">✕ Start fresh</button>
          )}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Step {step} of {STEPS.length}</p>
            <p className="text-xs text-white font-semibold">{STEPS[step-1]}</p>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-1.5 rounded-full transition-all duration-500"
              style={{width:`${(step/STEPS.length)*100}%`, background: GOLD}}/>
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s,i)=>(
              <div key={i} className="flex flex-col items-center">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > i+1 ? 'bg-green-600 text-white' :
                  step === i+1 ? 'text-gray-900' : 'bg-gray-800 text-gray-500'
                }`} style={step===i+1?{background:GOLD}:{}}>
                  {step > i+1 ? '✔' : i+1}
                </div>
                <span className={`text-xs mt-1 hidden md:block ${step===i+1?'text-white font-semibold':'text-gray-600'}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {postMsg && (
          <div className={`rounded-xl p-3 border mb-4 text-sm ${postMsg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':'bg-green-900/40 border-green-700 text-green-300'}`}>
            {postMsg.text}
          </div>
        )}

        {/* STEP 1: Company */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Tell us about the company or entity issuing the token.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Legal Entity Name *</label>
                <input value={form.legalName} onChange={e=>set('legalName',e.target.value)} className={inputCls} placeholder="e.g. ZimGov Securities (Pvt) Ltd"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Registration Number *</label>
                <input value={form.registrationNumber} onChange={e=>set('registrationNumber',e.target.value)} className={inputCls} placeholder="e.g. ZW2024-GOV-001"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Jurisdiction</label>
                <input value={form.jurisdiction} onChange={e=>set('jurisdiction',e.target.value)} className={inputCls} placeholder="ZW"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sector</label>
                <select value={form.sector} onChange={e=>set('sector',e.target.value)} className={inputCls}>
                  {['TECH','FINTECH','AGRICULTURE','MANUFACTURING','MINING','REAL_ESTATE','INFRASTRUCTURE','GOVERNMENT','HEALTHCARE','EDUCATION','LOGISTICS','OTHER'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Asset Type</label>
                <select value={form.assetType} onChange={e=>set('assetType',e.target.value)} className={inputCls}>
                  {['EQUITY','BOND','REIT','REAL_ESTATE','MINING','INFRASTRUCTURE','OTHER'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Year Founded</label>
                <input type="number" value={form.foundedYear} onChange={e=>set('foundedYear',e.target.value)} className={inputCls} placeholder="e.g. 2018"/>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Headquarters</label>
              <input value={form.headquarters} onChange={e=>set('headquarters',e.target.value)} className={inputCls} placeholder="e.g. Harare, Zimbabwe"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Website</label>
              <input value={form.websiteUrl} onChange={e=>set('websiteUrl',e.target.value)} className={inputCls} placeholder="https://example.co.zw"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Business Description *</label>
              <textarea rows={3} value={form.description} onChange={e=>set('description',e.target.value)} className={inputCls+' resize-none'} placeholder="Describe the business or asset being tokenised..."/>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Number of Employees</label>
              <input value={form.numEmployees} onChange={e=>set('numEmployees',e.target.value)} className={inputCls} placeholder="e.g. 10-50"/>
            </div>
            <button onClick={()=>{ if(!form.legalName||!form.registrationNumber||!form.description){setPostMsg({type:'error',text:'Please fill in all required fields.'});return;} setPostMsg(null); goToStep(2); }}
              className="w-full py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>
              Next: Token Structure →
            </button>
          </div>
        )}

        {/* STEP 2: Token */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Define the token that will represent this asset.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Token Name *</label>
                <input value={form.tokenName} onChange={e=>set('tokenName',e.target.value)} className={inputCls} placeholder="e.g. ZimGov Bond 2029"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Token Symbol * (2-5 letters)</label>
                <div className="relative">
                  <input value={form.tokenSymbol}
                    onChange={e=>{ const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,5); set('tokenSymbol',v); checkSymbol(v); }}
                    className={inputCls+(symbolStatus==='taken'?' border-red-500':symbolStatus==='available'?' border-green-500':'')}
                    placeholder="e.g. ZWGB"/>
                  {symbolStatus==='checking'  && <span className="absolute right-3 top-2.5 text-xs text-gray-400">⏳</span>}
                  {symbolStatus==='available' && <span className="absolute right-3 top-2.5 text-xs text-green-400">✅</span>}
                  {symbolStatus==='taken'     && <span className="absolute right-3 top-2.5 text-xs text-red-400">❌</span>}
                </div>
                {symbolStatus==='taken' && <p className="text-xs text-red-400 mt-1">Symbol taken — choose another.</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Asset Class</label>
                <select value={form.assetClass} onChange={e=>set('assetClass',e.target.value)} className={inputCls}>
                  {['Private Equity','Real Estate / REIT','Infrastructure Bond','Corporate Bond','Mining / PGMs','Agriculture','Other'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Authorised Shares</label>
                <input type="number" value={form.authorisedShares} onChange={e=>set('authorisedShares',e.target.value)} className={inputCls} placeholder="e.g. 5000000"/>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>goToStep(1)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
              <button onClick={()=>{ if(!form.tokenName||!form.tokenSymbol){setPostMsg({type:'error',text:'Token name and symbol are required.'});return;} if(symbolStatus==='taken'){setPostMsg({type:'error',text:'Symbol is already taken.'});return;} setPostMsg(null); goToStep(3); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>
                Next: Economics →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Economics */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Define the financial structure of the offering.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Target Raise (USD)</label>
                <input type="number" value={form.targetRaiseUsd} onChange={e=>set('targetRaiseUsd',e.target.value)} className={inputCls} placeholder="e.g. 3000000"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Issue Price (USD)</label>
                <input type="number" value={form.tokenIssuePrice} onChange={e=>set('tokenIssuePrice',e.target.value)} className={inputCls} placeholder="e.g. 1.00"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Total Supply</label>
                <input type="number" value={form.totalSupply} onChange={e=>set('totalSupply',e.target.value)} className={inputCls} placeholder="e.g. 5000000"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Expected Annual Yield %</label>
                <input type="number" value={form.expectedYield} onChange={e=>set('expectedYield',e.target.value)} className={inputCls} placeholder="e.g. 8.5"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Distribution Frequency</label>
                <select value={form.distributionFrequency} onChange={e=>set('distributionFrequency',e.target.value)} className={inputCls}>
                  {['Quarterly','Monthly','Semi-Annual','Annual','Not Applicable'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Use of Proceeds</label>
              <textarea rows={3} value={form.useOfProceeds} onChange={e=>set('useOfProceeds',e.target.value)} className={inputCls+' resize-none'} placeholder="Describe how funds raised will be used..."/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>goToStep(2)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
              <button onClick={()=>{ setPostMsg(null); goToStep(4); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>
                Next: Personnel →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Personnel */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Provide details of key management. All directors must complete KYC.</p>
            {[
              { role:'CEO / Director', prefix:'ceo' },
              { role:'CFO / Financial Officer', prefix:'cfo' },
              { role:'Legal Counsel', prefix:'legal' },
            ].map(({ role, prefix }) => (
              <div key={prefix} className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-300 mb-3">{role}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-xs text-gray-500 block mb-1">Full Name</label><input value={form[`${prefix}_name`]} onChange={e=>set(`${prefix}_name`,e.target.value)} className={inputCls} placeholder="Full name"/></div>
                  <div><label className="text-xs text-gray-500 block mb-1">Email</label><input value={form[`${prefix}_email`]} onChange={e=>set(`${prefix}_email`,e.target.value)} className={inputCls} placeholder="email@example.com"/></div>
                  <div><label className="text-xs text-gray-500 block mb-1">National ID / Passport</label><input value={form[`${prefix}_id`]} onChange={e=>set(`${prefix}_id`,e.target.value)} className={inputCls} placeholder="ID number"/></div>
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={()=>goToStep(3)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
              <button onClick={()=>{ setPostMsg(null); goToStep(5); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>
                Next: Documents →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Documents */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Upload supporting documents. Missing documents can be submitted later but will delay approval.</p>
            <div className="space-y-2">
              {[
                { key:'certificate',   label:'Certificate of Incorporation / SPV Registration', required: true },
                { key:'prospectus',    label:'Prospectus or Information Memorandum (draft accepted)', required: true },
                { key:'financials',    label:'Audited Financial Statements (last 2 years)', required: true },
                { key:'valuation',     label:'Independent Asset Valuation Report', required: true },
                { key:'kyc_docs',      label:'KYC Documents — All Directors', required: true },
                { key:'legal_opinion', label:'Legal Opinion on Asset Ownership' },
                { key:'regulatory',    label:'Environmental / Regulatory Approvals' },
              ].map(doc => (
                <div key={doc.key} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${files[doc.key]?'bg-green-900/20 border-green-700/40':'bg-gray-800/50 border-gray-700/40'}`}>
                  <div className="flex items-center gap-2">
                    <span>{files[doc.key] ? '✅' : '📎'}</span>
                    <div>
                      <p className="text-sm text-white">{doc.label}{doc.required&&<span className="text-red-400 ml-1">*</span>}</p>
                      {files[doc.key] && <p className="text-xs text-green-400">{files[doc.key].name}</p>}
                    </div>
                  </div>
                  <div>
                    <input type="file" ref={el=>fileRefs.current[doc.key]=el} onChange={handleFile(doc.key)} className="hidden" accept=".pdf,.doc,.docx,.xlsx"/>
                    <button onClick={()=>fileRefs.current[doc.key]?.click()}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white">
                      {files[doc.key] ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>goToStep(4)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
              <button onClick={()=>{ setPostMsg(null); goToStep(6); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>
                Next: Review & Submit →
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Review & Submit */}
        {step === 6 && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Review your application before submitting.</p>
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
              {[
                ['Legal Entity',     form.legalName],
                ['Registration No.', form.registrationNumber],
                ['Token Symbol',     form.tokenSymbol],
                ['Token Name',       form.tokenName],
                ['Asset Type',       form.assetType],
                ['Asset Class',      form.assetClass],
                ['Sector',           form.sector],
                ['Jurisdiction',     form.jurisdiction],
                ['Target Raise',     form.targetRaiseUsd ? `$${parseFloat(form.targetRaiseUsd).toLocaleString()}` : '—'],
                ['Issue Price',      `$${form.tokenIssuePrice}`],
                ['Total Supply',     form.totalSupply ? parseInt(form.totalSupply).toLocaleString() : '—'],
                ['Annual Yield',     form.expectedYield ? `${form.expectedYield}%` : '—'],
                ['Distribution',     form.distributionFrequency],
                ['CEO',              form.ceo_name || '—'],
                ['Documents',        `${Object.keys(files).length} uploaded`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-gray-700/50 last:border-0">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-medium text-right max-w-xs truncate">{value}</span>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-gray-800/50 rounded-xl p-4">
              <input type="checkbox" checked={form.termsAccepted} onChange={e=>set('termsAccepted',e.target.checked)} className="mt-0.5 flex-shrink-0"/>
              <span className="text-xs text-gray-300">I confirm that all information provided is accurate and complete. I understand that submitting false or misleading information may result in rejection and potential regulatory referral under the Securities and Exchange Act (Chapter 24:25).</span>
            </label>
            <div className="flex gap-3">
              <button onClick={()=>goToStep(5)} className="px-6 py-2.5 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">← Back</button>
              <button onClick={submit} disabled={submitting || !form.termsAccepted}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
                style={{background:NAVY}}>
                {submitting ? '⏳ Submitting...' : '🚀 Submit Tokenisation Application'}
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center">Platform issuance fee: 0.25% of total raise value, payable on SECZ approval.</p>
          </div>
        )}
      </div>
    </div>
    )}
    </>
  );
}

// ── CONSTANTS ───────────────────────────────────────────────────
const COMPLIANCE_STEPS = [
  { key:'spv',      label:'SPV Registered',          desc:'Legal entity registered with Registrar of Companies' },
  { key:'kyc',      label:'KYC/AML Approved',         desc:'All directors and beneficial owners verified' },
  { key:'docs',     label:'Documents Uploaded',       desc:'Prospectus, financials, legal opinion submitted' },
  { key:'auditor',  label:'Auditor Sign-off',          desc:'Financial data reviewed and oracle price approved' },
  { key:'contract', label:'Smart Contract Deployed',  desc:'Token contract deployed and tested on Polygon' },
  { key:'secz',     label:'SECZ Sandbox Approved',    desc:'Regulatory sandbox designation received' },
];
const mockPriceHistory = Array.from({length:30},(_,i)=>({
  day:`Mar ${i+1}`, price:1.00+Math.sin(i/5)*0.02+i*0.001, volume:Math.floor(30000+Math.random()*100000)
}));
const mockHolderBreakdown = [
  {type:'Institutional',pct:42,count:12},{type:'Accredited Retail',pct:35,count:52},
  {type:'Family Office',pct:15,count:5},{type:'Corporate Treasury',pct:8,count:3},
];
const mockObligations = [
  {id:1,task:'Q1 2026 Financial Data Submission',due:'2026-04-15',status:'UPCOMING',priority:'HIGH'},
  {id:2,task:'Annual Compliance Report',due:'2026-06-30',status:'UPCOMING',priority:'MEDIUM'},
  {id:3,task:'AGM Notice — 21 days prior',due:'2026-06-09',status:'UPCOMING',priority:'HIGH'},
  {id:4,task:'Annual General Meeting',due:'2026-06-30',status:'UPCOMING',priority:'HIGH'},
  {id:5,task:'KYC Re-verification (annual)',due:'2026-12-31',status:'UPCOMING',priority:'LOW'},
];
const PRIORITY_COLORS = {
  HIGH:'bg-red-900/40 text-red-300 border-red-800',
  MEDIUM:'bg-amber-900/40 text-amber-300 border-amber-800',
  LOW:'bg-gray-800 text-gray-400 border-gray-700',
};
const HOLDER_COLORS = [NAVY, GOLD, '#0891b2', '#7c3aed'];

function IssuerOfferingTab({ notify }) {
  const [offerings,  setOfferings]  = useState([]);
  const [tokens,     setTokens]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    token_id:'', offering_price_usd:'', target_raise_usd:'',
    min_subscription_usd:'100', max_subscription_usd:'',
    total_tokens_offered:'', subscription_deadline:'', offering_rationale:''
  });
  const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const hdrs = () => ({ Authorization:`Bearer ${localStorage.getItem('token')}`, 'Content-Type':'application/json' });
  const fmt  = n => { const v=parseFloat(n||0); if(v>=1e6) return `$${(v/1e6).toFixed(2)}M`; if(v>=1e3) return `$${(v/1e3).toFixed(1)}K`; return `$${v.toFixed(2)}`; };
  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600";
  const STATUS_COLORS = {
    PENDING_APPROVAL: 'bg-amber-900/50 text-amber-300',
    AUDITOR_REVIEWED: 'bg-blue-900/50 text-blue-300',
    OPEN:             'bg-green-900/50 text-green-300',
    DISBURSED:        'bg-purple-900/50 text-purple-300',
    CANCELLED:        'bg-red-900/50 text-red-300',
  };
  const STATUS_MESSAGES = {
    PENDING_APPROVAL: 'Your offering proposal has been submitted and is awaiting auditor review.',
    AUDITOR_REVIEWED: 'The auditor has reviewed your proposal. Awaiting final admin approval.',
    OPEN:             'Your offering is live. Investors can now subscribe.',
    DISBURSED:        'Offering closed. Proceeds have been credited to your wallet.',
    CANCELLED:        'This offering was cancelled. Please contact support if this was unexpected.',
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/offerings`, { headers: hdrs() }).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/assets`, { headers: hdrs() }).then(r=>r.json()).catch(()=>[]),
    ]).then(([offs, toks]) => {
      if (Array.isArray(offs)) setOfferings(offs);
      if (Array.isArray(toks)) setTokens(toks.filter(t => t.status === 'ACTIVE' || t.market_state === 'PRE_LAUNCH'));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const submitOffering = async () => {
    if (!form.token_id || !form.offering_price_usd || !form.target_raise_usd || !form.total_tokens_offered || !form.subscription_deadline) {
      notify('error', 'Please fill in all required fields.'); return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch(`${API}/offerings`, { method:'POST', headers: hdrs(), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { notify('error', data.error || 'Submission failed'); setSubmitting(false); return; }
      notify('success', data.message);
      setShowForm(false); loadData();
    } catch { notify('error', 'Could not submit offering'); }
    setSubmitting(false);
  };

  if (loading) return <div className="text-center py-8 text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Primary Offering</h2>
          <p className="text-gray-500 text-sm mt-0.5">Propose a fundraising round for your token.</p>
        </div>
        {offerings.length === 0 && !showForm && (
          <button onClick={()=>setShowForm(true)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600">+ Propose Offering</button>
        )}
      </div>

      {/* Existing offerings status */}
      {offerings.map(o=>(
        <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">{o.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status]||''}`}>{o.status?.replace('_',' ')}</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{STATUS_MESSAGES[o.status]}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Offering Price',   `$${parseFloat(o.offering_price_usd).toFixed(4)}`],
              ['Target Raise',     fmt(o.target_raise_usd)],
              ['Total Raised',     fmt(o.total_raised_usd)],
              ['Subscribers',      o.subscriber_count || 0],
              ['Subscription Deadline', new Date(o.subscription_deadline).toLocaleDateString('en-GB')],
              ['Issuance Fee',     `${(parseFloat(o.issuance_fee_rate||0)*100).toFixed(1)}%`],
            ].map(([l,v])=>(
              <div key={l} className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{l}</p>
                <p className="font-semibold">{v}</p>
              </div>
            ))}
          </div>
          {o.status === 'AUDITOR_REVIEWED' && o.auditor_recommendation && (
            <div className={`rounded-lg p-3 text-sm border ${o.auditor_recommendation==='APPROVE'?'bg-green-900/20 border-green-800/40':o.auditor_recommendation==='REJECT'?'bg-red-900/20 border-red-800/40':'bg-amber-900/20 border-amber-800/40'}`}>
              <p className="font-semibold mb-1">🔍 Auditor Recommendation: {o.auditor_recommendation?.replace('_',' ')}</p>
              {o.auditor_notes && <p className="text-xs text-gray-300">{o.auditor_notes}</p>}
            </div>
          )}
          {o.status === 'DISBURSED' && (
            <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3">
              <p className="text-green-300 font-semibold text-sm mb-1">✅ Proceeds Received</p>
              <p className="text-xs text-gray-300">Net proceeds of <span className="text-green-400 font-bold">{fmt(o.net_proceeds_usd)}</span> have been credited to your wallet.</p>
              {o.bank_reference && <p className="text-xs text-gray-500 mt-1">Bank ref: {o.bank_reference}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Propose new offering form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Propose a Primary Offering</h3>
            <button onClick={()=>setShowForm(false)} className="text-gray-500 hover:text-white text-sm">Cancel</button>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 text-xs text-blue-300">
            ℹ️ Your proposal will be reviewed by an auditor and then approved by the platform admin before going live. The platform charges a 2% issuance fee on total proceeds raised.
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Token *</label>
            <select value={form.token_id} onChange={e=>setForm(f=>({...f,token_id:e.target.value}))} className={inputCls}>
              <option value="">— Select your token —</option>
              {tokens.map(t=><option key={t.id} value={t.id}>{t.token_symbol||t.symbol} — {t.token_name||t.name||t.company_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 block mb-1">Offering Price (USD) *</label><input type="number" value={form.offering_price_usd} onChange={e=>setForm(f=>({...f,offering_price_usd:e.target.value}))} className={inputCls} placeholder="e.g. 1.00"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Target Raise (USD) *</label><input type="number" value={form.target_raise_usd} onChange={e=>setForm(f=>({...f,target_raise_usd:e.target.value}))} className={inputCls} placeholder="e.g. 2000000"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Total Tokens Offered *</label><input type="number" value={form.total_tokens_offered} onChange={e=>setForm(f=>({...f,total_tokens_offered:e.target.value}))} className={inputCls} placeholder="e.g. 2000000"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Subscription Deadline *</label><input type="datetime-local" value={form.subscription_deadline} onChange={e=>setForm(f=>({...f,subscription_deadline:e.target.value}))} className={inputCls}/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Min Subscription (USD)</label><input type="number" value={form.min_subscription_usd} onChange={e=>setForm(f=>({...f,min_subscription_usd:e.target.value}))} className={inputCls} placeholder="100"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Max Subscription (USD)</label><input type="number" value={form.max_subscription_usd} onChange={e=>setForm(f=>({...f,max_subscription_usd:e.target.value}))} className={inputCls} placeholder="Optional"/></div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Offering Rationale</label>
            <textarea rows={3} value={form.offering_rationale} onChange={e=>setForm(f=>({...f,offering_rationale:e.target.value}))}
              className={inputCls+' resize-none'}
              placeholder="Explain the purpose of this fundraise, how proceeds will be used, and why the price reflects fair value."/>
          </div>
          <button onClick={submitOffering} disabled={submitting}
            className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40 bg-blue-700 hover:bg-blue-600">
            {submitting ? '⏳ Submitting…' : '📤 Submit Offering Proposal'}
          </button>
        </div>
      )}

      {offerings.length === 0 && !showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">🏦</p>
          <p className="font-semibold mb-2">No offering proposed yet</p>
          <p className="text-gray-500 text-sm mb-5">Once your token has been approved through the pipeline, you can propose a primary fundraising round here. The platform admin and auditor will review your proposal before it goes live to investors.</p>
          <button onClick={()=>setShowForm(true)} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600">+ Propose an Offering</button>
        </div>
      )}
    </div>
  );
}

// ── MAIN DASHBOARD ──────────────────────────────────────────────
export default function IssuerDashboard() {
  const { account, user, ready } = useWallet();
  const router = useRouter();

  const [myTokens,       setMyTokens]       = useState([]);
  const [actionMsg,      setActionMsg]      = useState(null);
  const [selToken,       setSelToken]       = useState(null);
  const [trades,         setTrades]         = useState([]);
  const [dividends,      setDividends]      = useState([]);
  const [proposals,      setProposals]      = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [entityKyc,      setEntityKyc]      = useState(null);
  const [kycLoaded,      setKycLoaded]      = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const handler = (e) => setTab(e.detail.tab);
    window.addEventListener('issuer-tab-change', handler);
    return () => window.removeEventListener('issuer-tab-change', handler);
  }, []);
  const [loading,        setLoading]        = useState(true);
  const [statement,      setStatement]      = useState('');
  const [postMsg,        setPostMsg]        = useState(null);
  const [newDiv,         setNewDiv]         = useState({ amount:'', description:'' });

  useEffect(() => {
    const _u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!_u?.role) return;
    if (!['ISSUER','ADMIN'].includes(_u?.role)) { window.location.href = '/'; return; }
    loadAll();
  }, [ready]);

  const loadAll = async () => {
    try {
      const [tokRes, tradeRes, divRes, propRes, appRes, kycRes] = await Promise.allSettled([
        api.get('/assets/my'),
        api.get('/trading/recent?limit=20'),
        api.get('/dividends/rounds'),
        api.get('/governance/proposals'),
        api.get('/submissions/my'),
        api.get('/entity-kyc/my'),
      ]);
      const myToks = (tokRes.status==='fulfilled' ? tokRes.value.data : []);
      setMyTokens(myToks);
      if (myToks.length > 0) setSelToken(myToks[0]);
      if (tradeRes.status==='fulfilled') setTrades(tradeRes.value.data||[]);
      if (divRes.status==='fulfilled')   setDividends(divRes.value.data||[]);
      if (propRes.status==='fulfilled')  setProposals(propRes.value.data||[]);
      if (appRes.status==='fulfilled')   setMyApplications(appRes.value.data||[]);
      if (kycRes.status==='fulfilled')   { setEntityKyc(kycRes.value.data); setKycLoaded(true); }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const t       = selToken;
  const price   = parseFloat(t?.oracle_price || t?.current_price_usd || 1.00);
  const supply  = parseFloat(t?.total_supply || t?.issued_shares || 1000000);
  const mktCap  = price * supply;
  const amtRaised   = mktCap * 0.25;
  const raisedTarget = 5000000;
  const raisedPct   = Math.min(100, Math.round((amtRaised/raisedTarget)*100));
  const holders = 0;
  const vol24h  = 0;
  const compliance = {spv:true,kyc:true,docs:true,auditor:false,contract:false,secz:false};
  const compDone = Object.values(compliance).filter(Boolean).length;
  const compPct  = Math.round((compDone/COMPLIANCE_STEPS.length)*100);
  const notify = (type, text) => { setActionMsg({ type, text }); setTimeout(() => setActionMsg(null), 3500); };

  if (typeof window === 'undefined') return null;
  if (!JSON.parse(localStorage.getItem('user') || '{}')?.role) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* USER BAR */}
      <div className="border-b border-gray-800 px-6 py-2 bg-gray-900/60">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <p className="text-gray-400 text-xs font-medium">Issuer Portal — {t?.company_name || 'TokenEquityX'}</p>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.email||'User'}</span>
            <Inbox token={typeof window !== 'undefined' ? localStorage.getItem('token') : ''} />
            <button onClick={()=>window.location.href='/profile'} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Profile</button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="flex gap-1 border-b border-gray-800 mb-6">
          {[
            { key:'overview', label:'Overview' },
            { key:'kyc',      label:'KYC & AML' },
            { key:'journey',  label:'Application Journey' },
          ].map(item=>(
            <button key={item.key} onClick={()=>setTab(item.key)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab===item.key
                  ? 'border-yellow-500 text-yellow-400'
                  : 'border-transparent text-gray-500 hover:text-gray-200 hover:border-gray-600'
              }`}>
              {item.label}
            </button>
          ))}
        </div>
        {actionMsg && (
          <div className={`rounded-xl p-4 border mb-4 text-sm ${actionMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':actionMsg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':actionMsg.type==='warning'?'bg-amber-900/40 border-amber-700 text-amber-300':'bg-blue-900/40 border-blue-700 text-blue-300'}`}>{actionMsg.text}</div>
        )}
        {postMsg && (
          <div className={`rounded-xl p-4 border mb-6 ${postMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':postMsg.type==='info'?'bg-blue-900/40 border-blue-700 text-blue-300':'bg-red-900/40 border-red-700 text-red-300'}`}>
            {postMsg.text}
          </div>
        )}

        {/* ══ OVERVIEW ══ */}
        {tab==='overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
              {[
                {label:'Token Price',   value:`$${price.toFixed(4)}`,          sub:'oracle price',          color:'text-white'},
                {label:'Market Cap',    value:fmt(mktCap),                     sub:'total supply × price',  color:'text-yellow-400'},
                {label:'Capital Raised',value:fmt(amtRaised),                  sub:`${raisedPct}% of target`,color:'text-green-400'},
                {label:'24h Volume',    value:fmt(vol24h),                     sub:'secondary trading',     color:'text-white'},
                {label:'Token Holders', value:holders,                         sub:'verified investors',    color:'text-white'},
                {label:'Market State',  value:t?.market_state?.replace('_',' ')||'FULL TRADING',sub:'SECZ approved',color:'text-green-400'},
              ].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-600 text-xs mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Price & Trading Volume — 30 Days</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mockPriceHistory}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} interval={4}/>
                  <YAxis yAxisId="price" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>`$${v.toFixed(3)}`}/>
                  <YAxis yAxisId="vol" orientation="right" tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/>
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}}/>
                  <Bar yAxisId="vol" dataKey="volume" fill="#1A3C5E" opacity={0.5} radius={[2,2,0,0]}/>
                  <Area yAxisId="price" type="monotone" dataKey="price" stroke={GOLD} fill="url(#priceGrad)" strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {myApplications.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 xl:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">📋 My Applications & Submissions</h3>
                    <button onClick={()=>setTab('journey')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {myApplications.slice(0,3).map((app,i)=>{
                      const SC={PENDING:'text-amber-400',UNDER_REVIEW:'text-blue-400',INFO_REQUESTED:'text-purple-400',APPROVED:'text-green-400',REJECTED:'text-red-400'};
                      const SI={PENDING:'⏳',UNDER_REVIEW:'🔍',INFO_REQUESTED:'📋',APPROVED:'✅',REJECTED:'❌'};
                      return (
                        <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:border-gray-500" onClick={()=>setTab('journey')}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">{app.token_symbol}</span>
                            <span className={`text-xs font-bold ${SC[app.status]||'text-gray-400'}`}>{SI[app.status]} {app.status?.replace('_',' ')}</span>
                          </div>
                          <p className="text-gray-400 text-xs">{app.submission_type==='TOKENISATION_APPLICATION'?'Tokenisation Application':`Financial Submission — ${app.period}`}</p>
                          {app.reference_number&&<p className="font-mono text-xs text-gray-500 mt-1">Ref: {app.reference_number}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Capital Raised vs Target</h3>
                <div className="flex items-end justify-between mb-2">
                  <div><p className="text-3xl font-bold text-green-400">{fmt(amtRaised)}</p><p className="text-gray-500 text-sm">of {fmt(raisedTarget)} target</p></div>
                  <p className="text-2xl font-bold text-white">{raisedPct}%</p>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-4 mb-4">
                  <div className="h-4 rounded-full transition-all duration-700" style={{width:`${raisedPct}%`,background:GREEN}}/>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[['Total Supply',`${(supply/1e6).toFixed(1)}M tokens`],['Price per Token',`$${price.toFixed(4)}`],['Tokens Sold',`${((amtRaised/price)/1e6).toFixed(2)}M`],['Remaining',`${(((raisedTarget-amtRaised)/price)/1e6).toFixed(2)}M`]].map(([k,v],i)=>(
                    <div key={i} className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs">{k}</p><p className="font-semibold mt-0.5">{v}</p></div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Listing Compliance Status</h3>
                  <span className="text-yellow-400 font-bold">{compPct}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                  <div className="h-2 rounded-full" style={{width:`${compPct}%`,background:GOLD}}/>
                </div>
                <div className="space-y-2">
                  {COMPLIANCE_STEPS.map((step,i)=>{
                    const done = compliance[step.key];
                    const isNext = !done && Object.values(compliance).filter(Boolean).length===i;
                    return (
                      <div key={step.key} className={`flex items-start gap-3 p-3 rounded-lg border ${done?'bg-green-900/20 border-green-800/40':isNext?'bg-amber-900/20 border-amber-700/60':'bg-gray-800/30 border-gray-800'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done?'bg-green-600 text-white':isNext?'bg-amber-600 text-white':'bg-gray-700 text-gray-500'}`}>
                          {done?'✓':isNext?'→':(i+1)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${done?'text-green-300':isNext?'text-amber-300':'text-gray-500'}`}>{step.label}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Upcoming Obligations</h3>
              <div className="space-y-2">
                {mockObligations.map(o=>(
                  <div key={o.id} className={`flex items-center justify-between rounded-lg p-3 border ${PRIORITY_COLORS[o.priority]}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full">{o.priority}</span>
                      <p className="text-sm font-medium text-white">{o.task}</p>
                    </div>
                    <p className="text-sm font-mono">{dt(o.due)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ JOURNEY ══ */}
        {tab==='journey' && (
          <div className="space-y-8">

            {/* My Registered Assets */}
            {myTokens.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">My Registered Assets</h3>
                    <p className="text-gray-500 text-xs mt-0.5">All tokens registered under your account</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {myTokens.map(t => {
                    const sym = t.token_symbol || t.symbol || '?';
                    const statusColor = t.status === 'ACTIVE' ? 'bg-green-900/40 text-green-300 border-green-700/50' :
                                       t.status === 'DRAFT'  ? 'bg-gray-800 text-gray-400 border-gray-700' :
                                       'bg-yellow-900/40 text-yellow-300 border-yellow-700/50';
                    const marketColor = t.market_state === 'P2P_ONLY' ? 'text-purple-400' :
                                       t.market_state === 'FULL_TRADING' ? 'text-blue-400' :
                                       t.market_state === 'PRIMARY_ONLY' ? 'text-green-400' : 'text-gray-500';
                    return (
                      <div key={t.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{background: NAVY}}>{sym[0]}</div>
                          <div>
                            <p className="font-semibold text-white text-sm">{sym}</p>
                            <p className="text-gray-500 text-xs">{t.token_name || t.name || t.company_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor}`}>{t.status}</span>
                          <span className={`text-xs font-medium ${marketColor}`}>{t.market_state?.replace('_',' ')}</span>
                          <span className="text-xs text-gray-400">${parseFloat(t.current_price_usd || t.oracle_price || 1).toFixed(4)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STEP 1: Tokenisation Application ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">1</div>
                <div>
                  <h2 className="font-bold text-lg">Tokenisation Application</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Submit your tokenisation proposal for compliance review</p>
                </div>
              </div>
              <div className="p-6">
                {myApplications.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg">My Applications</h3>
                      <span className="text-xs text-gray-500">{myApplications.length} application(s)</span>
                    </div>
                    <div className="space-y-2">
                      {myApplications.map(app => (
                        <div key={app.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-4 py-3">
                          <div>
                            <p className="font-semibold text-sm">{app.token_symbol} — {app.entity_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Ref: {app.reference_number?.substring(0,20)}... · {new Date(app.created_at).toLocaleDateString('en-GB')}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            app.status === 'ADMIN_APPROVED' ? 'bg-green-900/40 text-green-300 border-green-700/50' :
                            app.status === 'REJECTED'       ? 'bg-red-900/40 text-red-300 border-red-700/50' :
                            app.status === 'UNDER_REVIEW'   ? 'bg-blue-900/40 text-blue-300 border-blue-700/50' :
                            'bg-yellow-900/40 text-yellow-300 border-yellow-700/50'
                          }`}>{app.application_status || app.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <TokenisationTab notify={notify} entityKyc={entityKyc} setTab={setTab}/>
              </div>
            </div>

            {/* ── STEP 2: Financial Data & Valuation ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">2</div>
                <div>
                  <h2 className="font-bold text-lg">Financial Data & Valuation</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Submit financial data for auditor review and token pricing</p>
                </div>
              </div>
              <FinancialsTab t={selToken} price={price} account={account} setPostMsg={setPostMsg} NAVY={NAVY} />
            </div>

            {/* ── STEP 3: Primary Offering ── */}
            {myTokens && myTokens.some(t => t.status === 'ACTIVE') ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">3</div>
                  <div>
                    <h2 className="font-bold text-lg">Primary Offering</h2>
                    <p className="text-gray-500 text-xs mt-0.5">Propose a fundraising round once your token is approved</p>
                  </div>
                </div>
                <div className="p-6">
                  <IssuerOfferingTab notify={notify} />
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 opacity-60">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-black text-yellow-400 opacity-30">3</span>
                  <div>
                    <h3 className="font-bold text-lg text-gray-400">Primary Offering</h3>
                    <p className="text-gray-600 text-sm">Available after your token is approved through the compliance pipeline.</p>
                  </div>
                </div>
                <div className="border border-gray-800 rounded-xl p-4 text-center">
                  <p className="text-gray-600 text-sm">🔒 Complete steps 1 and 2 first — submit your tokenisation application and financial data. Once your token is approved by admin, you can propose a primary offering here.</p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ══ REPORTING ══ */}
        {tab==='reporting' && (
          <FinancialsTab t={selToken} price={price} account={account} setPostMsg={setPostMsg} NAVY={NAVY} />
        )}

        {/* ══ INVESTORS ══ */}
        {tab==='investors' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">👥</p>
            <h3 className="font-bold text-lg mb-2">Investor Relations</h3>
            <p className="text-gray-500 text-sm">View your investor base, subscription history and investor communications. Coming soon.</p>
          </div>
        )}

        {/* ══ TRADING ══ */}
        {tab==='trading' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Trading Activity</h2>
            <div className="grid grid-cols-4 gap-4">
              {[{label:'24h Volume',value:fmt(vol24h)},{label:'Trades Today',value:'14'},{label:'Avg Price',value:`$${price.toFixed(4)}`},{label:'Spread',value:'0.12%'}].map((k,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Recent Trades — {t?.symbol}</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Time','Side','Qty','Price','Value','Status'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
                <tbody>
                  {Array.from({length:8},(_,i)=>{
                    const side=i%3===0?'SELL':'BUY'; const qty=Math.floor(100+Math.random()*2000);
                    const p2=(price*(.98+Math.random()*.04)).toFixed(4);
                    return (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{new Date(Date.now()-i*600000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="py-2 pr-4"><span className={`text-xs font-bold ${side==='BUY'?'text-green-400':'text-red-400'}`}>{side}</span></td>
                        <td className="py-2 pr-4">{qty.toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono">${p2}</td>
                        <td className="py-2 pr-4 text-yellow-400">{fmt(qty*parseFloat(p2))}</td>
                        <td className="py-2"><span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">SETTLED</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ COMMUNICATIONS ══ */}
        {tab==='communications' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-xl font-bold">Investor Communications</h2>
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 text-sm text-amber-300">
              ⚠️ All communications are published to the TokenEquityX platform and visible to all token holders.
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-1">Post Management Statement</h3>
              <p className="text-gray-500 text-xs mb-4">Regular updates from management — quarterly results, material developments, operational updates.</p>
              <textarea value={statement} onChange={e=>setStatement(e.target.value)} rows={5}
                placeholder="Write your management update here..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-blue-600"/>
              <div className="flex items-center justify-between mt-3">
                <span className="text-gray-500 text-xs">{statement.length} characters</span>
                <button onClick={()=>{setPostMsg({type:'success',text:'Statement published.'});setStatement('');setTimeout(()=>setPostMsg(null),4000);}}
                  className="px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>Publish Statement</button>
              </div>
            </div>
          </div>
        )}


        {/* ══ ENTITY KYC ══ */}
        {tab==='kyc' && (
          <EntityKycTab
            entityKyc={entityKyc}
            kycLoaded={kycLoaded}
            onSubmitted={(kyc) => setEntityKyc(kyc)}
            API={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}
            NAVY={NAVY}
            GOLD={GOLD}
          />
        )}

        {/* ══ GOVERNANCE ══ */}
        {tab==='governance' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-xl font-bold">Governance & Proposals</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Create New Proposal</h3>
              <div className="space-y-4">
                <div><label className="text-sm text-gray-400 block mb-1">Proposal Title</label>
                  <input id="prop-title" placeholder="e.g. Approve Phase 2 Capital Expenditure" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600"/></div>
                <div><label className="text-sm text-gray-400 block mb-1">Description</label>
                  <textarea id="prop-desc" rows={4} placeholder="Provide full context for your proposal." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600 resize-none"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-gray-400 block mb-1">Voting Opens</label><input type="date" id="prop-start" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600"/></div>
                  <div><label className="text-sm text-gray-400 block mb-1">Voting Closes</label><input type="date" id="prop-end" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600"/></div>
                </div>
              </div>
              <button onClick={async()=>{
                const title=document.getElementById('prop-title')?.value;
                const end=document.getElementById('prop-end')?.value;
                if(!title||!end){setPostMsg({type:'error',text:'Please fill in Title and Voting Close date.'});return;}
                try{await api.post('/governance/propose',{tokenSymbol:t?.symbol||'HCPR',title,description:document.getElementById('prop-desc')?.value,endTime:new Date(end).toISOString()});}catch{}
                setPostMsg({type:'success',text:'Proposal created. All token holders have been notified.'});
                setTimeout(()=>setPostMsg(null),5000);
              }} className="mt-4 w-full py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>
                📋 Submit Proposal for Vote
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Active Proposals</h3>
              {(proposals.length?proposals:[{id:1,title:'Approve Phase 2 Capital Expenditure',votes_for:340,votes_against:45,votes_abstain:15,end_time:new Date(Date.now()+5*86400000).toISOString(),status:'ACTIVE'}]).map(p=>{
                const total=Number(p.votes_for)+Number(p.votes_against)+Number(p.votes_abstain);
                const forPct=total>0?Math.round((p.votes_for/total)*100):0;
                const againstPct=total>0?Math.round((p.votes_against/total)*100):0;
                const daysLeft=Math.max(0,Math.ceil((new Date(p.end_time)-new Date())/(1000*60*60*24)));
                return (
                  <div key={p.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='ACTIVE'?'bg-green-900/50 text-green-300':'bg-gray-700 text-gray-500'}`}>{p.status}</span>
                      <span className="text-xs text-gray-500">{daysLeft} days left · {total} votes</span>
                    </div>
                    <p className="font-semibold mb-3">{p.title}</p>
                    {[['FOR',forPct,'bg-green-500','text-green-400'],['AGAINST',againstPct,'bg-red-500','text-red-400']].map(([l,v,bar,txt])=>(
                      <div key={l} className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-bold w-16 ${txt}`}>{l}</span>
                        <div className="flex-1 bg-gray-700 rounded-full h-2"><div className={`h-2 rounded-full ${bar}`} style={{width:`${v}%`}}/></div>
                        <span className="text-xs text-gray-400 w-8">{v}%</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ DIVIDENDS ══ */}
        {tab==='dividends' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-xl font-bold">Dividend Management</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Create New Distribution Round</h3>
              <div className="space-y-4">
                <div><label className="text-sm text-gray-400 block mb-1">Total Amount (USDC)</label>
                  <input value={newDiv.amount} onChange={e=>setNewDiv(d=>({...d,amount:e.target.value}))} placeholder="e.g. 23000" type="number" min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600"/>
                  {newDiv.amount&&<p className="text-xs text-gray-500 mt-1">Per token: ${(parseFloat(newDiv.amount||0)/supply).toFixed(6)} USDC</p>}
                </div>
                <div><label className="text-sm text-gray-400 block mb-1">Description</label>
                  <input value={newDiv.description} onChange={e=>setNewDiv(d=>({...d,description:e.target.value}))} placeholder="e.g. Q1 2026 Rental Distribution"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600"/>
                </div>
                <div><label className="text-sm text-gray-400 block mb-1">Claim Window Deadline</label>
                  <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600"/>
                </div>
              </div>
              <button onClick={()=>{setPostMsg({type:'success',text:`Dividend round created. ${holders} holders notified.`});setNewDiv({amount:'',description:''});setTimeout(()=>setPostMsg(null),4000);}}
                className="w-full mt-4 py-3 rounded-xl font-semibold text-white" style={{background:GREEN}}>
                💰 Create Distribution Round
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Distribution History</h3>
              <div className="space-y-3">
                {[{desc:'Q1 2026 Rental Distribution',amount:'$23,000',perToken:'$0.023',date:'01 Apr 2026',claimed:'82%',status:'OPEN'},{desc:'Q4 2025 Rental Distribution',amount:'$21,800',perToken:'$0.0218',date:'01 Jan 2026',claimed:'100%',status:'COMPLETE'},{desc:'Q3 2025 Rental Distribution',amount:'$20,200',perToken:'$0.0202',date:'01 Oct 2025',claimed:'98%',status:'COMPLETE'}].map((d,i)=>(
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{d.desc}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.status==='OPEN'?'bg-green-900/50 text-green-300':'bg-gray-700 text-gray-400'}`}>{d.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>Total: <span className="text-white font-semibold">{d.amount}</span></span>
                      <span>Per token: <span className="text-yellow-400">{d.perToken}</span></span>
                      <span>Date: {d.date}</span>
                      <span>Claimed: <span className="text-green-400">{d.claimed}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ RESOURCES ══ */}
        {tab==='resources' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4">📚 Issuer Resources</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title:'SECZ Regulatory Sandbox Guidelines', desc:'Rules and requirements for operating under the SECZ Innovation Hub sandbox.', icon:'🏛️' },
                { title:'TokenEquityX Issuer Guide', desc:'Step-by-step guide to listing your asset on the platform.', icon:'📋' },
                { title:'KYC & AML Requirements', desc:'What documents you need for entity verification and AML compliance.', icon:'🪪' },
                { title:'Valuation Methodology', desc:'How the TokenEquityX valuation engine works and what data it uses.', icon:'📊' },
                { title:'Smart Contract Overview', desc:'How your token will be deployed on Polygon PoS blockchain.', icon:'⛓️' },
                { title:'Investor Relations Guide', desc:'How to communicate with your token holders and manage distributions.', icon:'👥' },
              ].map((r, i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4">
                  <p className="text-2xl mb-2">{r.icon}</p>
                  <p className="font-semibold text-sm text-white mb-1">{r.title}</p>
                  <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}