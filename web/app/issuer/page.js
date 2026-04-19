'use client';
import { useWallet } from '../../hooks/useWallet';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
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

// ── TOKENIZE TAB ────────────────────────────────────────────────
function TokenizeTab({ setPostMsg, NAVY }) {
  const [step, setStep]           = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [files, setFiles]         = useState({});
  const fileRefs = useRef({});
  const [form, setForm] = useState({
    legalEntityName:'', registrationNumber:'', proposedSymbol:'', tokenName:'',
    assetClass:'Real Estate / REIT', assetDescription:'', jurisdiction:'Zimbabwe',
    targetRaiseUsd:'', tokenIssuePrice:'1.00', totalSupply:'',
    expectedYield:'', distributionFrequency:'Quarterly',
    ceo_name:'', ceo_email:'', ceo_id:'',
    cfo_name:'', cfo_email:'', cfo_id:'',
    legal_name:'', legal_email:'', legal_id:'',
    termsAccepted: false,
  });
  const set = (field, val) => setForm(f=>({...f,[field]:val}));
  const handleFile = (docName) => (e) => { const f=e.target.files[0]; if(f) setFiles(prev=>({...prev,[docName]:f})); };

  const submit = async () => {
    if (!form.termsAccepted) { setPostMsg({type:'error',text:'Please accept the declaration before submitting.'}); return; }
    if (!form.legalEntityName || !form.proposedSymbol || !form.assetDescription) { setPostMsg({type:'error',text:'Please complete all required fields (marked *).'}); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => { if(k!=='termsAccepted') fd.append(k,v); });
      fd.append('keyPersonnel', JSON.stringify([
        {role:'CEO',name:form.ceo_name,email:form.ceo_email,idNumber:form.ceo_id},
        {role:'CFO',name:form.cfo_name,email:form.cfo_email,idNumber:form.cfo_id},
        {role:'Legal Counsel',name:form.legal_name,email:form.legal_email,idNumber:form.legal_id},
      ].filter(p=>p.name)));
      Object.values(files).forEach(f=>fd.append('documents',f));
      const res = await api.post('/submissions/tokenise', fd, {headers:{'Content-Type':'multipart/form-data'}});
      setSubmitted(res.data);
      setPostMsg({type:'success',text:`✅ Application submitted. Reference: ${res.data.referenceNumber}`});
    } catch(err) {
      setPostMsg({type:'error',text:err.response?.data?.error||'Submission failed. Please try again.'});
    } finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl">
        <div className="bg-green-900/40 border border-green-700 rounded-2xl p-8 text-center">
          <span className="text-5xl mb-4 block">✅</span>
          <h3 className="font-bold text-xl mb-2">Application Submitted!</h3>
          <p className="text-gray-400 mb-4">{submitted.message}</p>
          <div className="bg-gray-900/50 rounded-xl p-4 text-left space-y-2">
            {[['Reference Number',submitted.referenceNumber,'text-yellow-400'],['Proposed Symbol',submitted.proposedSymbol,'font-bold'],['Documents Uploaded',submitted.documentsUploaded,'font-bold']].map(([l,v,cls])=>(
              <div key={l} className="flex justify-between text-sm"><span className="text-gray-400">{l}</span><span className={cls}>{v}</span></div>
            ))}
          </div>
          <button onClick={()=>setSubmitted(null)} className="mt-6 text-sm text-blue-400 hover:text-blue-300">Submit another application</button>
        </div>
      </div>
    );
  }

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600";
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Submit a Tokenisation Proposal</h2>
        <p className="text-gray-500 text-sm mt-1">Apply to list a new asset on TokenEquityX. Approval typically takes 5–10 business days.</p>
      </div>
      <div className="flex items-center gap-2">
        {['Asset Info','Economics','Personnel','Documents','Submit'].map((s,i)=>(
          <div key={i} className="flex items-center gap-2">
            <button onClick={()=>setStep(i+1)} className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${step===i+1?'text-gray-900':'text-white'}`}
              style={{background:step===i+1?GOLD:step>i+1?'#16a34a':'#374151'}}>{step>i+1?'✓':i+1}</button>
            <span className={`text-xs hidden md:block ${step===i+1?'text-white font-semibold':'text-gray-500'}`}>{s}</span>
            {i<4&&<span className="text-gray-700">—</span>}
          </div>
        ))}
      </div>
      <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 text-sm text-amber-300">
        ⚠️ Ensure your SPV is registered and all directors have completed KYC before submitting.
      </div>
      {step===1&&(
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">1. Asset Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-400 block mb-1">Legal Entity Name *</label><input placeholder="e.g. Harare CBD REIT (Pvt) Ltd" value={form.legalEntityName} onChange={e=>set('legalEntityName',e.target.value)} className={inputCls}/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Registration Number</label><input placeholder="e.g. 1234/2024" value={form.registrationNumber} onChange={e=>set('registrationNumber',e.target.value)} className={inputCls}/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Proposed Token Symbol *</label><input placeholder="e.g. HCPR" value={form.proposedSymbol} onChange={e=>set('proposedSymbol',e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,5))} className={inputCls}/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Token Name</label><input placeholder="e.g. Harare CBD REIT" value={form.tokenName} onChange={e=>set('tokenName',e.target.value)} className={inputCls}/></div>
          </div>
          <div><label className="text-xs text-gray-400 block mb-1">Asset Class *</label>
            <select value={form.assetClass} onChange={e=>set('assetClass',e.target.value)} className={inputCls}>
              {['Real Estate / REIT','Mining / PGMs','Infrastructure Bond','Corporate Bond','Private Equity','Agriculture','Other'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-400 block mb-1">Jurisdiction</label><input value={form.jurisdiction} onChange={e=>set('jurisdiction',e.target.value)} className={inputCls}/></div>
          <div><label className="text-xs text-gray-400 block mb-1">Asset Description *</label><textarea rows={4} placeholder="Describe the underlying asset..." value={form.assetDescription} onChange={e=>set('assetDescription',e.target.value)} className={inputCls+' resize-none'}/></div>
          <button onClick={()=>setStep(2)} className="w-full py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>Next: Token Economics →</button>
        </div>
      )}
      {step===2&&(
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">2. Token Economics</h3>
          <div className="grid grid-cols-3 gap-4">
            {[['Target Raise (USD)','targetRaiseUsd','e.g. 2000000'],['Issue Price (USD)','tokenIssuePrice','e.g. 1.00'],['Total Supply','totalSupply','e.g. 2000000']].map(([l,f,p])=>(
              <div key={f}><label className="text-xs text-gray-400 block mb-1">{l}</label><input type="number" placeholder={p} value={form[f]} onChange={e=>set(f,e.target.value)} className={inputCls}/></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-400 block mb-1">Expected Annual Yield</label><input placeholder="e.g. 9.2% annual rental yield" value={form.expectedYield} onChange={e=>set('expectedYield',e.target.value)} className={inputCls}/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Distribution Frequency</label>
              <select value={form.distributionFrequency} onChange={e=>set('distributionFrequency',e.target.value)} className={inputCls}>
                {['Quarterly','Monthly','Semi-Annual','Annual','Not Applicable'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setStep(1)} className="flex-1 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white">← Back</button>
            <button onClick={()=>setStep(3)} className="flex-1 py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>Next: Key Personnel →</button>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">3. Key Personnel</h3>
          {[['CEO / Director','ceo'],['CFO / Financial Officer','cfo'],['Legal Counsel','legal']].map(([role,prefix])=>(
            <div key={prefix}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{role}</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-400 block mb-1">Full Name</label><input placeholder="Full legal name" value={form[`${prefix}_name`]} onChange={e=>set(`${prefix}_name`,e.target.value)} className={inputCls}/></div>
                <div><label className="text-xs text-gray-400 block mb-1">Email</label><input type="email" placeholder="email@company.com" value={form[`${prefix}_email`]} onChange={e=>set(`${prefix}_email`,e.target.value)} className={inputCls}/></div>
                <div><label className="text-xs text-gray-400 block mb-1">National ID / Passport</label><input placeholder="ID number" value={form[`${prefix}_id`]} onChange={e=>set(`${prefix}_id`,e.target.value)} className={inputCls}/></div>
              </div>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={()=>setStep(2)} className="flex-1 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white">← Back</button>
            <button onClick={()=>setStep(4)} className="flex-1 py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>Next: Documents →</button>
          </div>
        </div>
      )}
      {step===4&&(
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">4. Supporting Documents</h3>
          <p className="text-gray-500 text-xs">Upload what you have. Missing documents can be submitted later but will delay approval.</p>
          {[
            {name:'incorporation',label:'Certificate of Incorporation / SPV Registration',required:true},
            {name:'prospectus',label:'Prospectus or Information Memorandum (draft accepted)',required:true},
            {name:'financials',label:'Audited Financial Statements (last 2 years)',required:true},
            {name:'valuation',label:'Independent Asset Valuation Report',required:true},
            {name:'kyc_docs',label:'KYC Documents — All Directors',required:true},
            {name:'legal_opinion',label:'Legal Opinion on Asset Ownership',required:false},
            {name:'regulatory',label:'Environmental / Regulatory Approvals',required:false},
          ].map(doc=>(
            <div key={doc.name} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
              <div className="flex items-center gap-2 flex-1">
                <span>{files[doc.name]?'✅':'📎'}</span>
                <span className="text-sm text-gray-300">{doc.label}</span>
                {doc.required&&<span className="text-xs text-red-400">*</span>}
                {files[doc.name]&&<span className="text-xs text-gray-500">— {files[doc.name].name}</span>}
              </div>
              <div>
                <input ref={el=>fileRefs.current[doc.name]=el} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden" onChange={handleFile(doc.name)}/>
                <button onClick={()=>fileRefs.current[doc.name]?.click()} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg">{files[doc.name]?'Replace':'Upload'}</button>
              </div>
            </div>
          ))}
          <div className="flex gap-3 mt-2">
            <button onClick={()=>setStep(3)} className="flex-1 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white">← Back</button>
            <button onClick={()=>setStep(5)} className="flex-1 py-3 rounded-xl font-semibold text-white" style={{background:NAVY}}>Next: Review & Submit →</button>
          </div>
        </div>
      )}
      {step===5&&(
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">5. Review & Submit</h3>
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
            {[['Entity',form.legalEntityName],['Proposed Symbol',form.proposedSymbol],['Asset Class',form.assetClass],['Target Raise',form.targetRaiseUsd?`USD ${parseFloat(form.targetRaiseUsd).toLocaleString()}`:'—'],['Documents',`${Object.keys(files).length} uploaded`]].map(([l,v])=>(
              <div key={l} className="flex justify-between"><span className="text-gray-400">{l}</span><span className="font-medium">{v||'—'}</span></div>
            ))}
          </div>
          <div className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-4">
            <input type="checkbox" id="terms" checked={form.termsAccepted} onChange={e=>set('termsAccepted',e.target.checked)} className="mt-1"/>
            <label htmlFor="terms" className="text-sm text-gray-300">I confirm that all information provided is accurate and complete. I understand that submitting false or misleading information may result in rejection and potential regulatory referral under the Securities and Exchange Act (Chapter 24:25).</label>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setStep(4)} className="flex-1 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white">← Back</button>
            <button onClick={submit} disabled={submitting||!form.termsAccepted} className="flex-1 py-3 rounded-xl font-black text-white disabled:opacity-50" style={{background:NAVY}}>
              {submitting?'⏳ Submitting...':'🚀 Submit Tokenisation Proposal'}
            </button>
          </div>
          <p className="text-gray-600 text-xs text-center">Platform issuance fee: 0.25% of total raise value, payable on SECZ approval.</p>
        </div>
      )}
    </div>
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
              {tokens.map(t=><option key={t.id} value={t.id}>{t.symbol} — {t.name||t.company_name}</option>)}
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
  const [tab,            setTab]            = useState('overview');
  const [showIssuerMore, setShowIssuerMore] = useState(false);
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
      const [tokRes, tradeRes, divRes, propRes, appRes] = await Promise.allSettled([
        api.get('/assets'),
        api.get('/trading/recent?limit=20'),
        api.get('/dividends/rounds'),
        api.get('/governance/proposals'),
        api.get('/submissions/my'),
      ]);
      const myToks = (tokRes.status==='fulfilled' ? tokRes.value.data : []);
      setMyTokens(myToks.length ? myToks : [{id:1,symbol:'HCPR',company_name:'Harare CBD REIT',asset_class:'Real Estate',oracle_price:1.005,total_supply:5000000,market_state:'FULL_TRADING'}]);
      setSelToken(myToks[0] || {id:1,symbol:'HCPR',company_name:'Harare CBD REIT',asset_class:'Real Estate',oracle_price:1.005,total_supply:5000000,market_state:'FULL_TRADING'});
      if (tradeRes.status==='fulfilled') setTrades(tradeRes.value.data||[]);
      if (divRes.status==='fulfilled')   setDividends(divRes.value.data||[]);
      if (propRes.status==='fulfilled')  setProposals(propRes.value.data||[]);
      if (appRes.status==='fulfilled')   setMyApplications(appRes.value.data||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const t       = selToken;
  const price   = t?.oracle_price || 1.005;
  const supply  = t?.total_supply || 5000000;
  const mktCap  = price * supply;
  const amtRaised   = mktCap * 0.25;
  const raisedTarget = 5000000;
  const raisedPct   = Math.min(100, Math.round((amtRaised/raisedTarget)*100));
  const holders = 89;
  const vol24h  = 128000;
  const compliance = {spv:true,kyc:true,docs:true,auditor:false,contract:false,secz:false};
  const compDone = Object.values(compliance).filter(Boolean).length;
  const compPct  = Math.round((compDone/COMPLIANCE_STEPS.length)*100);
  const notify = (type, text) => { setActionMsg({ type, text }); setTimeout(() => setActionMsg(null), 3500); };

  if (typeof window === 'undefined') return null;
  if (!JSON.parse(localStorage.getItem('user') || '{}')?.role) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* HEADER */}
      <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/80">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:GOLD}}>
              <span className="text-sm font-bold text-gray-900">TX</span>
            </div>
            <div>
              <p className="font-bold text-sm">TokenEquityX</p>
              <p className="text-gray-500 text-xs">Issuer Portal — {t?.company_name}</p>
            </div>
            <span className="ml-2 text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">ISSUER</span>
          </div>
          <nav className="flex gap-1 flex-wrap">
            {/* Overview with dropdown */}
            <div className="relative" onMouseLeave={()=>setShowIssuerMore(false)}>
              <button
                onMouseEnter={()=>setShowIssuerMore(true)}
                onClick={()=>{setTab('overview');setShowIssuerMore(m=>!m);}}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${tab==='overview'||['investors','trading','communications'].includes(tab)?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                Overview
                <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {showIssuerMore && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button onClick={()=>{setTab('overview');setShowIssuerMore(false);}}
                    className={`w-full text-left px-4 py-2.5 text-sm capitalize transition-colors ${tab==='overview'?'bg-blue-600 text-white':'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                    Overview
                  </button>
                  <div className="border-t border-gray-800 my-1"/>
                  {['investors','trading','communications'].map(t=>(
                    <button key={t} onClick={()=>{setTab(t);setShowIssuerMore(false);}}
                      className={`w-full text-left px-4 py-2.5 text-sm capitalize transition-colors ${tab===t?'bg-blue-600 text-white':'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Primary tabs */}
            {['journey','financials','governance','dividends'].map(tab2=>(
              <button key={tab2} onClick={()=>setTab(tab2)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===tab2?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                {tab2}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.email||'User'}</span>
            <button onClick={()=>{localStorage.clear();window.location.href='/'}}
              className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">Disconnect</button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
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

            {/* ── STEP 1: Tokenisation Application ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">1</div>
                <div>
                  <h2 className="font-bold text-lg">Tokenisation Application</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Submit your asset for review, valuation and SECZ approval</p>
                </div>
              </div>
              <div className="p-6">
                <ApplicationsTab myApplications={myApplications} setTab={setTab} NAVY={NAVY} GOLD={GOLD}/>
              </div>
            </div>

            {/* ── STEP 2: Submit Financial Data ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">2</div>
                <div>
                  <h2 className="font-bold text-lg">Financial Data & Valuation</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Submit financial data for auditor review and token pricing</p>
                </div>
              </div>
              <div className="p-6">
                <TokenizeTab setPostMsg={setPostMsg} NAVY={NAVY}/>
              </div>
            </div>

            {/* ── STEP 3: Primary Offering ── */}
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

          </div>
        )}

        {/* ══ INVESTORS ══ */}
        {tab==='investors' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Investor Profile</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Investor Composition</h3>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={mockHolderBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="pct" paddingAngle={3}>
                        {mockHolderBreakdown.map((_,i)=><Cell key={i} fill={HOLDER_COLORS[i]}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {mockHolderBreakdown.map((h,i)=>(
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm" style={{background:HOLDER_COLORS[i]}}/>
                          <span className="text-sm text-gray-300">{h.type}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold">{h.pct}%</span>
                          <span className="text-gray-500 text-xs ml-1">({h.count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Top Token Holders</h3>
                <div className="space-y-3">
                  {[
                    {wallet:'0x3f7a…c4d2',type:'Institutional',pct:19.2,value:'$482,400'},
                    {wallet:'0x8b2c…a1f9',type:'Family Office',pct:15.0,value:'$376,875'},
                    {wallet:'0x1d9e…7b3c',type:'Institutional',pct:11.6,value:'$291,450'},
                    {wallet:'0x5c4f…d8e1',type:'Accredited',pct:8.8,value:'$221,100'},
                    {wallet:'0x9a1b…f2c7',type:'Accredited',pct:7.4,value:'$185,925'},
                  ].map((h,i)=>(
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-4">{i+1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm">{h.wallet}</span>
                          <span className="text-sm font-semibold">{h.value}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{h.type}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-1"><div className="h-1 rounded-full" style={{width:`${h.pct*2}%`,background:NAVY}}/></div>
                            <span className="text-xs text-gray-500">{h.pct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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

        {/* ══ FINANCIALS ══ */}
        {tab==='financials' && (
          <FinancialsTab t={t} price={price} account={account} setPostMsg={setPostMsg} NAVY={NAVY}/>
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

      </div>
    </div>
  );
}