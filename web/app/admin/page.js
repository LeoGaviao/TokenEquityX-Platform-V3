'use client';
import { useWallet } from '../../hooks/useWallet';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import Inbox from '../../components/ui/Inbox';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const NAVY='#1A3C5E', GOLD='#C8972B', GREEN='#16a34a', RED='#dc2626', TEAL='#0891b2';
const fmt  = n => { const v=parseFloat(n||0); if(v>=1e9) return `$${(v/1e9).toFixed(2)}B`; if(v>=1e6) return `$${(v/1e6).toFixed(2)}M`; if(v>=1e3) return `$${(v/1e3).toFixed(1)}K`; return `$${v.toFixed(2)}`; };
const fmtN = n => n>=1e6?`${(n/1e6).toFixed(2)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const ts   = d => new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const dt   = d => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

// ── Field helpers (mirrors issuer ApplicationsTab)
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

// ── Admin Final Approval
function AdminFinalApproval({ item, onApprove, onReject }) {
  const [listingType, setListingType] = useState(item.audit_report?.suggestedListingType || '');
  const [riskCategory, setRiskCategory] = useState('BALANCED');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const report = item.audit_report || {};
  const handleApprove = async () => {
    if (!listingType) { alert('Please select a listing type.'); return; }
    setSubmitting(true);
    await onApprove(listingType, adminNotes, riskCategory);
    setSubmitting(false);
  };
  return (
    <div className="space-y-3">
      <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4">
        <p className="text-green-300 text-xs font-bold mb-2">✓ Auditor Has Approved — Admin Final Sign-Off Required</p>
        {report.certifiedPrice && (
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <span className="text-gray-400">Certified Price: <span className="text-yellow-400 font-bold">${report.certifiedPrice?.toFixed(4)}</span></span>
            <span className="text-gray-400">Risk: <span className="font-bold text-white">{report.riskRating}</span></span>
            <span className="text-gray-400 col-span-2">Auditor Suggestion: <span className="text-blue-300 font-bold">{report.suggestedListingType?.replace('_',' ')||'Not specified'}</span></span>
          </div>
        )}
        {report.findings && <p className="text-gray-400 text-xs italic leading-relaxed">{report.findings}</p>}
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Listing Type <span className="text-red-400">*</span></label>
        <div className="space-y-2">
          {[
            { value:'BROWNFIELD_BOURSE', label:'🏛 Brownfield — Main Bourse', desc:'≥3 years audited financials + revenue ≥ USD 1.5M. Full order book.' },
            { value:'GREENFIELD_P2P',    label:'🔄 Greenfield — P2P Only',   desc:'< 3 years financials or revenue < USD 1.5M. Peer-to-peer transfers only.' },
          ].map(opt => (
            <div key={opt.value} onClick={()=>setListingType(opt.value)}
              className={`cursor-pointer rounded-xl p-3 border transition-all ${listingType===opt.value?'border-blue-500 bg-blue-900/20':'border-gray-700 bg-gray-800/30 hover:border-gray-500'}`}>
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Token Risk Category <span className="text-red-400">*</span></label>
        <select value={riskCategory} onChange={e => setRiskCategory(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600">
          <option value="CONSERVATIVE">CONSERVATIVE — Low risk, capital preservation</option>
          <option value="BALANCED">BALANCED — Moderate risk/return</option>
          <option value="GROWTH">GROWTH — Higher risk, equity-like</option>
          <option value="SPECULATIVE">SPECULATIVE — High risk, digital/early-stage</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Admin Notes (visible to issuer)</label>
        <textarea rows={2} value={adminNotes} onChange={e=>setAdminNotes(e.target.value)}
          placeholder="Any conditions or next steps for the issuer regarding token minting and listing."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600 resize-none"/>
      </div>
      <button onClick={handleApprove} disabled={submitting||!listingType}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-colors"
        style={{background:GREEN}}>
        {submitting?'⏳ Approving…':'🚀 Final Approval — Proceed to Token Minting'}
      </button>
      <button onClick={onReject}
        className="w-full py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-900/30 hover:bg-red-900/50 border border-red-800">
        ❌ Reject Application
      </button>
    </div>
  );
}

// ── Submission Detail Panel (mirrors issuer ApplicationsTab drawer)
function SubmissionDetailPanel({ item }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const res = await api.get(`/submissions/${item.id}`);
        const sub = res.data;
        let parsedData = {};
        try { parsedData = typeof sub.data_json === 'string' ? JSON.parse(sub.data_json) : (sub.data_json || {}); } catch {}
        const financialData = parsedData.financialData || parsedData;
        const hasFinancials = financialData && (
          financialData.revenueTTM || financialData.faceValue ||
          financialData.propertyValuation || financialData.totalResourceTonnes || financialData.annualRevenue
        );
        let valuation = null;
        if (hasFinancials && item.symbol) {
          try {
            const vRes = await api.post('/pipeline/preview', { tokenSymbol: item.symbol, financialData });
            valuation = vRes.data;
          } catch {}
        }
        if (!cancelled) setData({ sub, parsedData, financialData, valuation });
      } catch(e) {
        if (!cancelled) setError('Could not load submission details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [item.id]);

  if (loading) return (
    <div className="text-center py-8 text-gray-500">
      <p className="text-2xl mb-2">⏳</p>
      <p className="text-sm">Loading submission details…</p>
    </div>
  );

  if (error) return (
    <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-300 text-sm">{error}</div>
  );

  if (!data) return null;

  const { financialData, valuation, sub } = data;
  const hasFinancialFields = financialData && Object.keys(financialData)
    .filter(k => !['documents','submittedAt','type','dataHash'].includes(k) && financialData[k] !== null && financialData[k] !== undefined && financialData[k] !== '').length > 0;

  return (
    <div className="space-y-5 pt-2">

      {/* Financial data submitted */}
      {hasFinancialFields && (
        <div>
          <h4 className="font-semibold text-sm text-gray-300 mb-3">📊 Financial Data Submitted by Issuer</h4>
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(financialData)
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

      {/* Valuation engine breakdown */}
      {valuation && (
        <div>
          <h4 className="font-semibold text-sm text-gray-300 mb-3">🔢 Valuation Engine Breakdown</h4>
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Asset Type</p>
                <p className="font-bold text-yellow-400">{valuation.assetType}</p>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Blended Enterprise Value</p>
                <p className="font-bold text-green-400 text-lg">{fmt(valuation.blended)}</p>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Reference Price / Token</p>
                <p className="font-bold text-white text-lg">${parseFloat(valuation.pricePerToken||0).toFixed(4)}</p>
              </div>
            </div>
            {valuation.models && Object.entries(valuation.models)
              .filter(([,v]) => v && (v.enterpriseValue > 0 || v.price > 0 || v.nav > 0)).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Model Breakdown</p>
                <div className="space-y-2">
                  {Object.entries(valuation.models)
                    .filter(([,v]) => v && (v.enterpriseValue > 0 || v.price > 0 || v.nav > 0))
                    .map(([modelName, modelData]) => {
                      const val = modelData?.enterpriseValue || modelData?.price || modelData?.nav || 0;
                      return (
                        <div key={modelName} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{MODEL_LABELS[modelName] || modelName}</p>
                            {modelData?.multiple && <p className="text-xs text-gray-500">Multiple: {modelData.multiple}x</p>}
                            {modelData?.macaulayDuration && <p className="text-xs text-gray-500">Duration: {modelData.macaulayDuration} yrs</p>}
                          </div>
                          <p className="font-bold text-yellow-400">{fmt(val)}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-600 border-t border-gray-700/50 pt-3">
              System-generated preview. Auditor may apply adjustments before certifying the final oracle price.
            </p>
          </div>
        </div>
      )}

      {/* Auditor-facing summary */}
      <div>
        <h4 className="font-semibold text-sm text-gray-300 mb-3">🔍 Auditor-Facing Summary</h4>
        <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4 space-y-2 text-sm">
          {[
            ['Submission ID',    String(item.id)],
            ['Token Symbol',     item.symbol || '—'],
            ['Period',           item.isNewApplication ? (sub?.period || 'Tokenisation Application') : (item.name || '—')],
            ['Reference',        sub?.reference_number || item.reference || '—'],
            ['Assigned Auditor', item.assigned_auditor || sub?.assigned_auditor || 'Not yet assigned'],
            ['Current Status',   sub?.status || item.status || '—'],
            ...(valuation ? [['System Reference Price', `$${parseFloat(valuation.pricePerToken||0).toFixed(6)}`]] : []),
          ].map(([label, value])=>(
            <div key={label} className="flex justify-between">
              <span className="text-gray-400">{label}</span>
              <span className={
                label==='Assigned Auditor' && !(item.assigned_auditor||sub?.assigned_auditor) ? 'text-amber-400' :
                label==='System Reference Price' ? 'text-yellow-400 font-bold' :
                label==='Token Symbol' ? 'font-bold' : 'text-gray-200'
              }>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auditor notes */}
      {(sub?.auditor_notes || item.notes) && (
        <div>
          <h4 className="font-semibold text-sm text-gray-300 mb-2">Auditor Notes / Internal Notes</h4>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
            {sub?.auditor_notes || item.notes}
          </div>
        </div>
      )}

      {/* Documents */}
      {(() => {
        try {
          const d = typeof sub.data_json === 'string' ? JSON.parse(sub.data_json) : (sub.data_json || {});
          const rawDocs = d.documents;
          // Normalise old (array) and new (object) formats to a flat list
          let docList = [];
          if (Array.isArray(rawDocs)) {
            docList = rawDocs.map((doc, i) => ({
              key:   String(i),
              name:  doc.name || doc.originalName || `Document ${i + 1}`,
              label: doc.name || doc.originalName || `Document ${i + 1}`,
              url:   doc.url || null,
            }));
          } else if (rawDocs && typeof rawDocs === 'object') {
            docList = Object.entries(rawDocs).map(([key, doc]) => ({
              key,
              name:  doc.name || key,
              label: key.replace(/_/g, ' '),
              url:   doc.url || null,
            }));
          }
          if (docList.length === 0) return (
            <p className="text-xs text-gray-500 mt-2">No documents uploaded yet.</p>
          );
          const apiRoot = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
          return (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 font-semibold mb-2">📎 Uploaded Documents</p>
              {docList.map(({ key, name, label, url }) => {
                const href = url?.startsWith('/uploads/') ? `${apiRoot}${url}` : (url || null);
                return href ? (
                  <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 hover:bg-gray-700/50 transition-colors">
                    <span className="text-blue-400 text-xs">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{name}</p>
                      <p className="text-xs text-gray-500 capitalize">{label}</p>
                    </div>
                    <span className="text-xs text-blue-400">↗</span>
                  </a>
                ) : (
                  <div key={key} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-600 text-xs">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 truncate">{name}</p>
                      <p className="text-xs text-gray-600 capitalize">{label}</p>
                    </div>
                    <span className="text-xs text-gray-600">unavailable</span>
                  </div>
                );
              })}
            </div>
          );
        } catch { return null; }
      })()}
    </div>
  );
}

// ── Blog Management
function AdminOfferingsTab({ NAVY, GOLD, GREEN, RED, notify }) {
  const [offerings,     setOfferings]     = useState([]);
  const [tokens,        setTokens]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [view,          setView]          = useState('list'); // 'list' | 'detail'
  const [submitting,    setSubmitting]    = useState(false);
  const [closeForm,     setCloseForm]     = useState({ bank_reference:'', admin_notes:'', trading_mode:'FULL_TRADING' });
  const [previewOffering,   setPreviewOffering]   = useState(null);
  const [expandedRationale, setExpandedRationale] = useState(new Set());
  const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const hdrs = () => ({ Authorization:`Bearer ${localStorage.getItem('token')}`, 'Content-Type':'application/json' });
  const fmt  = n => { const v=parseFloat(n||0); if(v>=1e6) return `$${(v/1e6).toFixed(2)}M`; if(v>=1e3) return `$${(v/1e3).toFixed(1)}K`; return `$${v.toFixed(2)}`; };
  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600";
  const STATUS_COLORS = {
    PENDING_APPROVAL: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
    AUDITOR_REVIEWED: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
    OPEN:             'bg-green-900/50 text-green-300 border border-green-700/50',
    DISBURSED:        'bg-purple-900/50 text-purple-300 border border-purple-700/50',
    CANCELLED:        'bg-red-900/50 text-red-300 border border-red-700/50',
  };
  const RECOMMENDATION_COLORS = {
    APPROVE:          'text-green-400',
    REJECT:           'text-red-400',
    REQUEST_CHANGES:  'text-amber-400',
  };

  const loadOfferings = () => {
    setLoading(true);
    fetch(`${API}/offerings`, { headers: hdrs() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setOfferings(d); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  const loadSubscriptions = (id) => {
    fetch(`${API}/offerings/${id}/subscriptions`, { headers: hdrs() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setSubscriptions(d); })
      .catch(() => {});
  };

  useEffect(() => { loadOfferings(); }, []);

  const approveOffering = async (id) => {
    if (!window.confirm('Approve this offering and open it for investor subscriptions?')) return;
    setSubmitting(true);
    try {
      const res  = await fetch(`${API}/offerings/${id}/approve`, { method:'PUT', headers: hdrs(), body: JSON.stringify({ admin_notes: 'Approved by admin' }) });
      const data = await res.json();
      notify(res.ok ? 'success' : 'error', data.message || data.error);
      loadOfferings();
      if (selected?.id === id) setSelected(prev => ({ ...prev, status: 'OPEN' }));
    } catch { notify('error', 'Could not approve offering'); }
    setSubmitting(false);
  };

  const rejectOffering = async (id) => {
    const reason = window.prompt('Reason for rejection (required):');
    if (!reason) return;
    try {
      const res  = await fetch(`${API}/offerings/${id}/reject`, { method:'PUT', headers: hdrs(), body: JSON.stringify({ reason }) });
      const data = await res.json();
      notify(res.ok ? 'success' : 'error', data.message || data.error);
      loadOfferings(); setView('list'); setSelected(null);
    } catch { notify('error', 'Could not reject offering'); }
  };

  const closeOffering = async () => {
    if (!selected) return;
    if (!window.confirm(`Close offering and disburse proceeds to issuer?`)) return;
    setSubmitting(true);
    try {
      const res  = await fetch(`${API}/offerings/${selected.id}/close`, { method:'POST', headers: hdrs(), body: JSON.stringify(closeForm) });
      const data = await res.json();
      if (!res.ok) { notify('error', data.error || 'Failed'); setSubmitting(false); return; }
      notify('success', data.message);
      setView('list'); setSelected(null); loadOfferings();
    } catch { notify('error', 'Could not close offering'); }
    setSubmitting(false);
  };

  const cancelOffering = async (id) => {
    if (!window.confirm('Cancel this offering and refund all subscribers?')) return;
    try {
      const res  = await fetch(`${API}/offerings/${id}/cancel`, { method:'POST', headers: hdrs(), body: JSON.stringify({ reason: 'Cancelled by admin' }) });
      const data = await res.json();
      notify(res.ok ? 'success' : 'error', data.message || data.error);
      loadOfferings(); setView('list'); setSelected(null);
    } catch { notify('error', 'Could not cancel offering'); }
  };

  const pendingQueue   = offerings.filter(o => o.status === 'PENDING_APPROVAL' || o.status === 'AUDITOR_REVIEWED');
  const activeOfferings = offerings.filter(o => o.status === 'OPEN');
  const pastOfferings   = offerings.filter(o => o.status === 'DISBURSED' || o.status === 'CANCELLED');

  if (view === 'detail' && selected) return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={()=>{ setView('list'); setSelected(null); setSubscriptions([]); }} className="text-gray-400 hover:text-white text-sm">← Back</button>
        <h2 className="text-xl font-bold">{selected.symbol} — Primary Offering</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status]||''}`}>{selected.status?.replace('_',' ')}</span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Target Raise',       fmt(selected.target_raise_usd),         'text-white'],
          ['Total Raised',       fmt(selected.total_raised_usd),         'text-green-400'],
          ['Subscribers',        selected.subscriber_count || 0,         'text-white'],
          ['Tokens Subscribed',  parseInt(selected.tokens_subscribed||0).toLocaleString(), 'text-yellow-400'],
        ].map(([l,v,c])=>(
          <div key={l} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{l}</p>
            <p className={`text-lg font-bold ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Offering terms */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3 text-gray-300">📋 Offering Terms (Proposed by Issuer)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ['Offering Price',     `$${parseFloat(selected.offering_price_usd||0).toFixed(4)}`],
            ['Min Subscription',   fmt(selected.min_subscription_usd)],
            ['Max Subscription',   selected.max_subscription_usd ? fmt(selected.max_subscription_usd) : 'No limit'],
            ['Total Tokens',       parseInt(selected.total_tokens_offered||0).toLocaleString()],
            ['Deadline',           new Date(selected.subscription_deadline).toLocaleDateString('en-GB')],
            ['Issuance Fee',       `${(parseFloat(selected.issuance_fee_rate||0)*100).toFixed(1)}%`],
          ].map(([l,v])=>(
            <div key={l} className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">{l}</p>
              <p className="font-semibold text-white">{v}</p>
            </div>
          ))}
        </div>
        {selected.offering_rationale && (
          <div className="mt-3 bg-gray-800/30 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Issuer Rationale</p>
            <p className="text-sm text-gray-300 leading-relaxed">{selected.offering_rationale}</p>
          </div>
        )}
      </div>

      {/* Auditor review panel */}
      {selected.status === 'AUDITOR_REVIEWED' && selected.auditor_recommendation && (
        <div className={`rounded-xl p-4 border ${selected.auditor_recommendation==='APPROVE'?'bg-green-900/20 border-green-800/50':selected.auditor_recommendation==='REJECT'?'bg-red-900/20 border-red-800/50':'bg-amber-900/20 border-amber-800/50'}`}>
          <p className="font-semibold text-sm mb-2">🔍 Auditor Review Submitted</p>
          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <span className="text-gray-400">Recommendation: <span className={`font-bold ${RECOMMENDATION_COLORS[selected.auditor_recommendation]||'text-white'}`}>{selected.auditor_recommendation?.replace('_',' ')}</span></span>
            <span className="text-gray-400">Reviewed: <span className="text-white">{selected.auditor_reviewed_at ? new Date(selected.auditor_reviewed_at).toLocaleDateString('en-GB') : '—'}</span></span>
          </div>
          {selected.price_assessment && <p className="text-xs text-gray-400 mb-1">Price Assessment: <span className="text-gray-200">{selected.price_assessment}</span></p>}
          {selected.auditor_notes    && <p className="text-xs text-gray-400">Notes: <span className="text-gray-200">{selected.auditor_notes}</span></p>}
        </div>
      )}

      {/* Pending approval queue — admin approve / reject */}
      {(selected.status === 'PENDING_APPROVAL' || selected.status === 'AUDITOR_REVIEWED') && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-gray-300">⚙️ Admin Decision</h3>
          {selected.status === 'PENDING_APPROVAL' && (
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 text-xs text-amber-300">
              ⚠️ This offering has not yet been reviewed by an auditor. You may still approve it, but auditor review is recommended.
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={()=>approveOffering(selected.id)} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{background:GREEN}}>
              ✅ Approve & Open Offering
            </button>
            <button onClick={()=>rejectOffering(selected.id)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/60">
              ❌ Reject
            </button>
          </div>
          <p className="text-xs text-gray-500">Approving will move the token to PRIMARY_ONLY market state and open subscriptions to investors.</p>
        </div>
      )}

      {/* Close / disburse panel for open offerings */}
      {selected.status === 'OPEN' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-gray-300">💰 Close Offering & Disburse Proceeds</h3>
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 text-sm space-y-1">
            <p className="text-blue-300 font-semibold text-xs mb-2">Settlement Preview</p>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-xs text-gray-500">Gross Raised</p><p className="font-bold text-white">{fmt(selected.total_raised_usd)}</p></div>
              <div><p className="text-xs text-gray-500">Issuance Fee (2%)</p><p className="font-bold text-red-300">-{fmt(parseFloat(selected.total_raised_usd)*0.02)}</p></div>
              <div><p className="text-xs text-gray-500">Net to Issuer</p><p className="font-bold text-green-400">{fmt(parseFloat(selected.total_raised_usd)*0.98)}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Bank Transfer Reference</label>
              <input value={closeForm.bank_reference} onChange={e=>setCloseForm(f=>({...f,bank_reference:e.target.value}))}
                className={inputCls} placeholder="e.g. TXN-2026-001"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Post-Offering Trading Mode</label>
              <select value={closeForm.trading_mode} onChange={e=>setCloseForm(f=>({...f,trading_mode:e.target.value}))} className={inputCls}>
                <option value="FULL_TRADING">Full Trading (Main Bourse)</option>
                <option value="P2P_ONLY">P2P Only (Greenfield)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Admin Notes (audit trail)</label>
            <textarea rows={2} value={closeForm.admin_notes} onChange={e=>setCloseForm(f=>({...f,admin_notes:e.target.value}))}
              className={inputCls+' resize-none'} placeholder="Any notes for the record"/>
          </div>
          <div className="flex gap-3">
            <button onClick={closeOffering} disabled={submitting}
              className="flex-1 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
              style={{background:GREEN}}>
              {submitting ? '⏳ Processing…' : '✅ Close & Disburse to Issuer'}
            </button>
            <button onClick={()=>cancelOffering(selected.id)}
              className="px-5 py-3 rounded-xl text-sm font-semibold bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/60">
              Cancel Offering
            </button>
          </div>
        </div>
      )}

      {/* Disbursed summary */}
      {selected.status === 'DISBURSED' && (
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
          <p className="text-green-300 font-bold mb-3">✅ Offering Closed & Disbursed</p>
          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
            <div><p className="text-xs text-gray-500">Gross Raised</p><p className="font-bold text-white">{fmt(selected.total_raised_usd)}</p></div>
            <div><p className="text-xs text-gray-500">Issuance Fee</p><p className="font-bold text-red-300">-{fmt(selected.issuance_fee_usd)}</p></div>
            <div><p className="text-xs text-gray-500">Net to Issuer</p><p className="font-bold text-green-400">{fmt(selected.net_proceeds_usd)}</p></div>
          </div>
          {selected.bank_reference && <p className="text-xs text-gray-500">Bank ref: <span className="font-mono text-white">{selected.bank_reference}</span></p>}
          {selected.disbursed_at   && <p className="text-xs text-gray-500 mt-1">Disbursed: {new Date(selected.disbursed_at).toLocaleDateString('en-GB')}</p>}
        </div>
      )}

      {/* Subscriber list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-3">👥 Subscriber List</h3>
        {subscriptions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No subscriptions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
              {['Investor','Amount','Tokens','Rail','Status','Date'].map(h=><th key={h} className="text-left pb-2 pr-3">{h}</th>)}
            </tr></thead>
            <tbody>
              {subscriptions.map((s,i)=>(
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-2 pr-3"><p className="font-medium text-sm">{s.full_name}</p><p className="text-xs text-gray-500">{s.email}</p></td>
                  <td className="py-2 pr-3 text-green-400 font-semibold">{fmt(s.amount_usd)}</td>
                  <td className="py-2 pr-3">{parseInt(s.tokens_allocated).toLocaleString()}</td>
                  <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.settlement_rail==='USDC'?'bg-purple-900/50 text-purple-300':'bg-blue-900/50 text-blue-300'}`}>{s.settlement_rail}</span></td>
                  <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.status==='CONFIRMED'?'bg-green-900/50 text-green-300':s.status==='REFUNDED'?'bg-red-900/50 text-red-300':'bg-gray-700 text-gray-400'}`}>{s.status}</span></td>
                  <td className="py-2 text-xs text-gray-400">{new Date(s.subscribed_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── LIST VIEW
  return (
    <div className="space-y-6 max-w-4xl">
      <div><h2 className="text-xl font-bold">Primary Offerings</h2><p className="text-gray-500 text-sm mt-0.5">Review issuer proposals, approve offerings and manage disbursements.</p></div>

      {loading && <p className="text-gray-500 text-sm py-4">Loading…</p>}

      {/* Pending approval queue */}
      {!loading && pendingQueue.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block"/>
            Awaiting Review / Approval ({pendingQueue.length})
          </h3>
          <div className="space-y-4">
            {pendingQueue.map(o => {
              const isExpanded = expandedRationale.has(o.id);
              const rationale  = o.offering_rationale || '';
              const truncated  = rationale.length > 150 ? rationale.slice(0, 150) : rationale;
              const REC_STYLE  = {
                APPROVE:         'text-green-400 bg-green-900/30 border-green-700/50',
                REJECT:          'text-red-400 bg-red-900/30 border-red-700/50',
                REQUEST_CHANGES: 'text-amber-400 bg-amber-900/30 border-amber-700/50',
              };
              const openDetail = () => { setSelected(o); setView('detail'); loadSubscriptions(o.id); };
              return (
                <div key={o.id} onClick={openDetail}
                  className="bg-gray-900 border border-amber-800/30 rounded-xl p-4 space-y-3 cursor-pointer hover:border-amber-600/50 transition-colors">

                  {/* Header: reference, symbol, asset type, status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded">#{o.id}</span>
                      <span className="font-bold text-blue-300 text-base">{o.token_symbol || o.symbol}</span>
                      {o.token_name && <span className="text-xs text-gray-400">{o.token_name}</span>}
                      {o.asset_type && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded uppercase">{o.asset_type}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || ''}`}>{o.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setPreviewOffering(o)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600">👁️ Preview</button>
                      <button onClick={openDetail}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60">Review</button>
                      <button onClick={() => approveOffering(o.id)} disabled={submitting}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-900/40 text-green-300 hover:bg-green-900/60 disabled:opacity-40">✅ Approve</button>
                      <button onClick={() => rejectOffering(o.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60">❌ Reject</button>
                    </div>
                  </div>

                  {/* Issuer info */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">👤</span>
                    <span className="text-white font-medium">{o.issuer_name || '—'}</span>
                    {o.issuer_email && <><span className="text-gray-600">·</span><span className="text-gray-400">{o.issuer_email}</span></>}
                  </div>

                  {/* Key metrics grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                    {[
                      ['Price/Token',    `$${parseFloat(o.offering_price_usd || 0).toFixed(4)}`],
                      ['Target Raise',   fmt(o.target_raise_usd)],
                      ['Tokens Offered', parseInt(o.total_tokens_offered || 0).toLocaleString()],
                      ['Min Sub.',       fmt(o.min_subscription_usd)],
                      ['Max Sub.',       o.max_subscription_usd ? fmt(o.max_subscription_usd) : 'No limit'],
                      ['Deadline',       new Date(o.subscription_deadline).toLocaleDateString('en-GB')],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-gray-800/50 rounded-lg px-2 py-1.5">
                        <p className="text-gray-500 mb-0.5">{l}</p>
                        <p className="text-white font-semibold truncate">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Auditor recommendation */}
                  {o.auditor_recommendation && (
                    <div className={`text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-2 ${REC_STYLE[o.auditor_recommendation] || 'text-gray-300 bg-gray-800 border-gray-700'}`}>
                      <span className="font-semibold">🔍 Auditor: {o.auditor_recommendation.replace(/_/g, ' ')}</span>
                      {o.auditor_notes && <><span className="opacity-40">·</span><span className="opacity-75">{o.auditor_notes.slice(0, 80)}{o.auditor_notes.length > 80 ? '…' : ''}</span></>}
                    </div>
                  )}

                  {/* Offering rationale */}
                  {rationale && (
                    <div className="text-xs text-gray-400 leading-relaxed" onClick={e => e.stopPropagation()}>
                      <span className="text-gray-500 font-medium">Rationale: </span>
                      {isExpanded ? rationale : truncated}
                      {rationale.length > 150 && (
                        <>
                          {!isExpanded && '…'}
                          <button
                            onClick={() => setExpandedRationale(prev => {
                              const next = new Set(prev);
                              isExpanded ? next.delete(o.id) : next.add(o.id);
                              return next;
                            })}
                            className="ml-1 text-blue-400 hover:text-blue-300 underline">
                            {isExpanded ? 'show less' : 'read more'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open offerings */}
      {!loading && activeOfferings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-300 mb-3">🟢 Open Offerings ({activeOfferings.length})</h3>
          <div className="space-y-3">
            {activeOfferings.map(o=>(
              <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-blue-300">{o.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status]||''}`}>OPEN</span>
                    <span className="text-xs text-gray-500">{o.subscriber_count || 0} subscribers</span>
                  </div>
                  <div className="flex gap-5 text-xs text-gray-400 flex-wrap">
                    <span>Raised: <span className="text-green-400 font-semibold">{fmt(o.total_raised_usd)}</span> of <span className="text-white">{fmt(o.target_raise_usd)}</span></span>
                    <span>Deadline: <span className="text-white">{new Date(o.subscription_deadline).toLocaleDateString('en-GB')}</span></span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-green-500" style={{width:`${Math.min(100,(parseFloat(o.total_raised_usd)/parseFloat(o.target_raise_usd))*100).toFixed(0)}%`}}/>
                  </div>
                </div>
                <button onClick={()=>{ setSelected(o); setView('detail'); loadSubscriptions(o.id); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60 flex-shrink-0">Manage</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past offerings */}
      {!loading && pastOfferings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">📁 Past Offerings</h3>
          <div className="space-y-2">
            {pastOfferings.map(o=>(
              <div key={o.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 flex items-center justify-between gap-4 opacity-75">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">{o.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status]||''}`}>{o.status}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {o.status==='DISBURSED'
                      ? `Raised: ${fmt(o.total_raised_usd)} · Net to issuer: ${fmt(o.net_proceeds_usd)}`
                      : `Cancelled`}
                  </p>
                </div>
                <button onClick={()=>{ setSelected(o); setView('detail'); loadSubscriptions(o.id); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex-shrink-0">View</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && offerings.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">🏦</p>
          <p className="font-semibold mb-1">No offering proposals yet</p>
          <p className="text-gray-500 text-sm">Issuers will submit offering proposals from their dashboard once their token is approved through the pipeline.</p>
        </div>
      )}

      {/* ── INVESTOR PREVIEW MODAL */}
      {previewOffering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewOffering(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full">Preview Only — Not Live</span>
                <h3 className="text-lg font-bold mt-2">
                  {previewOffering.token_name || previewOffering.symbol}
                  <span className="text-gray-400 font-normal text-sm ml-2">({previewOffering.token_symbol || previewOffering.symbol})</span>
                </h3>
                {previewOffering.asset_type && (
                  <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded mt-1 inline-block uppercase">{previewOffering.asset_type}</span>
                )}
              </div>
              <button onClick={() => setPreviewOffering(null)} className="text-gray-500 hover:text-white text-2xl leading-none flex-shrink-0">×</button>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Offering Price</p>
              <p className="text-2xl font-black text-yellow-400">
                ${parseFloat(previewOffering.offering_price_usd || 0).toFixed(4)}
                <span className="text-sm font-normal text-gray-400 ml-2">per token</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Target Raise',        fmt(previewOffering.target_raise_usd)],
                ['Fundraising Progress','0% — not yet open'],
                ['Min Subscription',    fmt(previewOffering.min_subscription_usd)],
                ['Max Subscription',    previewOffering.max_subscription_usd ? fmt(previewOffering.max_subscription_usd) : 'No limit'],
                ['Subscription Deadline', new Date(previewOffering.subscription_deadline).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })],
                ['Total Tokens Offered', parseInt(previewOffering.total_tokens_offered || 0).toLocaleString()],
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{l}</p>
                  <p className="font-semibold text-white">{v}</p>
                </div>
              ))}
            </div>

            {previewOffering.offering_rationale && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Offering Rationale</p>
                <p className="text-sm text-gray-300 leading-relaxed">{previewOffering.offering_rationale}</p>
              </div>
            )}

            <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3">
              <p className="text-xs text-amber-300">⚠️ Preview only — this offering is not yet open to investors</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminBlogTab() {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState(null);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({
    title:'', category:'General', summary:'', body:'',
    author:'', author_role:'', read_time:'5 min', featured:false, published:false,
  });

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const hdrs = () => ({ Authorization:`Bearer ${localStorage.getItem('token')}`, 'Content-Type':'application/json' });
  const CATS = ['General','Market Intelligence','Education','Research','Case Study','Announcement'];

  const loadPosts = () => {
    setLoading(true);
    fetch(`${API}/blog/all`, { headers: hdrs() })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPosts(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPosts(); }, []);

  const openNew = () => {
    setForm({ title:'', category:'General', summary:'', body:'', author:'', author_role:'', read_time:'5 min', featured:false, published:false });
    setEditing('new');
  };

  const openEdit = (p) => {
    setForm({ title:p.title||'', category:p.category||'General', summary:p.summary||'', body:p.body||'', author:p.author||'', author_role:p.author_role||'', read_time:p.read_time||'5 min', featured:!!p.featured, published:!!p.published });
    setEditing(p);
  };

  const save = async () => {
    if (!form.title || !form.summary || !form.body || !form.author) {
      setMsg({ type:'error', text:'Title, summary, body and author are required.' }); return;
    }
    try {
      const url    = editing === 'new' ? `${API}/blog` : `${API}/blog/${editing.id}`;
      const method = editing === 'new' ? 'POST' : 'PUT';
      const res    = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type:'success', text: editing === 'new' ? 'Article created.' : 'Article updated.' });
      setEditing(null); loadPosts();
    } catch (err) { setMsg({ type:'error', text: err.message || 'Save failed.' }); }
    setTimeout(() => setMsg(null), 4000);
  };

  const del = async (id) => {
    if (!confirm('Delete this article?')) return;
    try { await fetch(`${API}/blog/${id}`, { method:'DELETE', headers: hdrs() }); loadPosts(); setMsg({ type:'success', text:'Deleted.' }); }
    catch { setMsg({ type:'error', text:'Delete failed.' }); }
    setTimeout(() => setMsg(null), 4000);
  };

  const togglePublish = async (p) => {
    try { await fetch(`${API}/blog/${p.id}`, { method:'PUT', headers: hdrs(), body: JSON.stringify({ published: !p.published }) }); loadPosts(); } catch {}
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600";

  if (editing) return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={()=>setEditing(null)} className="text-gray-400 hover:text-white text-sm">← Back</button>
        <h2 className="text-xl font-bold">{editing === 'new' ? 'New Article' : 'Edit Article'}</h2>
      </div>
      {msg && <div className={`p-3 rounded-xl text-sm border ${msg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>{msg.text}</div>}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div><label className="text-xs text-gray-400 block mb-1">Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className={inputCls} placeholder="Article title"/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-400 block mb-1">Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={inputCls}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-400 block mb-1">Read Time</label><input value={form.read_time} onChange={e=>setForm(f=>({...f,read_time:e.target.value}))} className={inputCls} placeholder="5 min"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-400 block mb-1">Author *</label><input value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} className={inputCls} placeholder="e.g. Richard Chimuka"/></div>
          <div><label className="text-xs text-gray-400 block mb-1">Author Role</label><input value={form.author_role} onChange={e=>setForm(f=>({...f,author_role:e.target.value}))} className={inputCls} placeholder="e.g. CEO"/></div>
        </div>
        <div><label className="text-xs text-gray-400 block mb-1">Summary *</label><textarea rows={3} value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))} className={inputCls+' resize-none'} placeholder="One-paragraph summary"/></div>
        <div><label className="text-xs text-gray-400 block mb-1">Article Body *</label><textarea rows={14} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} className={inputCls+' resize-y font-mono text-xs'} placeholder="Full article text."/></div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.featured} onChange={e=>setForm(f=>({...f,featured:e.target.checked}))}/><span className="text-sm text-gray-300">Featured</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.published} onChange={e=>setForm(f=>({...f,published:e.target.checked}))}/><span className="text-sm text-gray-300">Publish immediately</span></label>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={save} className="flex-1 py-3 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>{form.published?'🌐 Save & Publish':'💾 Save as Draft'}</button>
        <button onClick={()=>setEditing(null)} className="px-6 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 text-white text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Blog Management</h2><p className="text-gray-500 text-sm mt-0.5">Create, edit and publish articles to the public blog.</p></div>
        <button onClick={openNew} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>+ New Article</button>
      </div>
      {msg && <div className={`p-3 rounded-xl text-sm border ${msg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>{msg.text}</div>}
      {loading && <p className="text-gray-500 text-sm py-4">Loading…</p>}
      {!loading && posts.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">📝</p><p className="font-semibold mb-1">No articles yet</p>
          <p className="text-gray-500 text-sm mb-4">Create your first article to populate the public blog.</p>
          <button onClick={openNew} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:NAVY}}>+ New Article</button>
        </div>
      )}
      {!loading && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.published?'bg-green-900/50 text-green-300':'bg-gray-700 text-gray-400'}`}>{p.published?'🌐 Published':'📋 Draft'}</span>
                  {p.featured?<span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded-full">★ Featured</span>:null}
                  <span className="text-xs text-gray-500">{p.category}</span>
                </div>
                <p className="font-semibold text-sm truncate">{p.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">By {p.author} · {p.read_time}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={()=>togglePublish(p)} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${p.published?'bg-amber-900/40 text-amber-300 hover:bg-amber-900/60':'bg-green-900/40 text-green-300 hover:bg-green-900/60'}`}>{p.published?'Unpublish':'Publish'}</button>
                <button onClick={()=>openEdit(p)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60">Edit</button>
                <button onClick={()=>del(p.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PIPELINE_STAGES=[
  {key:'spv',      label:'SPV Registered',     icon:'🏢'},
  {key:'kyc',      label:'KYC Verified',        icon:'✅'},
  {key:'docs',     label:'Documents Uploaded',  icon:'📄'},
  {key:'auditor',  label:'Auditor Review',      icon:'🔍'},
  {key:'contract', label:'Smart Contract',      icon:'⛓️'},
  {key:'secz',     label:'SECZ Approved',       icon:'🏛️'},
  {key:'offering', label:'Primary Offering',    icon:'🪙'},
  {key:'live',     label:'Full Trading',        icon:'🟢'},
];
const REVENUE_COLORS=[NAVY,GOLD,GREEN,TEAL,'#7c3aed','#db2777','#ea580c'];

const mockPipeline = [];

const mockVolChart = [];
const mockRevBreakdown = [];
const mockAlerts = [];
const ALERT_STYLES={warning:'bg-amber-900/40 border-amber-700 text-amber-300',error:'bg-red-900/40 border-red-700 text-red-300',success:'bg-green-900/40 border-green-700 text-green-300',info:'bg-blue-900/40 border-blue-700 text-blue-300'};
const ALERT_ICONS={warning:'⚠️',error:'🚨',success:'✅',info:'ℹ️'};

// ═══════════════════════════════════════════════════════════
// DIAGNOSTIC & SECURITY GUARD TOOL
// ═══════════════════════════════════════════════════════════
function DiagnosticPanel({ token, API }) {
  const [loading,    setLoading]    = useState(false);
  const [lastRun,    setLastRun]    = useState(null);
  const [health,     setHealth]     = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [security,   setSecurity]   = useState([]);
  const [auditLog,   setAuditLog]   = useState([]);
  const [activeTab,  setActiveTab]  = useState('health');
  const [autoRefresh,setAutoRefresh]= useState(false);
  const intervalRef = useRef(null);

  const hdrs = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  const runDiagnostic = async () => {
    setLoading(true);
    const results = { health: [], alerts: [], security: [], audit: [] };
    const t0 = Date.now();

    // ── SYSTEM HEALTH CHECKS ──
    const healthChecks = [
      { name: 'API Server', url: `${API}/ticker`, critical: true },
      { name: 'Database', url: `${API}/settings`, critical: true },
      { name: 'Auth Service', url: `${API}/auth/me`, critical: true },
      { name: 'Pipeline Service', url: `${API}/submissions/pending`, critical: false },
      { name: 'Wallet Service', url: `${API}/wallet/balance`, critical: false },
      { name: 'Offerings Service', url: `${API}/offerings`, critical: false },
    ];

    for (const check of healthChecks) {
      const start = Date.now();
      try {
        const res = await fetch(check.url, { headers: hdrs() });
        const ms = Date.now() - start;
        results.health.push({
          name: check.name,
          status: res.ok ? 'OK' : 'DEGRADED',
          ms,
          critical: check.critical,
          detail: res.ok ? `${ms}ms` : `HTTP ${res.status}`,
        });
      } catch {
        results.health.push({
          name: check.name,
          status: 'DOWN',
          ms: Date.now() - start,
          critical: check.critical,
          detail: 'Connection failed',
        });
      }
    }

    // ── PLATFORM ALERTS ──
    try {
      // Check stuck submissions
      const subsRes = await fetch(`${API}/submissions/pending`, { headers: hdrs() });
      if (subsRes.ok) {
        const subs = await subsRes.json();
        const stuck = subs.filter(s => {
          const days = (Date.now() - new Date(s.created_at)) / 86400000;
          return days > 7;
        });
        if (stuck.length > 0) {
          results.alerts.push({
            level: 'WARNING',
            title: `${stuck.length} submission(s) stuck in queue`,
            detail: `${stuck.map(s => s.token_symbol).join(', ')} have been pending for over 7 days.`,
            action: 'Review Pipeline tab and advance or reject stalled submissions.',
            icon: '⏳',
          });
        }
      }
    } catch {}

    try {
      // Check unconfirmed deposits
      const depRes = await fetch(`${API}/wallet/admin/deposits`, { headers: hdrs() });
      if (depRes.ok) {
        const deps = await depRes.json();
        const pending = deps.filter(d => d.status === 'PENDING');
        const old = pending.filter(d => (Date.now() - new Date(d.created_at)) / 86400000 > 2);
        if (old.length > 0) {
          results.alerts.push({
            level: 'WARNING',
            title: `${old.length} deposit(s) unconfirmed for 48+ hours`,
            detail: `Total: $${old.reduce((a,d) => a + parseFloat(d.amount_usd||0), 0).toFixed(2)} USD pending confirmation.`,
            action: 'Go to Wallet tab → Deposits and confirm or reject each pending deposit.',
            icon: '💵',
          });
        }
        if (pending.length > 0 && old.length === 0) {
          results.alerts.push({
            level: 'INFO',
            title: `${pending.length} deposit(s) awaiting confirmation`,
            detail: `$${pending.reduce((a,d) => a + parseFloat(d.amount_usd||0), 0).toFixed(2)} USD total pending.`,
            action: 'Go to Wallet tab → Deposits to review.',
            icon: '💵',
          });
        }
      }
    } catch {}

    try {
      // Check pending withdrawals
      const wdRes = await fetch(`${API}/wallet/admin/withdrawals`, { headers: hdrs() });
      if (wdRes.ok) {
        const wds = await wdRes.json();
        const pending = wds.filter(w => w.status === 'PENDING');
        const old = pending.filter(w => (Date.now() - new Date(w.created_at)) / 86400000 > 3);
        if (old.length > 0) {
          results.alerts.push({
            level: 'CRITICAL',
            title: `${old.length} withdrawal(s) pending for 3+ days`,
            detail: `$${old.reduce((a,w) => a + parseFloat(w.amount_usd||0), 0).toFixed(2)} USD overdue for processing.`,
            action: 'Go to Wallet tab → Withdrawals. Process EFT/RTGS payments immediately.',
            icon: '🏦',
          });
        }
      }
    } catch {}

    try {
      // Check open offerings past deadline
      const offRes = await fetch(`${API}/offerings`, { headers: hdrs() });
      if (offRes.ok) {
        const offs = await offRes.json();
        const overdue = offs.filter(o => o.status === 'OPEN' && new Date(o.subscription_deadline) < new Date());
        if (overdue.length > 0) {
          results.alerts.push({
            level: 'WARNING',
            title: `${overdue.length} offering(s) past subscription deadline`,
            detail: `${overdue.map(o => o.token_symbol).join(', ')} deadline has passed but offering is still OPEN.`,
            action: 'Go to Offerings tab and close each overdue offering to disburse proceeds.',
            icon: '📅',
          });
        }
      }
    } catch {}

    try {
      // Check KYC pending queue
      const kycRes = await fetch(`${API}/admin/users`, { headers: hdrs() });
      if (kycRes.ok) {
        const users = await kycRes.json();
        const pendingKyc = users.filter(u => u.kyc_status === 'PENDING');
        if (pendingKyc.length > 0) {
          results.alerts.push({
            level: 'INFO',
            title: `${pendingKyc.length} KYC application(s) pending review`,
            detail: `${pendingKyc.map(u => u.email).join(', ')}`,
            action: 'Go to KYC tab to review and approve or reject pending applications.',
            icon: '🪪',
          });
        }
      }
    } catch {}

    if (results.alerts.length === 0) {
      results.alerts.push({
        level: 'OK',
        title: 'All systems normal',
        detail: 'No pending alerts at this time.',
        action: null,
        icon: '✅',
      });
    }

    // ── SECURITY CHECKS ──
    try {
      const txRes = await fetch(`${API}/wallet/admin/transactions?limit=100`, { headers: hdrs() });
      if (txRes.ok) {
        const txns = await txRes.json();
        // Look for large transactions
        const large = txns.filter(t => Math.abs(parseFloat(t.amount_usd||0)) > 10000);
        if (large.length > 0) {
          results.security.push({
            level: 'INFO',
            title: `${large.length} large transaction(s) detected`,
            detail: `Transactions over $10,000 USD: ${large.map(t => `$${parseFloat(t.amount_usd).toFixed(2)} (${t.type})`).join(', ')}`,
            action: 'Review in Ledger tab. Verify these are legitimate deposits or withdrawals.',
            icon: '💰',
          });
        }

        // Look for multiple rapid transactions from same user
        const userTxCount = {};
        txns.forEach(t => {
          if (t.user_id) userTxCount[t.user_id] = (userTxCount[t.user_id] || 0) + 1;
        });
        const rapid = Object.entries(userTxCount).filter(([,count]) => count > 10);
        if (rapid.length > 0) {
          results.security.push({
            level: 'WARNING',
            title: 'High transaction frequency detected',
            detail: `${rapid.length} user(s) have 10+ transactions in recent history. Possible wash trading or bot activity.`,
            action: 'Go to Users tab → review flagged accounts. Consider suspending if activity is suspicious.',
            icon: '🤖',
          });
        }
      }
    } catch {}

    try {
      const usersRes = await fetch(`${API}/admin/users`, { headers: hdrs() });
      if (usersRes.ok) {
        const users = await usersRes.json();
        // Multiple admin accounts
        const admins = users.filter(u => u.role === 'ADMIN');
        if (admins.length > 3) {
          results.security.push({
            level: 'WARNING',
            title: `${admins.length} admin accounts active`,
            detail: `Admin accounts: ${admins.map(u => u.email).join(', ')}`,
            action: 'Review admin accounts. Remove any that are no longer needed.',
            icon: '👤',
          });
        }
        // Suspended accounts
        const suspended = users.filter(u => u.account_status === 'SUSPENDED');
        if (suspended.length > 0) {
          results.security.push({
            level: 'INFO',
            title: `${suspended.length} suspended account(s)`,
            detail: suspended.map(u => u.email).join(', '),
            action: 'Review in Users tab. Reinstate if suspension was resolved.',
            icon: '🚫',
          });
        }
      }
    } catch {}

    if (results.security.length === 0) {
      results.security.push({
        level: 'OK',
        title: 'No security threats detected',
        detail: 'Platform security checks passed.',
        action: null,
        icon: '🔒',
      });
    }

    // ── AUDIT LOG ──
    try {
      const txRes = await fetch(`${API}/wallet/admin/transactions?limit=20`, { headers: hdrs() });
      if (txRes.ok) {
        const txns = await txRes.json();
        results.audit = txns.map(t => ({
          time: t.created_at,
          type: t.type,
          detail: t.description || `${t.type} — $${parseFloat(t.amount_usd||0).toFixed(2)}`,
          user: t.email || t.user_id?.substring(0,8) || 'System',
        }));
      }
    } catch {}

    setHealth(results.health);
    setAlerts(results.alerts);
    setSecurity(results.security);
    setAuditLog(results.audit);
    setLastRun(new Date());
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(runDiagnostic, 60000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const statusColor = s => s === 'OK' ? 'text-green-400' : s === 'DEGRADED' ? 'text-yellow-400' : 'text-red-400';
  const statusBg   = s => s === 'OK' ? 'bg-green-900/20 border-green-700/40' : s === 'DEGRADED' ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-red-900/20 border-red-700/40';
  const alertColor = l => l === 'CRITICAL' ? 'text-red-400 border-red-700/50 bg-red-900/20' : l === 'WARNING' ? 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20' : l === 'OK' ? 'text-green-400 border-green-700/50 bg-green-900/20' : 'text-blue-400 border-blue-700/50 bg-blue-900/20';

  const overallHealth = health.length === 0 ? 'CHECKING' :
    health.some(h => h.status === 'DOWN' && h.critical) ? 'CRITICAL' :
    health.some(h => h.status !== 'OK') ? 'DEGRADED' : 'HEALTHY';

  const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL').length;
  const warningAlerts  = alerts.filter(a => a.level === 'WARNING').length;

  const DIAG_TABS = [
    { key: 'health',   label: '🟢 System Health' },
    { key: 'alerts',   label: `⚠️ Alerts ${criticalAlerts > 0 ? `(${criticalAlerts} critical)` : warningAlerts > 0 ? `(${warningAlerts})` : ''}` },
    { key: 'security', label: '🔒 Security Watch' },
    { key: 'audit',    label: '📋 Audit Trail' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Diagnostic & Security Guard</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {lastRun ? `Last checked: ${lastRun.toLocaleTimeString('en-GB')}` : 'Running initial check...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"/>
            Auto-refresh (60s)
          </label>
          <button onClick={runDiagnostic} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 bg-blue-700 hover:bg-blue-600">
            {loading ? '⏳ Scanning...' : '🔄 Run Scan'}
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      <div className={`rounded-2xl p-5 border flex items-center justify-between ${
        overallHealth === 'HEALTHY' ? 'bg-green-900/20 border-green-700/40' :
        overallHealth === 'DEGRADED' ? 'bg-yellow-900/20 border-yellow-700/40' :
        overallHealth === 'CRITICAL' ? 'bg-red-900/20 border-red-700/40' :
        'bg-gray-900 border-gray-700'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
            overallHealth === 'HEALTHY' ? 'bg-green-900/60' :
            overallHealth === 'DEGRADED' ? 'bg-yellow-900/60' :
            overallHealth === 'CRITICAL' ? 'bg-red-900/60' : 'bg-gray-800'
          }`}>
            {overallHealth === 'HEALTHY' ? '✅' : overallHealth === 'DEGRADED' ? '⚠️' : overallHealth === 'CRITICAL' ? '🚨' : '⏳'}
          </div>
          <div>
            <p className={`text-lg font-bold ${
              overallHealth === 'HEALTHY' ? 'text-green-400' :
              overallHealth === 'DEGRADED' ? 'text-yellow-400' :
              overallHealth === 'CRITICAL' ? 'text-red-400' : 'text-gray-400'
            }`}>
              Platform Status: {overallHealth}
            </p>
            <p className="text-gray-400 text-sm">
              {health.filter(h => h.status === 'OK').length}/{health.length} services operational
              {criticalAlerts > 0 && ` · ${criticalAlerts} critical alert(s) require immediate attention`}
              {warningAlerts > 0 && !criticalAlerts && ` · ${warningAlerts} warning(s) to review`}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>TokenEquityX Platform V3</p>
          <p>Admin Security Console</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {DIAG_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === t.key ? 'border-yellow-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* HEALTH TAB */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {health.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-gray-500">Running health checks...</div>
          ) : health.map((h, i) => (
            <div key={i} className={`rounded-xl p-4 border ${statusBg(h.status)}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{h.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  h.status === 'OK' ? 'bg-green-900/60 text-green-300' :
                  h.status === 'DEGRADED' ? 'bg-yellow-900/60 text-yellow-300' :
                  'bg-red-900/60 text-red-300'
                }`}>{h.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{h.detail}</p>
                {h.critical && <span className="text-xs text-gray-600">Critical service</span>}
              </div>
              {h.status !== 'OK' && (
                <p className="text-xs mt-2 text-yellow-300">
                  {h.status === 'DOWN'
                    ? '⚠️ Service unreachable. Check Render dashboard for errors.'
                    : '⚠️ Service degraded. Monitor closely.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ALERTS TAB */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {alerts.map((a, i) => (
            <div key={i} className={`rounded-xl p-4 border ${alertColor(a.level)}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm text-white">{a.title}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      a.level === 'CRITICAL' ? 'bg-red-900/60 text-red-300' :
                      a.level === 'WARNING'  ? 'bg-yellow-900/60 text-yellow-300' :
                      a.level === 'OK'       ? 'bg-green-900/60 text-green-300' :
                      'bg-blue-900/60 text-blue-300'
                    }`}>{a.level}</span>
                  </div>
                  <p className="text-xs text-gray-300 mb-2">{a.detail}</p>
                  {a.action && (
                    <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-xs text-gray-300">
                      <span className="text-yellow-400 font-semibold">Suggested action: </span>
                      {a.action}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'security' && (
        <div className="space-y-3">
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-xs text-blue-300 mb-4">
            ℹ️ Security scans run against recent transaction history and user activity. For advanced threat detection, consider integrating Cloudflare or a WAF in production.
          </div>
          {security.map((s, i) => (
            <div key={i} className={`rounded-xl p-4 border ${alertColor(s.level)}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{s.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm text-white">{s.title}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.level === 'CRITICAL' ? 'bg-red-900/60 text-red-300' :
                      s.level === 'WARNING'  ? 'bg-yellow-900/60 text-yellow-300' :
                      s.level === 'OK'       ? 'bg-green-900/60 text-green-300' :
                      'bg-blue-900/60 text-blue-300'
                    }`}>{s.level}</span>
                  </div>
                  <p className="text-xs text-gray-300 mb-2">{s.detail}</p>
                  {s.action && (
                    <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-xs text-gray-300">
                      <span className="text-yellow-400 font-semibold">Suggested action: </span>
                      {s.action}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AUDIT TRAIL TAB */}
      {activeTab === 'audit' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Recent Platform Activity</h3>
            <span className="text-xs text-gray-500">{auditLog.length} recent events</span>
          </div>
          {auditLog.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">No audit log entries available.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 px-4 font-medium">Time</th>
                  <th className="text-left py-2 px-4 font-medium">Type</th>
                  <th className="text-left py-2 px-4 font-medium">Detail</th>
                  <th className="text-left py-2 px-4 font-medium">User</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                    <td className="py-2 px-4 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(entry.time).toLocaleString('en-GB', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        entry.type === 'DEPOSIT'    ? 'bg-green-900/50 text-green-300' :
                        entry.type === 'WITHDRAWAL' ? 'bg-red-900/50 text-red-300' :
                        entry.type === 'DIVIDEND'   ? 'bg-yellow-900/50 text-yellow-300' :
                        'bg-blue-900/50 text-blue-300'
                      }`}>{entry.type}</span>
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-300 max-w-xs truncate">{entry.detail}</td>
                    <td className="py-2 px-4 text-xs text-gray-400">{entry.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const {account,user,ready}=useWallet();
  const router=useRouter();
  const [tokens,setTokens]=useState([]);
  const [users,setUsers]=useState([]);
  const [selectedUser,setSelectedUser]=useState(null);
  const [userModalRole,setUserModalRole]=useState('');
  const [userModalLoading,setUserModalLoading]=useState(false);
  const [trades,setTrades]=useState([]);
  const [pipeline,setPipeline]=useState([]);
  const [selPipeline,setSelPipeline]=useState(null);
  const [assignModal,setAssignModal]=useState(null);
  const [assignNote,setAssignNote]=useState('');
  const [auditorList,setAuditorList]=useState([]);
  const [kycItems,setKycItems]=useState([]);
  const [approvedKycItems,setApprovedKycItems]=useState([]);
  const [entityKycList, setEntityKycList] = useState([]);
  const [expandedKyc, setExpandedKyc] = useState(null);
  const [expandedKycInvestor, setExpandedKycInvestor] = useState(null);
  const [flaggedTxns,setFlaggedTxns]=useState([
    {id:1,title:'Unusual volume pattern — ACME',desc:'Wallet 0x7f4a…b2c1 placed 14 orders in 3 minutes, total USD 48,000. Possible wash trading.',time:'Today 08:47 AM',system:'MarketController'},
  ]);
  const [tab,setTab]=useState('overview');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [settings, setSettings] = useState({});
  const [isSuperAdmin, setIsSuperAdmin]     = useState(false);
  const [activeTab, setActiveTab]       = useState('overview');
  const [otpSent,      setOtpSent]          = useState(false);
  const [otpCode,      setOtpCode]          = useState('');
  const [otpVerified,  setOtpVerified]      = useState(false);
  const [sensitiveKey, setSensitiveKey]     = useState('');
  const [sensitiveVal, setSensitiveVal]     = useState('');
  const [reconLogs,        setReconLogs]        = useState([]);
  const [reconRunning,     setReconRunning]     = useState(false);
  const [reconAudit,         setReconAudit]         = useState(null);
  const [reconAuditLoading,  setReconAuditLoading]  = useState(false);
  const [reconFixLoading,    setReconFixLoading]    = useState(false);
  const [reconFixModal,      setReconFixModal]      = useState(false);
  const [reconPreview,       setReconPreview]       = useState(null);
  const [reconPreviewLoading,setReconPreviewLoading]= useState(false);
  const [reconConfirmReason, setReconConfirmReason] = useState('');
  const [reconConfirmChecked,setReconConfirmChecked]= useState(false);
  const [reconFixSuccess,    setReconFixSuccess]    = useState(null);
  const [reconSettings,      setReconSettings]      = useState(null);
  const [reconSettingsLoading,setReconSettingsLoading] = useState(false);
  const [reconSettingsSaved, setReconSettingsSaved] = useState(false);
  const [reconSettingsForm,  setReconSettingsForm]  = useState({ primary: '', secondary: '', tertiary: '' });
  const [adjAudit,           setAdjAudit]           = useState(null);
  const [adjAuditLoading,    setAdjAuditLoading]    = useState(false);
  const [adjSelected,        setAdjSelected]        = useState([]);
  const [adjReversalLoading, setAdjReversalLoading] = useState(false);
  const [adjReversalModal,   setAdjReversalModal]   = useState(false);
  const [adjReversalReason,  setAdjReversalReason]  = useState('');
  const [adjReversalChecked, setAdjReversalChecked] = useState(false);
  const [adjReversalResult,  setAdjReversalResult]  = useState(null);
  const [spvFees, setSpvFees] = useState([]);
  const [staffList,    setStaffList]    = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [newStaff,     setNewStaff]     = useState({ email:'', password:'', full_name:'', role:'AUDITOR' });
  const [staffMsg,     setStaffMsg]     = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [appFeeModal, setAppFeeModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [feeConfirmModal, setFeeConfirmModal] = useState(null);
  const [deleteListingModal, setDeleteListingModal] = useState(null); // { item, step:1|2, input:'' }

  const [auditorFeeInput, setAuditorFeeInput] = useState('2500');
  const [rejectionReason, setRejectionReason] = useState('');
  const [auditorEmailInput, setAuditorEmailInput] = useState('');
  const [auditorNameInput, setAuditorNameInput] = useState('');
  const [deposits,setDeposits]=useState([]);
  const [withdrawals,setWithdrawals]=useState([]);
  const [walletLoading,setWalletLoading]=useState(false);
  const [txHistory,    setTxHistory]    = useState([]);
  const [txLoading,    setTxLoading]    = useState(false);
  const [txFilter,     setTxFilter]     = useState('ALL');
  const [txSearch,     setTxSearch]     = useState('');
  const [txPage,       setTxPage]       = useState(1);
  const TX_PAGE_SIZE = 25;
  const [walletMsg,setWalletMsg]=useState(null);
  const [loading,setLoading]=useState(true);
  const [now,setNow]=useState(new Date());
  const [health]=useState({api:true,blockchain:true,ws:true,db:true,oracle:true});
  const [actionMsg,setActionMsg]=useState(null);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  // Track which pipeline item has drill-down open
  const [detailItem, setDetailItem] = useState(null);

  const advanceStage = async (item) => {
    const STAGE_KEYS = ['spv','kyc','docs','auditor','contract','secz','offering','live'];
    const nextStageIdx = STAGE_KEYS.findIndex(k => !item.stages[k]);
    if (nextStageIdx === -1) { notify('info', 'Application is already fully approved.'); return; }
    const nextStage = STAGE_KEYS[nextStageIdx];
    try {
      if (item.isNewApplication) await api.put(`/submissions/${item.id}/status`, { status:'UNDER_REVIEW', notes:`Stage advanced to: ${nextStage} by Admin on ${new Date().toLocaleDateString()}` });
      setPipeline(p => p.map(i => i.id===item.id ? { ...i, stages: { ...i.stages, [nextStage]: true } } : i));
      notify('success', `✅ ${item.name} advanced — ${nextStage.toUpperCase()} stage marked complete.`);
    } catch(e) { notify('error', 'Failed to advance stage: ' + (e.response?.data?.error || e.message)); }
  };

  const rejectApplication = async (item) => {
    if (!window.confirm(`Reject ${item.name}? This will notify the issuer.`)) return;
    try {
      if (item.isNewApplication) await api.put(`/submissions/${item.id}/status`, { status:'REJECTED', notes:`Application rejected by Admin on ${new Date().toLocaleDateString()}` });
      setPipeline(p => p.filter(i => i.id !== item.id));
      setSelPipeline(null); setDetailItem(null);
      notify('error', `❌ ${item.name} application rejected.`);
    } catch(e) { notify('error', 'Failed to reject: ' + (e.response?.data?.error || e.message)); }
  };

  const suspendApplication = async (item) => {
    const isSuspended = item.status === 'SUSPENDED';
    const reason = isSuspended ? null : window.prompt(`Reason for suspending ${item.name} (optional):`);
    if (reason === null && !isSuspended) return;
    if (!window.confirm(`${isSuspended ? 'Reinstate' : 'Suspend'} ${item.name}?`)) return;
    try {
      await api.put(`/submissions/${item.id}/suspend`, { reason: reason || '' });
      setPipeline(p => p.map(i => i.id === item.id
        ? { ...i, status: isSuspended ? 'PENDING' : 'SUSPENDED' }
        : i
      ));
      notify(isSuspended ? 'success' : 'warning',
        isSuspended
          ? `✅ ${item.name} reinstated — status set back to Pending.`
          : `🚫 ${item.name} suspended. Issuer cannot progress until reinstated.`
      );
    } catch(e) {
      notify('error', 'Failed to update status: ' + (e.response?.data?.error || e.message));
    }
  };

  const deleteApplication = async (item) => {
    const sym = item.symbol || item.name;
    const typed = window.prompt(
      `SUSPEND LISTING: "${item.name}"\n\nThis will:\n• Remove ${sym} from the market immediately\n• Retain all data for 90 days (appeal window)\n• Notify the issuer\n\nType the token symbol "${sym}" to confirm:`
    );
    if (!typed) return;
    if (typed.toUpperCase() !== sym.toUpperCase()) {
      notify('error', 'Symbol did not match. Action cancelled.');
      return;
    }
    const reason = window.prompt('Enter reason for suspension (will be shown to issuer):');
    if (!reason) { notify('error', 'Reason is required. Action cancelled.'); return; }
    try {
      await api.put(`/submissions/${item.id}/soft-delete`, { reason });
      setPipeline(p => p.map(i => i.id === item.id ? { ...i, status: 'SUSPENDED' } : i));
      setSelPipeline(null);
      setDetailItem(null);
      notify('success', `⚠️ ${sym} suspended. Data retained for 90-day appeal window.`);
    } catch(e) {
      notify('error', 'Failed to suspend: ' + (e.response?.data?.error || e.message));
    }
  };

  const reinstateApplication = async (item) => {
    if (!window.confirm(`Reinstate "${item.name}"? This will restore the listing to PENDING status.`)) return;
    try {
      await api.put(`/submissions/${item.id}/reinstate`);
      setPipeline(p => p.map(i => i.id === item.id ? { ...i, status: 'PENDING' } : i));
      notify('success', `✅ ${item.name} reinstated successfully.`);
    } catch(e) {
      notify('error', 'Failed to reinstate: ' + (e.response?.data?.error || e.message));
    }
  };

  useEffect(() => {
    if (!assignModal) return;
    api.get('/auth/staff-list').then(r => {
      const auditors = (r.data || []).filter(u => u.role === 'AUDITOR');
      setAuditorList(auditors);
    }).catch(() => {});
  }, [assignModal]);

  const assignAuditor = async (item, auditorName) => {
    try {
      const res = await api.put(`/submissions/${item.id}/assign`, { assignedAuditor: auditorName });
      const { assignedAuditor: resolvedEmail, newStatus } = res.data || {};
      setPipeline(p => p.map(i => i.id === item.id ? {
        ...i,
        auditor: resolvedEmail || auditorName,
        assigned_auditor: resolvedEmail || auditorName,
        analyst: resolvedEmail || auditorName,
        status: newStatus || i.status,
        stages: { ...i.stages, auditor: true },
      } : i));
      setAssignModal(null); setAssignNote('');
      notify('success', `Auditor "${resolvedEmail || auditorName}" assigned to ${item.name}.`);
    } catch(e) {
      setAssignModal(null); setAssignNote('');
      notify('error', e?.response?.data?.error || `Failed to assign auditor to ${item.name}.`);
    }
  };

  useEffect(()=>{
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if(!storedUser?.role) return;
    if(storedUser.role !== 'ADMIN'){ window.location.href = '/'; return; }
    loadAll();
    const tick = setInterval(()=>setNow(new Date()), 1000);
    return()=>clearInterval(tick);
  }, [ready]);

  useEffect(() => {
    if (tab !== 'settings') return;
    setSettingsLoading(true);
    const token = localStorage.getItem('token');
    fetch(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d && typeof d === 'object') setSettings(d); })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
      // Check super admin status
      fetch(`${API}/super-admin/status`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setIsSuperAdmin(d.is_super_admin)).catch(() => {});
      // Load reconciliation logs
      fetch(`${API}/settings/reconciliation`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setReconLogs(d); }).catch(() => {});
      fetch(`${API}/settings/spv-fees`, { headers:{ Authorization:`Bearer ${token}` } })
        .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setSpvFees(d); }).catch(()=>{});
      setStaffLoading(true);
      fetch(`${API}/auth/staff-list`, { headers:{ Authorization:`Bearer ${token}` } })
        .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setStaffList(d); }).catch(()=>{})
        .finally(()=>setStaffLoading(false));
  }, [tab]);

  const loadAll = async () => {
    try {
      const token = localStorage.getItem('token');
      const[tokRes,tradeRes,usersRes,subRes,txRes]=await Promise.allSettled([
        api.get('/assets'), api.get('/trading/recent?limit=20'),
        api.get('/admin/users'), api.get('/submissions/pending'),
        fetch(`${API}/wallet/admin/transactions?limit=100`,{headers:{Authorization:`Bearer ${token}`}}),
      ]);
      if(tokRes.status==='fulfilled')setTokens(tokRes.value.data||[]);
      if(tradeRes.status==='fulfilled')setTrades(tradeRes.value.data||[]);
      if(usersRes.status==='fulfilled')setUsers(usersRes.value.data||[]);
      if(txRes.status==='fulfilled'){
        try{
          const txData=await txRes.value.json();
          if(Array.isArray(txData)&&txData.length>0){
            const byDay={};
            txData.forEach(tx=>{
              const day=new Date(tx.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
              if(!byDay[day])byDay[day]={day,volume:0,fees:0};
              byDay[day].volume+=parseFloat(tx.amount_usd||0);
              byDay[day].fees+=parseFloat(tx.fee_usd||0);
            });
            const chartData=Object.values(byDay).slice(-14);
            if(chartData.length>0)mockVolChart.splice(0,mockVolChart.length,...chartData);
          }
        }catch{}
      }
      fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001/api'}/wallet/admin/deposits`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setDeposits(d);}).catch(()=>{});
      fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001/api'}/wallet/admin/withdrawals`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setWithdrawals(d);}).catch(()=>{});
      const entityKycMap = {};
      try {
        const kycRes = await api.get('/entity-kyc');
        if (Array.isArray(kycRes.data)) {
          kycRes.data.forEach(k => { entityKycMap[k.user_id] = k.status; });
        }
      } catch {}

      if(subRes.status==='fulfilled' && subRes.value.data?.length){
        const tokenisationApps = subRes.value.data.filter(s=>s.submission_type==='TOKENISATION_APPLICATION'||s.period==='TOKENISATION_APPLICATION').map(s=>({
          id:s.id,name:s.entity_name||(s.token_symbol+' — Application'),symbol:s.token_symbol,asset_class:'Pending Classification',
          stages:{
            spv:      true,
            kyc:      entityKycMap[s.issuer_wallet] === 'APPROVED' || ['APPROVED','FEE_CONFIRMED','UNDER_REVIEW','AUDITOR_APPROVED'].includes(s.application_status) || s.status === 'ADMIN_APPROVED',
            docs:     (s.document_count||0) > 0,
            auditor:  s.auditor_status === 'ACCEPTED' || s.status === 'AUDITOR_APPROVED' || s.status === 'ADMIN_APPROVED',
            contract: ['ADMIN_APPROVED','TOKENIZATION_PENDING','SECZ_REVIEW','SECZ_APPROVED','LIVE'].includes(s.status),
            secz:     ['SECZ_APPROVED','LIVE'].includes(s.status),
            // offering completes when market transitions out of PRIMARY_ONLY (can't be determined
            // from submission status alone — stays false here; active tokens below use market_state)
            offering: false,
            live:     false,
          },
          amount_target:0,amount_raised:0,submitted:s.created_at,analyst:'Pending assignment',
          reference:s.reference_number,status:s.status,application_status:s.application_status||'PENDING_REVIEW',fee_status:s.fee_status||'NOT_REQUIRED',assigned_auditor:s.assigned_auditor||null,
          audit_report:s.audit_report?(typeof s.audit_report==='string'?JSON.parse(s.audit_report):s.audit_report):null,
          contacts:[{name:'Submitted via platform',role:'Issuer',email:'',phone:''}],
          docs:(() => { try { const d = typeof s.data_json === 'string' ? JSON.parse(s.data_json) : (s.data_json||{}); const docsObj = d.documents||{}; return Object.entries(docsObj).map(([key,doc])=>({name:doc.name||key,url:doc.url||null,size:doc.size||0,status:'uploaded',key})); } catch { return Array.from({length:s.document_count||0},(_,i)=>({name:`Document ${i+1}`,status:'uploaded'})); }})(),
          auditor:s.assigned_auditor||'Pending assignment',partner:'None',
          notes:`Ref: ${s.reference_number||s.id} · Status: ${s.status} · Documents: ${s.document_count||0}`,
          isNewApplication:true,
          document_count: s.document_count||0,
          has_financial_data: (() => { try { const d = typeof s.data_json==='string'?JSON.parse(s.data_json):(s.data_json||{}); return Object.values(d.financialData||{}).filter(v=>v!==''&&v!==null&&v!==undefined).length >= 3; } catch { return false; } })(),
          kyc_approved: entityKycMap[s.issuer_wallet] === 'APPROVED',
          auditor_status: s.auditor_status || null,
        }));
        const financialSubs = subRes.value.data.filter(s=>s.submission_type!=='TOKENISATION_APPLICATION'&&s.period!=='TOKENISATION_APPLICATION').map(s=>({
          id:s.id,name:`${s.token_symbol} — ${s.entity_name||s.token_symbol}`,symbol:s.token_symbol,asset_class:'Financial Data',
          stages:{spv:true,kyc:true,docs:true,auditor:!!s.assigned_auditor,contract:false,secz:false,offering:false,live:false},
          amount_target:0,amount_raised:0,submitted:s.created_at,analyst:s.assigned_auditor||'Pending assignment',
          reference:s.reference_number,status:s.status,application_status:s.application_status||'PENDING_REVIEW',fee_status:s.fee_status||'NOT_REQUIRED',assigned_auditor:s.assigned_auditor||null,
          contacts:[{name:'Submitted via platform',role:'Issuer',email:'',phone:''}],
          docs:(() => { try { const d = typeof s.data_json === 'string' ? JSON.parse(s.data_json) : (s.data_json||{}); return (d.documents||[]).map(doc=>({name:doc.name||'Document',url:doc.url||null,size:doc.size||0,status:'uploaded'})); } catch { return Array.from({length:s.document_count||0},(_,i)=>({name:`Document ${i+1}`,status:'uploaded'})); }})(),
          auditor:s.assigned_auditor||'Pending assignment',partner:'None',
          notes:`Financial data submission. Period: ${s.period}. Status: ${s.status}.`,
          isNewApplication:true,
        }));
        const activeSubs = Array.isArray(tokRes?.value?.data) ? tokRes.value.data
          .filter(t => t.status === 'ACTIVE' && !tokenisationApps.find(a => a.symbol === (t.token_symbol||t.symbol)))
          .map(t => ({
            id: t.id,
            name: t.token_name || t.name || t.company_name,
            symbol: t.token_symbol || t.symbol,
            asset_class: t.asset_type || t.asset_class || 'ACTIVE',
            stages: {
              spv:true, kyc:true, docs:true, auditor:true, contract:true, secz:true,
              // offering complete when market_state moved past PRIMARY_ONLY (offering was disbursed)
              offering: ['FULL_TRADING','P2P_ONLY'].includes(t.market_state),
              // full trading only when market_state = FULL_TRADING (not P2P_ONLY)
              live: t.market_state === 'FULL_TRADING',
            },
            amount_target: 0, amount_raised: 0,
            submitted: t.created_at, analyst: '—',
            status: 'ADMIN_APPROVED', application_status: 'APPROVED',
            auditor: '—', partner: 'None',
            contacts: [{ name: 'Live on market', role: 'ACTIVE', email: '', phone: '' }],
            docs: [], notes: `Live listing — ${t.market_state}`,
            isNewApplication: false,
          })) : [];
        setPipeline([...tokenisationApps,...financialSubs,...activeSubs]);
      }
      const token2 = localStorage.getItem('token');
      fetch(`${API}/entity-kyc`, { headers: { Authorization: `Bearer ${token2}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setEntityKycList(d); }).catch(()=>{});
      fetch(`${API}/kyc/pending`, { headers: { Authorization: `Bearer ${token2}` } })
        .then(r => r.json()).then(data => {
          if (!Array.isArray(data)) return;
          const pending = data.filter(k => k.status === 'PENDING');
          setKycItems(pending.map(k => ({
            id:                    k.id,
            name:                  k.full_name || 'Unknown',
            wallet:                k.wallet_address || '—',
            email:                 k.email || '—',
            type:                  k.id_type || '—',
            nationality:           k.nationality || null,
            id_number:             k.id_number || null,
            date_of_birth:         k.date_of_birth || null,
            city:                  k.city || null,
            country:               k.country || null,
            docs:                  Array.isArray(k.documents) ? k.documents.length : 0,
            documents:             Array.isArray(k.documents) ? k.documents : [],
            submitted:             k.submitted_at,
            status:                k.status || 'PENDING',
            risk:                  (k.risk_score||0) > 15 ? 'HIGH' : (k.risk_score||0) > 8 ? 'MEDIUM' : 'LOW',
            risk_profile:          k.risk_profile || null,
            investor_tier:         k.investor_tier || 'RETAIL',
            corporate_details:     k.corporate_details     || null,
            institutional_details: k.institutional_details || null,
            investment_mandate_url:k.investment_mandate_url || null,
          })));
        }).catch(()=>{});
      fetch(`${API}/kyc/approved`, { headers: { Authorization: `Bearer ${token2}` } })
        .then(r => r.json()).then(data => {
          if (Array.isArray(data)) setApprovedKycItems(data);
        }).catch(()=>{});
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/admin/users`,{headers:{Authorization:`Bearer ${token}`}});
    const data = await res.json();
    setUsers(Array.isArray(data)?data:[]);
  };

  const createStaff = async () => {
    if(!staffForm.full_name||!staffForm.email||!staffForm.password){setStaffMsg({type:'error',text:'Name, email and password are required.'});return;}
    setStaffLoading(true);setStaffMsg(null);
    try {
      const token=localStorage.getItem('token');
      const res=await fetch(`${API}/admin/staff`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(staffForm)});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error);
      setStaffMsg({type:'success',text:data.message});
      setStaffForm({full_name:'',email:'',password:'',role:'AUDITOR'});
      fetchUsers();
    }catch(err){setStaffMsg({type:'error',text:err.message||'Failed to create account.'});}
    finally{setStaffLoading(false);}
  };

  const notify=(type,text)=>{setActionMsg({type,text});setTimeout(()=>setActionMsg(null),3500);};

  const handleApproveApplication = async () => {
    if (!appFeeModal) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/settings/applications/${appFeeModal.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditor_email: auditorEmailInput, auditor_name: auditorNameInput, notes: appFeeModal.notes || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify('success', `✅ Application approved. Compliance fee: $${data.complianceFee}. Ref: ${data.paymentRef}. Auditor notified: ${data.auditorEmail}`);
      setPipeline(p => p.map(i => i.id === appFeeModal.id ? { ...i, application_status: 'APPROVED', fee_status: 'PENDING_PAYMENT' } : i));
      setAppFeeModal(null); setAuditorEmailInput(''); setAuditorNameInput('');
    } catch(e) { notify('error', e.message || 'Could not approve application'); }
  };

  const handleRejectApplication = async () => {
    if (!rejectModal || !rejectionReason) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/settings/applications/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify('error', '❌ Application rejected. Issuer notified by email.');
      setPipeline(p => p.map(i => i.id === rejectModal.id ? { ...i, application_status: 'REJECTED' } : i));
      setRejectModal(null); setRejectionReason('');
    } catch(e) { notify('error', e.message || 'Could not reject application'); }
  };

  const handleConfirmFee = async () => {
    if (!feeConfirmModal || !auditorEmailInput) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/settings/applications/${feeConfirmModal.id}/confirm-fee`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditor_email: auditorEmailInput, auditor_name: auditorNameInput, estimated_days: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify('success', '✅ Fee confirmed. Auditor assigned. Issuer notified.');
      setPipeline(p => p.map(i => i.id === feeConfirmModal.id ? { ...i, application_status: 'FEE_CONFIRMED', fee_status: 'PAID', assigned_auditor: auditorEmailInput } : i));
      setFeeConfirmModal(null); setAuditorEmailInput(''); setAuditorNameInput('');
    } catch(e) { notify('error', e.message || 'Could not confirm fee'); }
  };

  const handleSaveSetting = async (key, value) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/settings/${key}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(s => ({ ...s, [key]: { ...s[key], value } }));
      setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000);
    } catch(e) { notify('error', e.message || 'Could not save setting'); }
  };

  const loadTxHistory = async (filter = 'ALL', page = 1) => {
    setTxLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: TX_PAGE_SIZE, offset: (page-1)*TX_PAGE_SIZE });
      if (filter !== 'ALL') params.append('type', filter);
      const res  = await fetch(`${API}/wallet/admin/transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setTxHistory(data);
    } catch {}
    setTxLoading(false);
  };
  const handleKYC = async (id, action) => {
    const token = localStorage.getItem('token');
    if (action === 'approve') {
      const res = await fetch(`${API}/kyc/approve/${id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' } });
      if (res.ok) {
        const approved = kycItems.find(i => i.id === id);
        setKycItems(k => k.filter(i => i.id !== id));
        if (approved) setApprovedKycItems(prev => [{ ...approved, reviewed_at: new Date().toISOString() }, ...prev]);
        notify('success','✅ KYC approved. Investor notified.');
      } else { const d=await res.json(); notify('error', d.error||'Approval failed'); }
    } else if (action === 'reject') {
      const reason = window.prompt('Rejection reason (shown to investor):');
      if (!reason) return;
      const res = await fetch(`${API}/kyc/reject/${id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({reviewerNotes:reason}) });
      if (res.ok) { setKycItems(k=>k.filter(i=>i.id!==id)); notify('error','❌ KYC rejected. Investor notified.'); }
      else { const d=await res.json(); notify('error', d.error||'Rejection failed'); }
    } else {
      // Open the full detail view for this investor
      setExpandedKycInvestor(prev => prev === id ? null : id);
    }
  };
  const handleFlag=(id,action)=>{setFlaggedTxns(f=>f.filter(i=>i.id!==id));notify(action==='dismiss'?'info':'warning',action==='dismiss'?'Flag dismissed.':'🚫 Wallet suspended.');};
  const pipelineProgress=stages=>{const keys=PIPELINE_STAGES.map(s=>s.key);const done=keys.filter(k=>stages[k]).length;return Math.round((done/keys.length)*100);};
  const liveListings=pipeline.filter(p=>p.stages.live).length;
  const inOfferingPhase=pipeline.filter(p=>p.stages.secz&&!p.stages.live).length;
  const pendingApprovals=pipeline.filter(p=>!p.stages.secz).length;
  const totalAUM=pipeline.filter(p=>p.stages.live).reduce((a,p)=>a+p.amount_raised,0);
  const totalFeesMTD=mockRevBreakdown.length>0?mockRevBreakdown.reduce((a,r)=>a+r.value,0):0;
  const totalUsers=users.length||9;
  const pendingKYC=kycItems.length;
  const pendingDeposits=deposits.filter(d=>d.status==='PENDING').length;
  const pendingWithdrawals=withdrawals.filter(w=>w.status==='PENDING').length;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if(!JSON.parse(localStorage.getItem('user')||'{}')?.role) return null;

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
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between bg-gray-900/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:GOLD}}><span className="text-sm font-bold text-gray-900">TX</span></div>
          <div><p className="font-bold text-sm">TokenEquityX</p><p className="text-gray-500 text-xs">Admin Control Centre</p></div>
          <span className="ml-2 text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">ADMIN</span>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(health).map(([k,v])=>(
            <div key={k} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${v?'bg-green-900/50 text-green-400 border border-green-800':'bg-red-900/50 text-red-400 border border-red-800'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${v?'bg-green-400 animate-pulse':'bg-red-400'}`}/>{k.toUpperCase()}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <p className="text-gray-400 text-sm font-mono">{now.toLocaleTimeString('en-GB')}</p>
          <span className="text-gray-500 text-xs">{JSON.parse(localStorage.getItem('user')||'{}')?.id||'Admin'}</span>
          <Inbox token={typeof window !== 'undefined' ? localStorage.getItem('token') : ''} />
          <button onClick={()=>window.location.href='/profile'} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1 rounded-lg">Profile</button>
          <button onClick={()=>{localStorage.clear();window.location.href='/';}} className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1 rounded-lg">Disconnect</button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {actionMsg&&<div className={`rounded-xl p-4 border mb-4 text-sm ${actionMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':actionMsg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':actionMsg.type==='warning'?'bg-amber-900/40 border-amber-700 text-amber-300':'bg-blue-900/40 border-blue-700 text-blue-300'}`}>{actionMsg.text}</div>}

        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Platform Overview</h1><p className="text-gray-500 text-sm">Real-time view of all platform activity</p></div>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap items-center">
            {/* Overview with dropdown */}
            <div className="relative" onMouseLeave={()=>setShowMoreMenu(false)}>
              <button
                onMouseEnter={()=>setShowMoreMenu(true)}
                onClick={()=>{setTab('overview');setShowMoreMenu(m=>!m);}}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${tab==='overview'||['wallet','ledger','tools','blog'].includes(tab)?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                Overview
                {(pendingDeposits+pendingWithdrawals)>0&&<span className="ml-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingDeposits+pendingWithdrawals}</span>}
                <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {showMoreMenu && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button onClick={()=>{setTab('overview');setShowMoreMenu(false);}}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${tab==='overview'?'bg-blue-600 text-white':'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                    Overview
                  </button>
                  <div className="border-t border-gray-800 my-1"/>
                  {[
                    {key:'wallet', label:'Wallet', badge:(pendingDeposits+pendingWithdrawals)>0?(pendingDeposits+pendingWithdrawals):null},
                    {key:'ledger', label:'Ledger'},
                    {key:'tools',  label:'Tools'},
                    {key:'blog',   label:'Blog'},
                  ].map(item=>(
                    <button key={item.key} onClick={()=>{setTab(item.key);setShowMoreMenu(false);}}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${tab===item.key?'bg-blue-600 text-white':'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                      <span className="capitalize">{item.label}</span>
                      {item.badge&&<span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Primary tabs */}
            {['pipeline','trading','compliance','users','offerings','settings','diagnostic'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                {t}
                {t==='pipeline'&&pendingApprovals>0&&<span className="ml-1.5 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingApprovals}</span>}
                {t==='compliance'&&pendingKYC>0&&<span className="ml-1.5 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingKYC}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
              <KPI label="Total AUM" value={fmt(totalAUM)} sub="live listings" icon="💰" color="text-yellow-400"/>
              <KPI label="Fees MTD" value={fmt(totalFeesMTD)} sub="all streams" icon="📈" color="text-green-400"/>
              <KPI label="Live Listings" value={liveListings} sub={`${pendingApprovals} pending`} icon="🏢"/>
              <KPI label="Users" value={fmtN(totalUsers)} sub="registered" icon="👥"/>
              <KPI label="Pending KYC" value={pendingKYC} sub="awaiting review" icon="⏳" color={pendingKYC>0?'text-amber-400':'text-white'}/>
              <KPI label="Active Orders" value={8} sub="in order book" icon="📋"/>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Volume & Fees — Last 14 Days</h3>
                {mockVolChart.length===0?(
                  <div className="flex items-center justify-center h-40 text-gray-600 text-xs">No trading volume data yet.</div>
                ):(
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={mockVolChart}>
                    <defs>
                      <linearGradient id="volG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={NAVY} stopOpacity={0.6}/><stop offset="95%" stopColor={NAVY} stopOpacity={0}/></linearGradient>
                      <linearGradient id="feeG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.6}/><stop offset="95%" stopColor={GOLD} stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
                    <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:11}} tickLine={false}/>
                    <YAxis tick={{fill:'#6b7280',fontSize:11}} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}}/>
                    <Area type="monotone" dataKey="volume" stroke={NAVY} fill="url(#volG)" strokeWidth={2} name="Volume"/>
                    <Area type="monotone" dataKey="fees" stroke={GOLD} fill="url(#feeG)" strokeWidth={2} name="Fees"/>
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">Revenue Mix MTD</h3>
                {mockRevBreakdown.length===0?(
                  <div className="flex items-center justify-center h-32 text-gray-600 text-xs">No revenue data yet.</div>
                ):(
                <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={mockRevBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>{mockRevBreakdown.map((_,i)=><Cell key={i} fill={REVENUE_COLORS[i]}/>)}</Pie><Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[`$${v.toLocaleString()}`,'Revenue']}/></PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">{mockRevBreakdown.map((r,i)=><div key={i} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{background:REVENUE_COLORS[i]}}/><span className="text-gray-400">{r.name}</span></div><span className="text-white font-medium">${r.value.toLocaleString()}</span></div>)}</div>
                </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Live Listings</h3><button onClick={()=>setTab('pipeline')} className="text-xs text-blue-400 hover:text-blue-300">Pipeline →</button></div>
                <table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Token','Class','Price','24h Vol','Raised'].map(h=><th key={h} className="text-left pb-2 font-medium pr-4">{h}</th>)}</tr></thead>
                <tbody>{tokens.map((t,i)=>(
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={()=>setTab('pipeline')}>
                    <td className="py-3 pr-4"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{background:NAVY}}>{(t.symbol||'Z')[0]}</div><div><p className="font-medium">{t.symbol||'ZWIB'}</p><p className="text-gray-500 text-xs">{t.company_name||t.name}</p></div></div></td>
                    <td className="py-3 pr-4"><span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{t.asset_class||t.asset_type||'Bond'}</span></td>
                    <td className="py-3 pr-4 font-mono">${parseFloat(t.oracle_price||t.current_price_usd||1).toFixed(4)}</td>
                    <td className="py-3 pr-4 text-gray-300">{fmt(Math.floor(50000+i*80000))}</td>
                    <td className="py-3 text-green-400">{fmt(t.amount_raised||1250000)}</td>
                  </tr>))}</tbody></table>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4">System Alerts</h3>
                <div className="space-y-2">
                  {mockAlerts.length===0?(
                    <p className="text-gray-600 text-xs text-center py-4">No alerts at this time.</p>
                  ):mockAlerts.map(a=>(
                    <div key={a.id} className={`rounded-lg p-3 border text-xs ${ALERT_STYLES[a.type]}`}>
                      <div className="flex items-start gap-2">
                        <span>{ALERT_ICONS[a.type]}</span>
                        <div><p>{a.msg}</p><p className="opacity-60 mt-0.5">{a.time}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ PIPELINE ══ */}
        {tab==='pipeline'&&(
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-2">
              {[
                {label:'Applications',  value:pipeline.length,                                                              icon:'📋'},
                {label:'Full Trading',  value:pipeline.filter(p=>p.stages.live).length,                                    icon:'🟢'},
                {label:'In Offering',   value:pipeline.filter(p=>p.stages.secz&&!p.stages.live).length,                    icon:'🪙'},
                {label:'In Review',     value:pipeline.filter(p=>p.stages.kyc&&!p.stages.secz).length,                     icon:'🔍'},
              ].map((s,i)=><KPI key={i} {...s}/>)}
            </div>
            {pipeline.map(item=>{
              const progress=pipelineProgress(item.stages);
              const nextStage=PIPELINE_STAGES.find(s=>!item.stages[s.key]);
              const isSelected=selPipeline?.id===item.id;
              const isDetailOpen=detailItem?.id===item.id;
              return(
                <div key={item.id} className={`rounded-xl border transition-all ${isSelected?'border-blue-600':'border-gray-800'} bg-gray-900`}>
                  <div className="p-5 cursor-pointer" onClick={()=>{setSelPipeline(isSelected?null:item);if(isSelected)setDetailItem(null);}}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm" style={{background:NAVY}}>{item.symbol[0]}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-blue-300">{item.name}</p>
                            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{item.symbol}</span>
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{item.asset_class}</span>
                            {item.status==='SUSPENDED' && (
                              <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full border border-amber-700/50">🚫 Suspended</span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">Submitted {dt(item.submitted)} · Analyst: {item.analyst}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="font-bold text-yellow-400 text-lg">{progress}%</p><p className="text-gray-500 text-xs">{PIPELINE_STAGES.filter(s=>item.stages[s.key]).length}/{PIPELINE_STAGES.length} stages</p></div>
                        <span className="text-gray-500">{isSelected?'▲':'▼'}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-3"><div className="h-2 rounded-full" style={{width:`${progress}%`,background:progress===100?GREEN:GOLD}}/></div>
                    <div className="flex flex-wrap gap-2">
                      {PIPELINE_STAGES.map(stage=>{
                        const done=item.stages[stage.key];
                        const isNext=!done&&stage===nextStage;
                        return<div key={stage.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${done?'bg-green-900/40 border-green-700 text-green-300':isNext?'bg-amber-900/40 border-amber-600 text-amber-300 animate-pulse':'bg-gray-800 border-gray-700 text-gray-500'}`}><span>{stage.icon}</span><span>{stage.label}</span>{done&&<span>✓</span>}{isNext&&<span>← Next</span>}</div>;
                      })}
                    </div>
                    {nextStage&&<div className="mt-3 bg-amber-900/20 border border-amber-800/50 rounded-lg px-4 py-2"><p className="text-amber-300 text-xs"><span className="font-semibold">Awaiting:</span> {nextStage.label}</p></div>}
                  </div>

                  {isSelected&&(
                    <div className="border-t border-gray-800 p-5">
                      {/* ── 3-column summary row */}
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
                        <div className="bg-gray-800/50 rounded-xl p-4">
                          <h4 className="font-semibold text-sm mb-3 text-gray-300">📋 Key Contacts</h4>
                          {item.contacts.map((c,i)=>(
                            <div key={i} className="mb-3">
                              <p className="font-medium text-sm">{c.name}</p>
                              <p className="text-gray-500 text-xs">{c.role}</p>
                              <p className="text-blue-400 text-xs">{c.email}</p>
                              <p className="text-gray-500 text-xs">{c.phone}</p>
                            </div>
                          ))}
                          <div className="pt-3 border-t border-gray-700 space-y-2">
                            <div><p className="text-gray-500 text-xs">Assigned Auditor</p><p className="text-sm font-medium">{item.auditor}</p></div>
                            <div><p className="text-gray-500 text-xs">Partner</p><p className="text-sm font-medium">{item.partner}</p></div>
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl p-4">
                          <h4 className="font-semibold text-sm mb-3 text-gray-300">📄 Documents</h4>
                          <div className="space-y-2">
                            {item.docs.map((d,i)=>(
                              <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{d.status==='uploaded'?'✅':'⏳'}</span>
                                  <span className="text-xs text-gray-300">{d.name}</span>
                                  {d.size > 0 && <span className="text-xs text-gray-600">{(d.size/1024).toFixed(0)} KB</span>}
                                </div>
                                {d.url ? (
                                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
                                    View
                                  </a>
                                ) : d.status==='uploaded' ? (
                                  <button className="text-xs text-gray-500 cursor-not-allowed">No URL</button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl p-4">
                          <h4 className="font-semibold text-sm mb-3 text-gray-300">📝 Actions</h4>

                          {/* Application fee workflow status */}
                          {item.isNewApplication && (
                            <div className="mb-3">
                              {item.application_status === 'APPROVED' && item.fee_status === 'PENDING_PAYMENT' && (
                                <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg px-3 py-2 mb-2">
                                  <p className="text-amber-300 text-xs font-bold">💳 Awaiting Fee Payment</p>
                                  <p className="text-gray-400 text-xs mt-0.5">Invoice sent to issuer. Confirm once payment received.</p>
                                  <button onClick={()=>setFeeConfirmModal(item)}
                                    className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold bg-green-700 hover:bg-green-600 text-white">
                                    ✅ Confirm Fee Received
                                  </button>
                                </div>
                              )}
                              {item.application_status === 'FEE_CONFIRMED' && (
                                <div className="bg-green-900/20 border border-green-800/50 rounded-lg px-3 py-2 mb-2">
                                  <p className="text-green-300 text-xs font-bold">✅ Fee Paid — Under Review</p>
                                  <p className="text-gray-400 text-xs mt-0.5">Auditor assigned: {item.assigned_auditor}</p>
                                </div>
                              )}
                              {item.application_status === 'REJECTED' && (
                                <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 mb-2">
                                  <p className="text-red-300 text-xs font-bold">❌ Application Rejected</p>
                                </div>
                              )}
                              {(!item.application_status || item.application_status === 'PENDING') && (
                                <div className="flex gap-2 mb-2">
                                  <button onClick={()=>setAppFeeModal(item)}
                                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white">
                                    ✅ Approve at Meeting
                                  </button>
                                  <button onClick={()=>setRejectModal(item)}
                                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-900/50 hover:bg-red-900/70 text-red-300 border border-red-800">
                                    ❌ Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {item.assigned_auditor && (
                            <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-2 mb-3">
                              <p className="text-blue-300 text-xs font-semibold">🔍 Assigned Auditor</p>
                              <p className="text-white text-sm mt-0.5">{item.assigned_auditor}</p>
                            </div>
                          )}
                          {item.audit_report && (
                            <div className="bg-green-900/20 border border-green-800/50 rounded-lg px-3 py-2 mb-3">
                              <p className="text-green-300 text-xs font-bold mb-1">✓ Audit Report Received</p>
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <span className="text-gray-400">Risk: <span className="text-white font-bold">{item.audit_report.riskRating}</span></span>
                                <span className="text-gray-400">Price: <span className="text-yellow-400 font-bold">${item.audit_report.certifiedPrice?.toFixed(4)}</span></span>
                                <span className="text-gray-400 col-span-2">Suggested: <span className="text-blue-300 font-bold">{item.audit_report.suggestedListingType?.replace('_',' ')}</span></span>
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            {item.stages.live ? (
                              <div className="bg-green-900/30 border border-green-800/50 rounded-lg p-3 text-center">
                                <p className="text-green-300 font-semibold text-sm">🟢 Step 8 — Full Trading Live</p>
                                <p className="text-green-400 text-xs mt-1">{fmt(item.amount_raised)} raised · Secondary market open 24/7</p>
                              </div>
                            ) : item.status === 'LIVE' ? (
                              <div className="space-y-2">
                                <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
                                  <p className="text-yellow-300 font-bold text-xs">🪙 Step 7 — Primary Offering Phase</p>
                                  <p className="text-gray-400 text-xs mt-1">
                                    Token is in <span className="text-yellow-300 font-semibold">PRIMARY_ONLY</span> mode.
                                    Issuer must create a primary offering. Full trading unlocks automatically after the offering closes and proceeds are disbursed.
                                  </p>
                                </div>
                                <p className="text-xs text-gray-500 text-center px-1">
                                  Go to the <span className="text-yellow-400 font-semibold">Primary Offerings</span> tab to review or manage this token&apos;s offering.
                                </p>
                              </div>
                            ) : item.status === 'TOKENIZATION_PENDING' ? (
                              <div className="space-y-2">
                                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                                  <p className="text-blue-300 font-bold text-xs mb-1">⛓️ Tokenisation Pending</p>
                                  <p className="text-gray-400 text-xs">Committee approval granted. Submit to SECZ for regulatory review.</p>
                                </div>
                                <button onClick={async()=>{
                                  try {
                                    const r = await api.put(`/submissions/${item.id}/submit-to-secz`);
                                    setPipeline(p => p.map(i => i.id===item.id ? {...i, status:'SECZ_REVIEW'} : i));
                                    notify('success', r.data.message);
                                  } catch(e) { notify('error', e.response?.data?.error || 'Failed'); }
                                }} className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600">
                                  ⛓️ Submit to SECZ for Review
                                </button>
                              </div>
                            ) : item.status === 'SECZ_REVIEW' ? (
                              <div className="space-y-2">
                                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3">
                                  <p className="text-amber-300 font-bold text-xs">🏛️ Under SECZ Review</p>
                                  <p className="text-gray-400 text-xs mt-1">Awaiting regulatory decision from SECZ.</p>
                                </div>
                                <button onClick={async()=>{
                                  try {
                                    const r = await api.put(`/submissions/${item.id}/secz-approve`);
                                    setPipeline(p => p.map(i => i.id===item.id ? {...i, status:'SECZ_APPROVED', stages:{...i.stages,secz:true}} : i));
                                    notify('success', r.data.message);
                                  } catch(e) { notify('error', e.response?.data?.error || 'Failed'); }
                                }} className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600">
                                  ✅ Record SECZ Approval
                                </button>
                              </div>
                            ) : item.status === 'SECZ_APPROVED' ? (
                              <div className="space-y-2">
                                <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3">
                                  <p className="text-green-300 font-bold text-xs">✅ Step 6 Complete — SECZ Approved</p>
                                  <p className="text-gray-400 text-xs mt-1">Regulatory clearance received. Activate Primary Offering Mode to begin Step 7 — the fundraising phase.</p>
                                </div>
                                <button onClick={async()=>{
                                  try {
                                    const r = await api.put(`/submissions/${item.id}/set-live`);
                                    // Step 7 (offering) now starts — live is step 8, unlocks after offering closes
                                    setPipeline(p => p.map(i => i.id===item.id ? {...i, status:'LIVE', stages:{...i.stages, offering:false, live:false}} : i));
                                    notify('success', r.data.message);
                                  } catch(e) { notify('error', e.response?.data?.error || 'Failed'); }
                                }} className="w-full py-3 rounded-lg text-sm font-bold text-white bg-yellow-700 hover:bg-yellow-600">
                                  🪙 Activate Primary Offering Mode (Step 7)
                                </button>
                                <p className="text-xs text-gray-500 text-center px-1">Token enters PRIMARY_ONLY. Issuer creates offering → subscriptions open → offering closes → Step 8 (Full Trading) unlocks automatically.</p>
                              </div>
                            ) : item.status === 'AUDITOR_APPROVED' ? (
                              <>
                                {!item.audit_report && (
                                  <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-2 mb-2">
                                    <p className="text-red-400 text-xs">🔒 No audit report on file. Admin approval will be blocked until an auditor submits a report.</p>
                                  </div>
                                )}
                                <AdminFinalApproval item={item} onApprove={(listingType, notes, riskCategory) => {
                                  api.put(`/submissions/${item.id}/admin-approve`, { listingType, adminNotes:notes, tokenSymbol:item.symbol, riskCategory })
                                    .then(r => { setPipeline(p => p.map(i => i.id===item.id ? { ...i, status:'TOKENIZATION_PENDING', stages:{...i.stages,contract:true} } : i)); notify('success', r.data.message); })
                                    .catch(e => notify('error', e.response?.data?.error || 'Approval failed'));
                                }} onReject={() => rejectApplication(item)}/>
                              </>
                            ) : (
                              <>
                                {!item.has_financial_data && item.isNewApplication && (
                                  <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-2 mb-1">
                                    <p className="text-amber-400 text-xs">⚠️ Financial data not yet submitted by issuer</p>
                                  </div>
                                )}
                                <button onClick={()=>advanceStage(item)} className="w-full py-2 rounded-lg text-xs font-semibold bg-green-700 hover:bg-green-600 text-white">✅ Advance to Next Stage</button>
                                {(() => {
                                  const docCount = item.document_count || 0;
                                  const kycOk = item.kyc_approved;
                                  const canAssign = docCount >= 7 && kycOk;
                                  const tips = [];
                                  if (docCount < 7) tips.push(`${docCount}/7 documents uploaded`);
                                  if (!kycOk) tips.push('Entity KYC not approved');
                                  return (
                                    <>
                                      {!canAssign && item.isNewApplication && (
                                        <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-2">
                                          <p className="text-red-400 text-xs">🔒 Cannot assign auditor: {tips.join('; ')}</p>
                                        </div>
                                      )}
                                      <button
                                        disabled={!canAssign && item.isNewApplication}
                                        onClick={()=>setAssignModal({itemId:item.id,itemName:item.name,item})}
                                        className={`w-full py-2 rounded-lg text-xs font-semibold text-white ${!canAssign && item.isNewApplication ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        🔍 Assign Auditor
                                      </button>
                                    </>
                                  );
                                })()}
                                <div className="border-t border-gray-700/50 pt-2 mt-1 space-y-2">
                                  <button
                                    onClick={()=>suspendApplication(item)}
                                    className={`w-full py-2 rounded-lg text-xs font-semibold border transition-colors ${
                                      item.status==='SUSPENDED'
                                        ? 'bg-green-900/40 text-green-300 border-green-800 hover:bg-green-900/60'
                                        : 'bg-amber-900/30 text-amber-300 border-amber-800 hover:bg-amber-900/50'
                                    }`}>
                                    {item.status==='SUSPENDED' ? '✅ Reinstate Application' : '🚫 Suspend Application'}
                                  </button>
                                  <button
                                    onClick={()=>deleteApplication(item)}
                                    className="w-full py-2 rounded-lg text-xs font-semibold bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/60">
                                    ⚠️ Suspend Listing (90-day appeal)
                                  </button>
                                  {item.status === 'SUSPENDED' && (
                                    <button
                                      onClick={()=>reinstateApplication(item)}
                                      className="w-full py-2 rounded-lg text-xs font-semibold bg-green-900/40 text-green-300 border border-green-800 hover:bg-green-900/60">
                                      ✅ Reinstate Listing
                                    </button>
                                  )}
                                  <div className="border-t border-red-900/40 pt-2 mt-1">
                                    <button
                                      onClick={()=>setDeleteListingModal({ item, step: 1, input: '' })}
                                      className="w-full py-1.5 rounded-lg text-xs font-medium bg-transparent text-red-600 border border-red-900/60 hover:bg-red-950/40 hover:text-red-400 transition-colors">
                                      🗑️ Delete Listing Permanently
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── Drill-down toggle button */}
                      <div className="border-t border-gray-700/50 pt-4">
                        <button
                          onClick={()=>setDetailItem(isDetailOpen?null:item)}
                          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${isDetailOpen?'bg-blue-900/40 border border-blue-700/50 text-blue-300':'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'}`}>
                          {isDetailOpen ? '▲ Collapse Financial Detail' : '▼ Drill Down — View Financial Data & Valuation Breakdown'}
                        </button>

                        {/* ── Full detail panel */}
                        {isDetailOpen && (
                          <div className="mt-4 bg-gray-800/30 border border-gray-700/50 rounded-xl p-5">
                            <SubmissionDetailPanel item={item} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ TRADING ══ */}
        {tab==='trading'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <KPI label="Volume Today" value={fmt(485000)} sub="all assets" icon="📊"/>
              <KPI label="Trades Today" value="34" sub="matched" icon="🔄"/>
              <KPI label="Fees Today" value={fmt(2425)} sub="0.50% rate" icon="💵"/>
              <KPI label="Circuit Breakers" value="0" sub="none active" icon="🔒" color="text-green-400"/>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Daily Volume</h3>
              {mockVolChart.length===0?(
                <div className="flex items-center justify-center h-40 text-gray-600 text-xs">No trading volume data yet.</div>
              ):(
              <ResponsiveContainer width="100%" height={220}><BarChart data={mockVolChart}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/><XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} tickLine={false}/><YAxis tick={{fill:'#6b7280',fontSize:10}} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/><Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8}} formatter={v=>[`$${v.toLocaleString()}`,'Volume']}/><Bar dataKey="volume" fill={NAVY} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
              )}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Recent Trades</h3>
              <table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Time','Token','Side','Qty','Price','Value','Status'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
              <tbody>{(trades.length?trades:Array.from({length:10},(_,i)=>{const sym=['ZWIB','HCPR','ACME','GDMR'][i%4];const side=i%3===0?'SELL':'BUY';const qty=Math.floor(100+Math.random()*2000);const price=(0.95+Math.random()*0.15).toFixed(4);return{token_symbol:sym,side,quantity:qty,price,total_usdc:(qty*price).toFixed(2),settled_at:new Date(Date.now()-i*180000).toISOString()}})).map((t,i)=>(
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-400">{ts(t.settled_at||t.matched_at||Date.now())}</td>
                  <td className="py-2 pr-4 font-medium">{t.token_symbol||t.symbol}</td>
                  <td className="py-2 pr-4"><span className={`text-xs font-bold ${(t.side||'BUY')==='BUY'?'text-green-400':'text-red-400'}`}>{t.side||'BUY'}</span></td>
                  <td className="py-2 pr-4">{(t.quantity||0).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono">${parseFloat(t.price||0).toFixed(4)}</td>
                  <td className="py-2 pr-4 text-yellow-400">${parseFloat(t.total_usdc||0).toLocaleString()}</td>
                  <td className="py-2"><span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">SETTLED</span></td>
                </tr>))}</tbody></table>
            </div>
          </div>
        )}

        {/* ══ COMPLIANCE ══ */}
        {tab==='compliance'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <KPI label="KYC Pending" value={pendingKYC} icon="⏳" color={pendingKYC>0?'text-amber-400':'text-white'}/>
              <KPI label="Approved This Month" value="38" icon="✅" color="text-green-400"/>
              <KPI label="Flagged Txns" value={flaggedTxns.length} icon="🚨" color={flaggedTxns.length>0?'text-red-400':'text-green-400'}/>
              <KPI label="FIU Reports Due" value="0" icon="📑"/>
            </div>
            {/* Entity KYC */}
            {entityKycList.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">🏢 Entity KYC — Issuer Verification</h3>
                  <span className="text-xs text-gray-500">{entityKycList.filter(k=>k.status==='PENDING').length} pending</span>
                </div>
                <div className="divide-y divide-gray-800">
                  {entityKycList.map(kyc => (
                    <div key={kyc.id} className="px-4 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm text-white">{kyc.entity_name}</p>
                          <p className="text-xs text-gray-500">{kyc.registration_number} · {kyc.registration_country} · {new Date(kyc.created_at).toLocaleDateString('en-GB')}</p>
                          <p className="text-xs text-gray-400 mt-1">{kyc.email} — {kyc.full_name}</p>
                          {kyc.documents && (() => {
                            try {
                              const raw = typeof kyc.documents === 'string' ? JSON.parse(kyc.documents) : kyc.documents;
                              // Normalise: object keyed by doc type → flat array
                              const docs = Array.isArray(raw)
                                ? raw
                                : Object.entries(raw || {}).map(([key, val]) =>
                                    typeof val === 'object' && val !== null
                                      ? { doc_type: key, ...val }
                                      : { doc_type: key, url: val }
                                  );
                              if (!docs || docs.length === 0) return (
                                <p className="text-xs text-gray-500 mt-2">No documents uploaded</p>
                              );
                              return (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-gray-400 font-semibold">📎 KYC Documents</p>
                                  {docs.map((doc, i) => {
                                    const href  = doc.url || doc.file_url || doc.path || null;
                                    const label = doc.name || doc.file_name || doc.doc_type || `Document ${i + 1}`;
                                    return href ? (
                                      <a key={i} href={href} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5 hover:bg-gray-700/50 text-xs">
                                        <span className="text-blue-400">📄</span>
                                        <span className="text-white flex-1 truncate">{label}</span>
                                        <span className="text-blue-400">↗</span>
                                      </a>
                                    ) : (
                                      <div key={i} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5 text-xs">
                                        <span className="text-gray-500">📄</span>
                                        <span className="text-gray-400 flex-1 truncate">{label}</span>
                                        <span className="text-gray-600 text-[10px]">no link</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } catch { return null; }
                          })()}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          kyc.status==='APPROVED' ? 'bg-green-900/40 text-green-300 border-green-700/50' :
                          kyc.status==='REJECTED' ? 'bg-red-900/40 text-red-300 border-red-700/50' :
                          'bg-yellow-900/40 text-yellow-300 border-yellow-700/50'
                        }`}>{kyc.status}</span>
                      </div>
                      {kyc.business_description && (
                        <p className="text-xs text-gray-400 mb-3">{kyc.business_description}</p>
                      )}
                      <button onClick={()=>setExpandedKyc(expandedKyc===kyc.id?null:kyc.id)}
                        className="text-xs text-blue-400 hover:text-blue-300 mb-2">
                        {expandedKyc===kyc.id ? '▲ Hide details' : '▼ View full KYC details'}
                      </button>
                      {expandedKyc===kyc.id && (
                        <div className="bg-gray-800/50 rounded-xl p-4 space-y-3 text-xs mb-3">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['Registration Country', kyc.registration_country],
                              ['Business Type',        kyc.business_type],
                              ['Date Incorporated',    kyc.date_incorporated ? new Date(kyc.date_incorporated).toLocaleDateString('en-GB') : '—'],
                              ['Tax Clearance',        kyc.tax_clearance_number || '—'],
                              ['Registered Address',   kyc.registered_address || '—'],
                              ['Source of Funds',      kyc.source_of_funds || '—'],
                            ].map(([label, value]) => (
                              <div key={label} className="bg-gray-900/60 rounded-lg p-2">
                                <p className="text-gray-500 mb-0.5">{label}</p>
                                <p className="text-white font-medium">{value}</p>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold mb-2">Compliance Declarations</p>
                            <div className="space-y-1">
                              {[
                                ['PEP Declaration',      kyc.pep_declaration],
                                ['Sanctions Clear',      kyc.sanctions_declaration],
                                ['AML/CFT Declaration',  kyc.aml_declaration],
                              ].map(([label, val]) => (
                                <div key={label} className="flex items-center gap-2">
                                  <span className={val ? 'text-green-400' : 'text-red-400'}>{val ? '✅' : '❌'}</span>
                                  <span className="text-gray-300">{label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {kyc.directors && (() => {
                            try {
                              const dirs = typeof kyc.directors === 'string' ? JSON.parse(kyc.directors) : kyc.directors;
                              if (!dirs || dirs.length === 0) return null;
                              return (
                                <div>
                                  <p className="text-gray-400 font-semibold mb-2">Directors ({dirs.length})</p>
                                  <div className="space-y-1">
                                    {dirs.map((d,i) => (
                                      <div key={i} className="bg-gray-900/60 rounded-lg p-2">
                                        <p className="text-white font-medium">{d.name} {d.pep && <span className="text-amber-400 ml-1">[PEP]</span>}</p>
                                        <p className="text-gray-500">{d.id_number} · {d.email}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            } catch { return null; }
                          })()}
                          {kyc.beneficial_owners && (() => {
                            try {
                              const owners = typeof kyc.beneficial_owners === 'string' ? JSON.parse(kyc.beneficial_owners) : kyc.beneficial_owners;
                              if (!owners || owners.length === 0) return null;
                              return (
                                <div>
                                  <p className="text-gray-400 font-semibold mb-2">Beneficial Owners ≥25%</p>
                                  <div className="space-y-1">
                                    {owners.map((o,i) => {
                                      const idDocUrl = o.kyc_doc_url || o.url || o.file_url || o.id_doc_url || o.id_doc || null;
                                      return (
                                        <div key={i} className="bg-gray-900/60 rounded-lg p-2">
                                          <p className="text-white font-medium">{o.name} — {o.ownership_pct}%</p>
                                          <p className="text-gray-500">{o.nationality} · {o.id_number}</p>
                                          {idDocUrl && (
                                            <a href={idDocUrl} target="_blank" rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[10px] mt-1">
                                              📄 ID Document ↗
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            } catch { return null; }
                          })()}
                        </div>
                      )}
                      {kyc.pep_declaration && <p className="text-xs text-amber-400 mb-1">⚠️ PEP declared</p>}
                      {kyc.status === 'PENDING' && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={async()=>{
                            const token = localStorage.getItem('token');
                            const res = await fetch(`${API}/entity-kyc/${kyc.id}/approve`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
                            const data = await res.json();
                            if(res.ok){
                              setEntityKycList(list => list.map(k => k.id===kyc.id?{...k,status:'APPROVED'}:k));
                              notify('success','✅ Entity KYC approved. Issuer notified.');
                            } else notify('error', data.error);
                          }} className="px-4 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white font-semibold">
                            ✅ Approve
                          </button>
                          <button onClick={async()=>{
                            const reason = window.prompt('Rejection reason (shown to issuer):');
                            if(!reason) return;
                            const token = localStorage.getItem('token');
                            const res = await fetch(`${API}/entity-kyc/${kyc.id}/reject`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason})});
                            const data = await res.json();
                            if(res.ok){
                              setEntityKycList(list => list.map(k => k.id===kyc.id?{...k,status:'REJECTED',rejection_reason:reason}:k));
                              notify('success','KYC rejected. Issuer notified.');
                            } else notify('error', data.error);
                          }} className="px-4 py-1.5 rounded-lg text-xs bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800/50">
                            ❌ Reject
                          </button>
                        </div>
                      )}
                      {kyc.status === 'REJECTED' && kyc.rejection_reason && (
                        <p className="text-xs text-red-400 mt-1">Reason: {kyc.rejection_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">KYC Review Queue <span className="text-xs text-amber-400 ml-2">{kycItems.length} pending</span></h3>
              {kycItems.length===0&&<p className="text-gray-500 text-sm text-center py-6">✅ No pending KYC applications</p>}
              <div className="space-y-3">
                {kycItems.map((k,i)=>{
                const tierColor = k.investor_tier==='INSTITUTION'?'bg-purple-900/50 text-purple-300':k.investor_tier==='CORPORATE'?'bg-blue-900/50 text-blue-300':'bg-gray-700/50 text-gray-300';
                const isExpanded = expandedKycInvestor === k.id;
                return (
                  <div key={i} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center text-sm font-bold flex-shrink-0">{(k.name||'?')[0]}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{k.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tierColor}`}>{k.investor_tier||'RETAIL'}</span>
                            {k.risk_profile && <span className="text-xs text-gray-500">{k.risk_profile}</span>}
                          </div>
                          <p className="text-gray-500 text-xs">{k.email} · {k.type}</p>
                          <p className="text-gray-600 text-xs">Submitted {dt(k.submitted)} · Docs: {k.docs}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${k.risk==='LOW'?'bg-green-900/50 text-green-300':k.risk==='MEDIUM'?'bg-amber-900/50 text-amber-300':'bg-red-900/50 text-red-300'}`}>{k.risk} RISK</span>
                        <button onClick={()=>handleKYC(k.id,'review')} className="text-xs text-blue-400 hover:text-blue-300">{isExpanded?'▲ Hide':'▼ Details'}</button>
                        <button onClick={()=>handleKYC(k.id,'approve')} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg">✅ Approve</button>
                        <button onClick={()=>handleKYC(k.id,'reject')} className="bg-red-900/50 hover:bg-red-900 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-800">❌ Reject</button>
                      </div>
                    </div>
                    {/* Expanded KYC detail view — all tiers */}
                    {isExpanded&&(
                      <div className="bg-gray-900/60 rounded-xl p-4 space-y-4 text-xs">
                        {/* Personal details */}
                        <div>
                          <p className="text-gray-400 font-semibold mb-2">Personal Details</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[['Full Name',k.name],['Nationality',k.nationality],['Date of Birth',k.date_of_birth?dt(k.date_of_birth):null],['ID Type',k.type],['ID Number',k.id_number],['City',k.city],['Country',k.country],['Email',k.email],['Wallet',k.wallet]].map(([l,v])=>(
                              <div key={l} className="bg-gray-800/60 rounded-lg p-2"><p className="text-gray-500">{l}</p><p className="text-white font-medium break-all">{v||'—'}</p></div>
                            ))}
                          </div>
                          {k.risk_profile&&<div className="mt-2 bg-gray-800/60 rounded-lg p-2"><p className="text-gray-500">Risk Profile</p><p className="text-white font-medium">{k.risk_profile} — <span className={k.risk==='HIGH'?'text-red-400':k.risk==='MEDIUM'?'text-amber-400':'text-green-400'}>{k.risk} RISK</span></p></div>}
                        </div>
                        {/* Uploaded documents */}
                        {k.documents.length>0&&(
                          <div>
                            <p className="text-gray-400 font-semibold mb-2">Uploaded Documents ({k.documents.length})</p>
                            <div className="space-y-1">
                              {k.documents.map((doc,di)=>(
                                <div key={di} className="flex items-center justify-between bg-gray-800/60 rounded-lg p-2">
                                  <div><p className="text-white font-medium capitalize">{(doc.doc_type||'document').replace(/_/g,' ')}</p><p className="text-gray-500">{doc.file_name||'—'}{doc.file_size?` · ${Math.round(doc.file_size/1024)}KB`:''}</p></div>
                                  {doc.file_url&&<a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-3 flex-shrink-0">View ↗</a>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Tier 2: Corporate details */}
                        {k.investor_tier==='CORPORATE'&&(()=>{
                          const cd=typeof k.corporate_details==='string'?JSON.parse(k.corporate_details||'{}'):(k.corporate_details||{});
                          return(
                            <div className="space-y-3">
                              <p className="text-gray-400 font-semibold">Corporate Details</p>
                              <div className="grid grid-cols-2 gap-2">
                                {[['Company',cd.companyName],['Reg. Number',cd.registrationNumber],['Country',cd.countryOfRegistration],['Business Type',cd.businessType],['Source of Funds',cd.sourceOfFunds]].map(([l,v])=>(
                                  <div key={l} className="bg-gray-800/60 rounded-lg p-2"><p className="text-gray-500">{l}</p><p className="text-white font-medium">{v||'—'}</p></div>
                                ))}
                              </div>
                              {Array.isArray(cd.directors)&&cd.directors.length>0&&(
                                <div><p className="text-gray-400 font-semibold mb-2">Directors ({cd.directors.length})</p>
                                  <div className="space-y-1">{cd.directors.map((d,di)=><div key={di} className="bg-gray-800/60 rounded-lg p-2"><p className="text-white font-medium">{d.name}</p><p className="text-gray-500">{d.idNumber}{d.email&&` · ${d.email}`}</p></div>)}</div>
                                </div>
                              )}
                              {Array.isArray(cd.beneficialOwners)&&cd.beneficialOwners.length>0&&(
                                <div><p className="text-gray-400 font-semibold mb-2">Beneficial Owners ≥10%</p>
                                  <div className="space-y-1">{cd.beneficialOwners.map((b,bi)=><div key={bi} className="bg-gray-800/60 rounded-lg p-2"><p className="text-white font-medium">{b.name} — {b.ownershipPct}%</p><p className="text-gray-500">{b.nationality}</p></div>)}</div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Tier 3: Institutional details */}
                        {k.investor_tier==='INSTITUTION'&&(()=>{
                          const id=typeof k.institutional_details==='string'?JSON.parse(k.institutional_details||'{}'):(k.institutional_details||{});
                          return(
                            <div className="space-y-3">
                              <p className="text-gray-400 font-semibold">Institutional Details</p>
                              <div className="grid grid-cols-2 gap-2">
                                {[['Institution',id.institutionName],['Type',id.institutionType],['Reg. Number',id.registrationNumber],['Country',id.countryOfRegistration],['AUM (USD)',id.aumUsd?`$${parseFloat(id.aumUsd).toLocaleString()}`:'—'],['Source of Funds',id.sourceOfFunds]].map(([l,v])=>(
                                  <div key={l} className="bg-gray-800/60 rounded-lg p-2"><p className="text-gray-500">{l}</p><p className="text-white font-medium">{v||'—'}</p></div>
                                ))}
                              </div>
                              <div className="flex gap-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${id.ipecRegistered?'bg-green-900/50 text-green-300':'bg-gray-700/50 text-gray-500'}`}>{id.ipecRegistered?'✅':'—'} IPEC</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${id.seczRegistered?'bg-green-900/50 text-green-300':'bg-gray-700/50 text-gray-500'}`}>{id.seczRegistered?'✅':'—'} SECZ</span>
                                {id.otherRegulator&&<span className="text-xs text-gray-400">{id.otherRegulator}</span>}
                              </div>
                              {id.mandateScope&&<div className="bg-gray-800/60 rounded-lg p-2"><p className="text-gray-500 mb-1">Mandate Scope</p><p className="text-gray-300">{id.mandateScope}</p></div>}
                              {k.investment_mandate_url&&(
                                <a href={k.investment_mandate_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-2 text-blue-300 hover:bg-blue-900/50">
                                  📋 Investment Mandate Document ↗
                                </a>
                              )}
                            </div>
                          );
                        })()}
                        {/* Approve / Reject inline */}
                        <div className="flex gap-2 pt-2 border-t border-gray-700/50">
                          <button onClick={()=>handleKYC(k.id,'approve')} className="flex-1 py-2 rounded-lg text-xs font-bold bg-green-700 hover:bg-green-600 text-white">✅ Approve KYC</button>
                          <button onClick={()=>handleKYC(k.id,'reject')} className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-900/50 hover:bg-red-900 text-red-300 border border-red-800">❌ Reject KYC</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
            {/* Recently Approved KYC */}
            {approvedKycItems.length>0&&(
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4 text-green-400">✅ Recently Approved KYC <span className="text-xs text-gray-500 ml-2">({approvedKycItems.length})</span></h3>
                <div className="space-y-2">
                  {approvedKycItems.slice(0,10).map((k,i)=>(
                    <div key={i} className="flex items-center justify-between bg-gray-800/30 rounded-xl px-4 py-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-green-900 flex items-center justify-center text-xs font-bold">{(k.full_name||k.name||'?')[0]}</div>
                        <div>
                          <p className="font-medium text-white">{k.full_name||k.name||'—'}</p>
                          <p className="text-gray-500">{k.email||'—'} · <span className={`font-semibold ${k.investor_tier==='INSTITUTION'?'text-purple-300':k.investor_tier==='CORPORATE'?'text-blue-300':'text-gray-300'}`}>{k.investor_tier||'RETAIL'}</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">APPROVED</p>
                        <p className="text-gray-500">{k.reviewed_at?dt(k.reviewed_at):'—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Flagged Transactions</h3>
              {flaggedTxns.length===0&&<p className="text-gray-500 text-sm text-center py-6">✅ No active compliance flags</p>}
              {flaggedTxns.map(f=>(
                <div key={f.id} className="bg-red-900/20 border border-red-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-red-300 font-medium text-sm">{f.title}</p>
                      <p className="text-gray-500 text-xs mt-1">{f.desc}</p>
                      <p className="text-gray-600 text-xs mt-0.5">Detected: {f.time} · {f.system}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={()=>handleFlag(f.id,'investigate')} className="text-xs bg-amber-800 hover:bg-amber-700 text-amber-200 px-3 py-1.5 rounded-lg">🔍 Investigate</button>
                      <button onClick={()=>handleFlag(f.id,'suspend')} className="text-xs bg-red-800 hover:bg-red-700 text-red-200 px-3 py-1.5 rounded-lg">🚫 Suspend Wallet</button>
                      <button onClick={()=>handleFlag(f.id,'dismiss')} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg">Dismiss</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ USERS ══ */}
        {tab==='users'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              {[{label:'Total',value:users.length||9,icon:'👥'},{label:'Investors',value:users.filter?.(u=>u.role==='INVESTOR').length||4,icon:'💼'},{label:'Issuers',value:users.filter?.(u=>u.role==='ISSUER').length||2,icon:'🏢'},{label:'Auditors',value:users.filter?.(u=>u.role==='AUDITOR').length||1,icon:'🔍'},{label:'Partners',value:users.filter?.(u=>u.role==='PARTNER').length||1,icon:'🤝'}].map((k,i)=><KPI key={i} {...k}/>)}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">User Directory</h3>
              <table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Wallet','Email','Role','KYC','Joined','Actions'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}</tr></thead>
              <tbody>{(users.length?users:[{id:1,wallet_address:'0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',email:'admin@tokenequityx.co.zw',role:'ADMIN',kyc_status:'APPROVED',created_at:'2026-01-15'},{id:2,wallet_address:'0xce1ebe789e0067f08222e5cd0456a02c7a7c8e90',email:'admin2@tokenequityx.co.zw',role:'ADMIN',kyc_status:'APPROVED',created_at:'2026-01-15'},{id:3,wallet_address:'0x70997970c51812dc3a010c7d01b50e0d17dc79c8',email:'issuer@test.com',role:'ISSUER',kyc_status:'APPROVED',created_at:'2026-02-01'},{id:6,wallet_address:'0x90f79bf6eb2c4f870365e785982e1f101e93b906',email:'investor@test.com',role:'INVESTOR',kyc_status:'PENDING',created_at:'2026-02-20'},{id:7,wallet_address:'0x976ea74026e726554db657fa54763abd0c3a0aa9',email:'auditor@test.com',role:'AUDITOR',kyc_status:'APPROVED',created_at:'2026-02-10'}]).map((u,i)=>(
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 pr-4 font-mono text-xs text-gray-300">{(u.wallet_address||u.wallet||'—').slice(0,14)}…</td>
                  <td className="py-3 pr-4 text-xs text-gray-300">{u.email||'—'}</td>
                  <td className="py-3 pr-4"><span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{u.role}</span></td>
                  <td className="py-3 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full ${u.kyc_status==='APPROVED'?'bg-green-900/50 text-green-300':'bg-amber-900/50 text-amber-300'}`}>{u.kyc_status}</span></td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">{u.created_at?dt(u.created_at):'-'}</td>
                  <td className="py-3">
                    <button onClick={()=>{setSelectedUser(u);setUserModalRole(u.role);}} className="text-xs text-blue-400 hover:text-blue-300 mr-2">View</button>
                    <button onClick={async()=>{
                      const isSuspended = u.account_status === 'SUSPENDED';
                      if (!isSuspended && !window.confirm(`Suspend ${u.email}?\n\nThis will prevent them from logging in or trading.`)) return;
                      const token = localStorage.getItem('token');
                      const res = await fetch(`${API}/admin/users/${u.id}/suspend`, {
                        method:'PUT',
                        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
                        body:JSON.stringify({suspended:!isSuspended})
                      });
                      if (res.ok) {
                        notify(isSuspended?'success':'warning', isSuspended?`✅ ${u.email} unsuspended.`:`⚠️ ${u.email} suspended.`);
                        fetchUsers();
                      } else {
                        notify('error', 'Failed to update user status.');
                      }
                    }}
                      className={`text-xs ${u.account_status==='SUSPENDED'?'text-green-400 hover:text-green-300':'text-red-400 hover:text-red-300'}`}>
                      {u.account_status==='SUSPENDED'?'Unsuspend':'Suspend'}
                    </button>
                  </td>
                </tr>))}</tbody></table>
            </div>
          </div>
        )}

        {/* ══ WALLET ══ */}
        {tab==='wallet'&&(
          <div className="space-y-6">

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Pending Deposits"    value={pendingDeposits}    sub="awaiting confirmation" icon="💰" color={pendingDeposits>0?'text-amber-400':'text-white'}/>
              <KPI label="Pending Withdrawals" value={pendingWithdrawals} sub="awaiting processing"   icon="🏦" color={pendingWithdrawals>0?'text-amber-400':'text-white'}/>
              <KPI label="Total Deposits"      value={deposits.length}    sub="all time"              icon="📥"/>
              <KPI label="Total Withdrawals"   value={withdrawals.length} sub="all time"              icon="📤"/>
            </div>

            {walletMsg&&<div className={`rounded-xl p-4 border text-sm ${walletMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':'bg-red-900/40 border-red-700 text-red-300'}`}>{walletMsg.text}</div>}

            {/* Treasury reconciliation panel */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">🏛️ Treasury Position</h3>
                <button onClick={async()=>{
                  const token=localStorage.getItem('token');
                  const res=await fetch(`${API}/wallet/admin/treasury`,{headers:{Authorization:`Bearer ${token}`}});
                  const d=await res.json();
                  if(d.investor_balances) setActionMsg({type:'info',text:`Total investor USD: $${d.investor_balances.total_usd.toFixed(2)} | Fees collected: $${d.fees_collected_usd.toFixed(2)} | Pending deposits: $${d.pending.deposits.total.toFixed(2)} | Pending withdrawals: $${d.pending.withdrawals.total.toFixed(2)}`});
                }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white">Refresh</button>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                The total investor USD balance shown here must match the actual Stanbic custodial account balance at all times.
                Any discrepancy indicates an unreconciled transaction. Reconcile daily before processing withdrawals.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* ── DEPOSITS */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">💰 Deposit Requests</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pendingDeposits>0?'bg-amber-900/50 text-amber-300':'bg-green-900/50 text-green-300'}`}>{pendingDeposits} pending</span>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Before confirming, verify the matching credit appears in the Stanbic corporate banking portal with the exact reference number shown below.
                </p>
                {deposits.length===0&&<p className="text-gray-500 text-sm text-center py-6">No deposit requests yet.</p>}
                <div className="space-y-3">
                  {deposits.map((d,i)=>(
                    <div key={i} className={`rounded-xl p-4 border ${d.status==='PENDING'?'bg-amber-900/10 border-amber-800/40':d.status==='CONFIRMED'?'bg-green-900/10 border-green-800/40':'bg-red-900/10 border-red-800/40'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{d.full_name||d.email}</p>
                          <p className="text-gray-400 text-xs">{d.email}</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs">Bank Ref:</span>
                              <span className="font-mono text-white text-sm font-bold bg-gray-800 px-2 py-0.5 rounded">{d.reference}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs">Submitted:</span>
                              <span className="text-xs text-gray-300">{new Date(d.created_at).toLocaleString('en-GB')}</span>
                            </div>
                            {d.notes&&<div className="flex items-start gap-2"><span className="text-gray-500 text-xs">Notes:</span><span className="text-xs text-gray-300">{d.notes}</span></div>}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold text-green-400">${parseFloat(d.amount_usd).toFixed(2)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${d.status==='PENDING'?'bg-amber-900/50 text-amber-300':d.status==='CONFIRMED'?'bg-green-900/50 text-green-300':'bg-red-900/50 text-red-300'}`}>{d.status}</span>
                        </div>
                      </div>
                      {d.status==='PENDING'&&(
                        <div className="space-y-2">
                          <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2 text-xs text-blue-300">
                            ℹ️ Check Stanbic portal for credit with reference <span className="font-mono font-bold">{d.reference}</span> — amount ${parseFloat(d.amount_usd).toFixed(2)}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={async()=>{
                              setWalletLoading(true);setWalletMsg(null);
                              const token=localStorage.getItem('token');
                              const res=await fetch(`${API}/wallet/deposit/${d.id}/confirm`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({})});
                              const data=await res.json();
                              setWalletMsg(res.ok?{type:'success',text:data.message||`✅ Deposit confirmed for ${d.email}`}:{type:'error',text:data.error||'Failed'});
                              setWalletLoading(false);loadAll();
                            }} disabled={walletLoading} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-green-700 hover:bg-green-600 disabled:opacity-40">
                              ✓ Confirm — Credit Verified on Stanbic
                            </button>
                            <button onClick={async()=>{
                              const reason=window.prompt('Reason for rejection (shown to investor):');
                              if(reason===null)return;
                              setWalletLoading(true);setWalletMsg(null);
                              const token=localStorage.getItem('token');
                              await fetch(`${API}/wallet/deposit/${d.id}/reject`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason})});
                              setWalletMsg({type:'error',text:`Deposit rejected for ${d.email}. Investor notified by email.`});
                              setWalletLoading(false);loadAll();
                            }} disabled={walletLoading} className="px-4 py-2 rounded-lg text-xs font-bold text-red-400 bg-red-900/30 hover:bg-red-900/50 border border-red-800 disabled:opacity-40">
                              ✗ Reject
                            </button>
                          </div>
                        </div>
                      )}
                      {d.status==='CONFIRMED'&&d.confirmed_at&&(
                        <p className="text-xs text-green-400 mt-1">✓ Confirmed {new Date(d.confirmed_at).toLocaleString('en-GB')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── WITHDRAWALS */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">🏦 Withdrawal Requests</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pendingWithdrawals>0?'bg-amber-900/50 text-amber-300':'bg-green-900/50 text-green-300'}`}>{pendingWithdrawals} pending</span>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Initiate the EFT/RTGS from the Stanbic custodial account first, then enter the bank reference number and mark as complete.
                </p>
                {withdrawals.length===0&&<p className="text-gray-500 text-sm text-center py-6">No withdrawal requests yet.</p>}
                <div className="space-y-3">
                  {withdrawals.map((w,i)=>(
                    <div key={i} className={`rounded-xl p-4 border ${w.status==='PENDING'?'bg-amber-900/10 border-amber-800/40':w.status==='COMPLETED'?'bg-green-900/10 border-green-800/40':'bg-red-900/10 border-red-800/40'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{w.full_name||w.email}</p>
                          <p className="text-gray-400 text-xs">{w.email}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            <div className="flex gap-2"><span className="text-gray-500">Bank:</span><span className="text-white font-semibold">{w.bank_name}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500">Account Name:</span><span className="text-white">{w.account_name}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500">Account No:</span><span className="font-mono text-white font-bold">{w.account_number}</span></div>
                            {w.branch_code&&<div className="flex gap-2"><span className="text-gray-500">Branch:</span><span className="text-white">{w.branch_code}</span></div>}
                            <div className="flex gap-2"><span className="text-gray-500">Requested:</span><span className="text-gray-300">{new Date(w.created_at).toLocaleString('en-GB')}</span></div>
                            {w.tx_reference&&<div className="flex gap-2"><span className="text-gray-500">Bank Ref:</span><span className="font-mono text-green-400">{w.tx_reference}</span></div>}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold text-amber-400">${parseFloat(w.amount_usd).toFixed(2)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${w.status==='PENDING'?'bg-amber-900/50 text-amber-300':w.status==='COMPLETED'?'bg-green-900/50 text-green-300':'bg-red-900/50 text-red-300'}`}>{w.status}</span>
                        </div>
                      </div>
                      {w.status==='PENDING'&&(
                        <div className="space-y-2">
                          <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2 text-xs text-amber-300">
                            ⚠️ Initiate EFT/RTGS of ${parseFloat(w.amount_usd).toFixed(2)} to {w.bank_name} account <span className="font-mono font-bold">{w.account_number}</span> ({w.account_name}) from the Stanbic custodial account first, then enter the reference below.
                          </div>
                          <div className="flex gap-2">
                            <button onClick={async()=>{
                              const ref=window.prompt(`Enter Stanbic bank transfer reference number for $${w.amount_usd} to ${w.account_name}:`);
                              if(!ref)return;
                              setWalletLoading(true);setWalletMsg(null);
                              const token=localStorage.getItem('token');
                              const res=await fetch(`${API}/wallet/withdraw/${w.id}/complete`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({tx_reference:ref})});
                              const data=await res.json();
                              setWalletMsg(res.ok?{type:'success',text:data.message||`✅ Withdrawal completed for ${w.email}`}:{type:'error',text:data.error||'Failed'});
                              setWalletLoading(false);loadAll();
                            }} disabled={walletLoading} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40">
                              ✓ Mark Complete — Enter Bank Reference
                            </button>
                            <button onClick={async()=>{
                              const reason=window.prompt('Reason for rejection:');
                              if(reason===null)return;
                              setWalletLoading(true);setWalletMsg(null);
                              const token=localStorage.getItem('token');
                              await fetch(`${API}/wallet/withdraw/${w.id}/reject`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason})});
                              setWalletMsg({type:'info',text:`Withdrawal rejected. Reserved funds returned to ${w.full_name}.`});
                              setWalletLoading(false);loadAll();
                            }} disabled={walletLoading} className="px-4 py-2 rounded-lg text-xs font-bold text-red-400 bg-red-900/30 hover:bg-red-900/50 border border-red-800 disabled:opacity-40">
                              ✗ Reject
                            </button>
                          </div>
                        </div>
                      )}
                      {w.status==='COMPLETED'&&w.processed_at&&(
                        <p className="text-xs text-green-400 mt-1">✓ Completed {new Date(w.processed_at).toLocaleString('en-GB')} · Ref: {w.tx_reference}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TOOLS ══ */}
        {tab==='tools'&&(
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold">Acquisition & Outreach Tools</h2><p className="text-gray-500 text-sm mt-1">Recruit issuers and investors, and manage internal staff accounts.</p></div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-1">👤 Create Staff Account</h3>
              <p className="text-gray-500 text-xs mb-4">Create accounts for auditors, DFI partners, compliance officers and additional admins.</p>
              {staffMsg && <div className={`mb-4 p-3 rounded-xl text-sm border ${staffMsg.type==='success'?'bg-green-900/30 border-green-700 text-green-300':'bg-red-900/30 border-red-700 text-red-300'}`}>{staffMsg.text}</div>}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[{label:'Full Name',key:'full_name',type:'text',placeholder:'e.g. James Sibanda'},{label:'Email Address',key:'email',type:'email',placeholder:'e.g. jsibanda@tokenequityx.co.zw'},{label:'Temporary Password',key:'password',type:'password',placeholder:'Min 8 characters'}].map(({label,key,type,placeholder})=>(
                  <div key={key}><label className="text-xs text-gray-400 block mb-1">{label}</label><input type={type} placeholder={placeholder} value={staffForm[key]} onChange={e=>setStaffForm(f=>({...f,[key]:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/></div>
                ))}
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{value:'AUDITOR',label:'🔍 Auditor',desc:'Reviews submissions and sets oracle prices'},{value:'DFI',label:'📡 DFI Partner',desc:'Access to DeFi data portal'},{value:'COMPLIANCE_OFFICER',label:'🛡 Compliance',desc:'KYC review and compliance monitoring'},{value:'ADMIN',label:'⚙️ Admin',desc:'Full platform administration access'}].map(opt=>(
                      <div key={opt.value} onClick={()=>setStaffForm(f=>({...f,role:opt.value}))} className={`cursor-pointer rounded-xl p-3 border transition-all ${staffForm.role===opt.value?'border-blue-500 bg-blue-900/20':'border-gray-700 bg-gray-800/30 hover:border-gray-500'}`}>
                        <p className="text-xs font-bold">{opt.label}</p><p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={createStaff} disabled={staffLoading} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{background:NAVY}}>{staffLoading?'⏳ Creating…':'✓ Create Account'}</button>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-1">🏢 Invite an Issuer</h3>
                <p className="text-gray-500 text-xs mb-4">Send a direct invitation to a company to list their asset.</p>
                <div className="space-y-3">{[{l:'Company Name',p:'e.g. Bindura Nickel Corporation'},{l:'Contact Person',p:'e.g. John Moyo — CFO'},{l:'Email Address',p:'jmoyo@bnc.co.zw'},{l:'Asset Type',p:'e.g. Mining Equity, REIT, Bond'}].map(({l,p},i)=><div key={i}><label className="text-xs text-gray-400 block mb-1">{l}</label><input placeholder={p} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/></div>)}</div>
                <button onClick={()=>notify('success','Invitation sent!')} className="w-full mt-4 py-3 rounded-xl font-semibold text-white text-sm" style={{background:NAVY}}>📧 Send Issuer Invitation</button>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-1">💼 Invite an Investor</h3>
                <p className="text-gray-500 text-xs mb-4">Directly onboard an institutional or accredited investor.</p>
                <div className="space-y-3">{[{l:'Full Name / Entity',p:'e.g. Old Mutual Zimbabwe'},{l:'Contact Person',p:'e.g. R. Mupfupi — Portfolio Manager'},{l:'Email Address',p:'rmupfupi@oldmutual.co.zw'},{l:'Investor Type',p:'e.g. Institutional, Family Office, Accredited'}].map(({l,p},i)=><div key={i}><label className="text-xs text-gray-400 block mb-1">{l}</label><input placeholder={p} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/></div>)}</div>
                <button onClick={()=>notify('success','Invitation sent!')} className="w-full mt-4 py-3 rounded-xl font-semibold text-white text-sm" style={{background:GREEN}}>📧 Send Investor Invitation</button>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">Platform Referral Links</h3>
              <div className="space-y-3">{[{label:'Investor Onboarding',url:'https://tokenequityx.co.zw/ref/ADMIN/invest',clicks:248,signups:42},{label:'Issuer Application',url:'https://tokenequityx.co.zw/ref/ADMIN/issue',clicks:87,signups:11},{label:'Platform Overview',url:'https://tokenequityx.co.zw/ref/ADMIN/about',clicks:512,signups:68}].map((l,i)=>(
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2"><p className="font-medium text-sm">{l.label}</p><div className="flex gap-3 text-xs text-gray-500"><span>{l.clicks} clicks</span><span className="text-green-400">{l.signups} sign-ups</span></div></div>
                  <div className="flex items-center gap-2"><code className="flex-1 bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">{l.url}</code><button onClick={()=>{navigator.clipboard?.writeText(l.url).catch(()=>{});notify('success','Copied!');}} className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white">Copy</button></div>
                </div>
              ))}</div>
            </div>
          </div>
        )}

        {/* ══ LEDGER ══ */}
        {tab==='ledger' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Platform Transaction Ledger</h2>
              <p className="text-gray-500 text-sm mt-0.5">Complete audit trail of all wallet movements across the platform.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex gap-1 flex-wrap">
                {['ALL','DEPOSIT','WITHDRAWAL','TRADE_BUY','TRADE_SELL','FEE','DIVIDEND','REFUND','ADJUSTMENT'].map(f=>(
                  <button key={f} onClick={()=>{ setTxFilter(f); setTxPage(1); loadTxHistory(f,1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${txFilter===f?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {f==='ALL'?'All Types':f.replace('_',' ')}
                  </button>
                ))}
              </div>
              <button onClick={()=>loadTxHistory(txFilter, txPage)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white ml-auto">
                🔄 Refresh
              </button>
            </div>

            {/* Load data button if empty */}
            {txHistory.length === 0 && !txLoading && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">📒</p>
                <p className="font-semibold mb-2">Transaction Ledger</p>
                <p className="text-gray-500 text-sm mb-4">Click Load to fetch the latest transactions.</p>
                <button onClick={()=>loadTxHistory('ALL',1)}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600">
                  Load Transactions
                </button>
              </div>
            )}

            {txLoading && <div className="text-center py-8 text-gray-500 text-sm">⏳ Loading…</div>}

            {/* Transaction table */}
            {txHistory.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-800/50">
                        {['Date','User','Type','Amount','Before','After','Description'].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txHistory.map((tx,i)=>{
                        const isCredit = parseFloat(tx.amount_usd) > 0;
                        const typeColors = {
                          DEPOSIT:    'bg-green-900/50 text-green-300',
                          WITHDRAWAL: 'bg-red-900/50 text-red-300',
                          TRADE_BUY:  'bg-blue-900/50 text-blue-300',
                          TRADE_SELL: 'bg-purple-900/50 text-purple-300',
                          FEE:        'bg-amber-900/50 text-amber-300',
                          DIVIDEND:   'bg-teal-900/50 text-teal-300',
                          REFUND:     'bg-green-900/50 text-green-300',
                          ADJUSTMENT: 'bg-gray-700 text-gray-300',
                        };
                        return (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {new Date(tx.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium">{tx.full_name||'—'}</p>
                              <p className="text-xs text-gray-500">{tx.email||''}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeColors[tx.type]||'bg-gray-700 text-gray-300'}`}>
                                {tx.type?.replace('_',' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold">
                              <span className={isCredit?'text-green-400':'text-red-400'}>
                                {isCredit?'+':''}{parseFloat(tx.amount_usd).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-400">
                              ${parseFloat(tx.balance_before||0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-300 font-semibold">
                              ${parseFloat(tx.balance_after||0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                              {tx.description||'—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Showing {txHistory.length} records · Page {txPage}</p>
                  <div className="flex gap-2">
                    <button onClick={()=>{ const p=Math.max(1,txPage-1); setTxPage(p); loadTxHistory(txFilter,p); }}
                      disabled={txPage===1}
                      className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40">← Prev</button>
                    <button onClick={()=>{ const p=txPage+1; setTxPage(p); loadTxHistory(txFilter,p); }}
                      disabled={txHistory.length < TX_PAGE_SIZE}
                      className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40">Next →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ OFFERINGS ══ */}
        {tab==='offerings' && (
          <AdminOfferingsTab NAVY={NAVY} GOLD={GOLD} GREEN={GREEN} RED={RED} notify={notify} />
        )}

        {/* ══ BLOG ══ */}
        {tab==='blog' && <AdminBlogTab />}

        {/* ══ SETTINGS ══ */}
        {tab==='settings' && (
          <div className="space-y-6">
            {/* Settings Sub-Tab Bar */}
            <div className="flex gap-2 border-b border-slate-700 pb-2 mb-4">
              {[
                { key: 'overview',   label: 'Overview' },
                { key: 'tax',        label: 'Tax & Fees' },
                { key: 'banking',    label: 'Banking' },
                { key: 'tiers',      label: 'Investor Tiers' },
                { key: 'operations', label: 'Operations' },
                ...(JSON.parse(localStorage.getItem('user')||'{}')?.role === 'SUPER_ADMIN' ? [{ key: 'superadmin', label: 'Super Admin' }] : []),
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={activeTab === t.key
                    ? 'px-4 py-2 bg-yellow-500 text-slate-900 rounded-t font-medium'
                    : 'px-4 py-2 text-slate-400 hover:text-white cursor-pointer'}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Overview tab ── */}
            {activeTab === 'overview' && <div className="bg-slate-800 rounded-b p-6">
            {/* Banking Partner Portal Link */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏦</span>
                <div>
                  <h3 className="font-bold text-sm">Banking Partner Portal</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Settlement instructions, disbursements, WHT batches and reconciliation for the banking partner.</p>
                </div>
              </div>
              <a href="/banking-partner" target="_blank" rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
                style={{background:'#1A3C5E'}}>
                Open Portal →
              </a>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { key: 'applications_meeting_day', label: 'Application Review Day',       type: 'text',   desc: 'Day of week when applications are reviewed (e.g. Tuesday).' },
                  { key: 'platform_fee_bps',         label: 'Trading Fee (basis points)',   type: 'number', desc: 'Platform trading fee in basis points (e.g. 50 = 0.50%).' },
                  { key: 'min_investment_usd',        label: 'Minimum Investment (USD)',     type: 'number', desc: 'Minimum investor subscription amount in USD.' },
                  { key: 'kyc_expiry_days',           label: 'KYC Expiry (days)',            type: 'number', desc: 'Number of days before KYC approval expires and must be renewed.' },
                  { key: 'max_offering_days',         label: 'Max Offering Duration (days)', type: 'number', desc: 'Maximum number of days a primary offering can remain open.' },
                  { key: 'tier1_min_investment_usd',         label: 'Min Investment — Tier 1 Retail (USD)',       type: 'number', desc: 'Minimum subscription amount for retail investors.' },
                  { key: 'tier2_min_investment_usd',         label: 'Min Investment — Tier 2 Corporate (USD)',    type: 'number', desc: 'Minimum subscription amount for corporate investors.' },
                  { key: 'tier3_min_investment_usd',         label: 'Min Investment — Tier 3 Institution (USD)',  type: 'number', desc: 'Minimum subscription amount for institutional investors.' },
                  { key: 'premium_trial_end_date',           label: 'Premium Trial End Date',                     type: 'date',   desc: 'All investors get full premium dashboard until this date. After this, individual 30-day trials apply.' },
                  { key: 'premium_trial_days_new_investors', label: 'New Investor Trial Period (days)',            type: 'number', desc: 'Number of days a new investor gets full premium access from their registration date.' },
                ].map(({ key, label, type, desc }) => {
                  const current = settings[key]?.value ?? '';
                  return (
                    <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <label className="text-sm font-semibold text-white block mb-0.5">{label}</label>
                      <p className="text-xs text-gray-500 mb-3">{desc}</p>
                      <div className="flex gap-2">
                        <input
                          type={type}
                          value={settings[key]?.value ?? ''}
                          onChange={e => setSettings(s => ({ ...s, [key]: { ...(s[key]||{}), value: e.target.value } }))}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                        />
                        <button
                          onClick={() => handleSaveSetting(key, settings[key]?.value ?? '')}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 whitespace-nowrap">
                          Save
                        </button>
                      </div>
                      {settings[key]?.updated_at && (
                        <p className="text-xs text-gray-600 mt-2">Last updated: {dt(settings[key].updated_at)}</p>
                      )}
                    </div>
                  );
                })}
              </div>

            {/* Applications with fee status */}
            <div>
              <h3 className="text-lg font-bold mb-3">Application Fee Status</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                      {['Token','Entity','App Status','Fee Status','Compliance Fee','Auditor Fee','Total','Assigned Auditor'].map(h=>(
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.filter(p => p.isNewApplication).map(item => (
                      <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-bold text-blue-300">{item.symbol}</td>
                        <td className="px-4 py-3 text-gray-300">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.application_status === 'APPROVED' ? 'bg-blue-900/50 text-blue-300' :
                            item.application_status === 'FEE_CONFIRMED' ? 'bg-green-900/50 text-green-300' :
                            item.application_status === 'REJECTED' ? 'bg-red-900/50 text-red-300' :
                            'bg-gray-800 text-gray-400'
                          }`}>{item.application_status || 'PENDING'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.fee_status === 'PAID' ? 'bg-green-900/50 text-green-300' :
                            item.fee_status === 'PENDING_PAYMENT' ? 'bg-amber-900/50 text-amber-300' :
                            'bg-gray-800 text-gray-400'
                          }`}>{item.fee_status || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">$1,500</td>
                        <td className="px-4 py-3 text-gray-300">{item.auditor_fee_usd ? `$${item.auditor_fee_usd}` : '—'}</td>
                        <td className="px-4 py-3 text-yellow-400 font-semibold">{item.auditor_fee_usd ? `$${1500+parseFloat(item.auditor_fee_usd)}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{item.assigned_auditor || '—'}</td>
                      </tr>
                    ))}
                    {pipeline.filter(p => p.isNewApplication).length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No applications yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          {/* SUPER ADMIN PANEL */}
          {isSuperAdmin && (
            <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-6 space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <h3 className="font-bold text-red-300">Super Admin — Sensitive Settings</h3>
                  <p className="text-xs text-gray-500">OTP required. All changes are audit-logged.</p>
                </div>
              </div>
              {!otpVerified ? (
                <div className="space-y-3">
                  {!otpSent ? (
                    <button onClick={async()=>{
                      const t=localStorage.getItem('token');
                      const r=await fetch(`${API}/super-admin/request-otp`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}});
                      const d=await r.json();
                      if(r.ok){setOtpSent(true);notify('success',d.message);}else notify('error',d.error);
                    }} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-900/40 text-red-300 border border-red-800/50 hover:bg-red-900/60">
                      📧 Send OTP to My Email
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <input value={otpCode} onChange={e=>setOtpCode(e.target.value)} maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-48 font-mono tracking-widest"/>
                      <button onClick={async()=>{
                        const t=localStorage.getItem('token');
                        const r=await fetch(`${API}/super-admin/verify-otp`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({code:otpCode})});
                        const d=await r.json();
                        if(r.ok){setOtpVerified(true);notify('success','OTP verified.');}else notify('error',d.error);
                      }} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-green-700 hover:bg-green-600 text-white">
                        ✅ Verify
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-green-300 bg-green-900/20 border border-green-700/40 rounded-lg px-3 py-2">✅ OTP verified — sensitive settings unlocked</div>
                  {[
                    {key:'usdc_omnibus_wallet',   label:'USDC Omnibus Wallet Address', ph:'0x...'},
                    {key:'stripe_secret_key',     label:'Stripe Secret Key',           ph:'sk_live_...'},
                    {key:'paynow_integration_key',label:'Paynow Integration Key',      ph:'Your Paynow key'},
                    {key:'supabase_service_key',  label:'Supabase Service Role Key',   ph:'eyJ...'},
                  ].map(s=>(
                    <div key={s.key} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">{s.label}</label>
                        <input type="password" placeholder={s.ph} id={`sa-${s.key}`}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"/>
                      </div>
                      <button onClick={async()=>{
                        const val=document.getElementById(`sa-${s.key}`)?.value;
                        if(!val){notify('error','Enter a value');return;}
                        const t=localStorage.getItem('token');
                        const r=await fetch(`${API}/super-admin/sensitive-setting`,{method:'PUT',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({key:s.key,value:val,otpCode})});
                        const d=await r.json();
                        if(r.ok)notify('success',d.message);else{notify('error',d.error);setOtpVerified(false);setOtpSent(false);setOtpCode('');}
                      }} className="px-4 py-2 rounded-lg text-xs bg-red-700 hover:bg-red-600 text-white font-semibold whitespace-nowrap">
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          </div>}

            {/* Tax & Fees tab */}
            {activeTab === 'tax' && (
              <div className="bg-slate-800 rounded-b p-6">
              <div className="space-y-5">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-bold text-sm mb-1">💰 Tax & Fee Rates</h3>
                  <p className="text-xs text-gray-500 mb-4">These rates are applied dynamically across all platform calculations. Changes take effect immediately.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key:'platform_fee_rate',         label:'Platform Fee Rate',           hint:'0.0050 = 0.50%' },
                      { key:'secz_levy_rate',             label:'SECZ Levy Rate',              hint:'0.0032 = 0.32%' },
                      { key:'vat_rate',                   label:'VAT Rate',                    hint:'0.155 = 15.5%' },
                      { key:'wht_resident_rate',          label:'WHT — Residents',             hint:'0.10 = 10%' },
                      { key:'wht_non_resident_rate',      label:'WHT — Non-Residents',         hint:'0.15 = 15%' },
                      { key:'cgt_rate',                   label:'Capital Gains Tax Rate',      hint:'0.20 = 20%' },
                      { key:'imtt_rate',                  label:'IMTT Rate',                   hint:'0.02 = 2%' },
                      { key:'beneficial_owner_threshold', label:'Beneficial Owner Threshold',  hint:'0.10 = 10%' },
                    ].map(s => (
                      <div key={s.key} className="space-y-1">
                        <label className="text-xs text-gray-400 block">{s.label}</label>
                        <p className="text-xs text-gray-600 mb-1">{s.hint}</p>
                        <div className="flex gap-2">
                          <input
                            type="number" step="0.001"
                            defaultValue={settings[s.key]?.value ?? ''}
                            id={`tax-${s.key}`}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                          />
                          <button onClick={() => {
                            const val = document.getElementById(`tax-${s.key}`)?.value;
                            if (val) handleSaveSetting(s.key, val);
                          }} className="px-3 py-2 rounded-lg text-xs bg-blue-700 hover:bg-blue-600 text-white font-semibold">
                            Save
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <label className="text-sm font-semibold text-white block mb-0.5">Compliance Fee (USD)</label>
                  <p className="text-xs text-gray-500 mb-3">Platform compliance fee charged per tokenisation application.</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settings['compliance_fee_usd']?.value ?? ''}
                      onChange={e => setSettings(s => ({ ...s, compliance_fee_usd: { ...(s.compliance_fee_usd||{}), value: e.target.value } }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                    />
                    <button
                      onClick={() => handleSaveSetting('compliance_fee_usd', settings['compliance_fee_usd']?.value ?? '')}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 whitespace-nowrap">
                      Save
                    </button>
                  </div>
                  {settings['compliance_fee_usd']?.updated_at && (
                    <p className="text-xs text-gray-600 mt-2">Last updated: {dt(settings['compliance_fee_usd'].updated_at)}</p>
                  )}
                </div>
              </div>
              </div>
            )}
            {/* Banking tab */}
            {activeTab === 'banking' && (
              <div className="bg-slate-800 rounded-b p-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-1">🏦 Banking Details</h3>
                <p className="text-xs text-gray-500 mb-4">Platform bank account used for compliance fee payments and payment reference generation.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { key: 'bank_name',           label: 'Bank Name',           type: 'text', desc: 'Bank for compliance fee payments.' },
                    { key: 'bank_account_name',   label: 'Account Name',        type: 'text', desc: 'Account name for payments.' },
                    { key: 'bank_account_number', label: 'Account Number',      type: 'text', desc: 'Bank account number.' },
                    { key: 'bank_branch',         label: 'Branch',              type: 'text', desc: 'Bank branch name.' },
                    { key: 'bank_swift_code',     label: 'SWIFT Code',          type: 'text', desc: 'SWIFT/BIC code for international payments.' },
                    { key: 'bank_reference_prefix', label: 'Payment Ref Prefix', type: 'text', desc: 'Prefix for auto-generated payment references (e.g. TEXZ-APP).' },
                  ].map(({ key, label, type, desc }) => (
                    <div key={key} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                      <label className="text-sm font-semibold text-white block mb-0.5">{label}</label>
                      <p className="text-xs text-gray-500 mb-3">{desc}</p>
                      <div className="flex gap-2">
                        <input
                          type={type}
                          value={settings[key]?.value ?? ''}
                          onChange={e => setSettings(s => ({ ...s, [key]: { ...(s[key]||{}), value: e.target.value } }))}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                        />
                        <button
                          onClick={() => handleSaveSetting(key, settings[key]?.value ?? '')}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 whitespace-nowrap">
                          Save
                        </button>
                      </div>
                      {settings[key]?.updated_at && (
                        <p className="text-xs text-gray-600 mt-2">Last updated: {dt(settings[key].updated_at)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            )}
            {/* Investor Tiers tab */}
            {activeTab === 'tiers' && (
              <div className="bg-slate-800 rounded-b p-6 text-center text-slate-400 text-sm">Coming soon</div>
            )}
            {/* Operations tab */}
            {activeTab === 'operations' && (
              <div className="bg-slate-800 rounded-b p-6 space-y-4">
          {/* RECONCILIATION PANEL */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">🔄 USDC Reconciliation</h3>
                <p className="text-xs text-gray-500 mt-0.5">Scheduled daily at 18:00. Compares on-chain omnibus wallet vs internal ledger.</p>
              </div>
              <button onClick={async()=>{
                setReconRunning(true);
                const t=localStorage.getItem('token');
                const r=await fetch(`${API}/settings/reconciliation/run`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}});
                const d=await r.json();
                if(r.ok){
                  notify(d.status==='OK'?'success':d.status==='WARNING'?'warning':'error',`Recon ${d.status}: variance $${parseFloat(d.variance||0).toFixed(4)}`);
                  fetch(`${API}/settings/reconciliation`,{headers:{Authorization:`Bearer ${t}`}}).then(r2=>r2.json()).then(d2=>{if(Array.isArray(d2))setReconLogs(d2);});
                }else notify('error',d.error);
                setReconRunning(false);
              }} disabled={reconRunning} className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50">
                {reconRunning?'⏳ Running...':'▶ Run Now'}
              </button>
            </div>
            {reconLogs.length > 0 ? (
              <table className="w-full text-xs border border-gray-800 rounded-xl overflow-hidden">
                <thead><tr className="text-gray-500 border-b border-gray-800 bg-gray-800/40">
                  {['Time','Trigger','On-Chain','Ledger','Variance','Status'].map(h=><th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reconLogs.slice(0,10).map((r,i)=>(
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-2 px-3 text-gray-400">{new Date(r.reconciled_at).toLocaleString('en-GB')}</td>
                      <td className="py-2 px-3">{r.trigger}</td>
                      <td className="py-2 px-3 font-mono">${parseFloat(r.on_chain_balance||0).toFixed(2)}</td>
                      <td className="py-2 px-3 font-mono">${parseFloat(r.ledger_total||0).toFixed(2)}</td>
                      <td className="py-2 px-3 font-mono">${parseFloat(r.variance||0).toFixed(4)}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${r.status==='OK'?'bg-green-900/40 text-green-300':r.status==='WARNING'?'bg-amber-900/40 text-amber-300':'bg-red-900/40 text-red-300'}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-gray-500 text-center py-3">No reconciliation logs yet.</p>
            )}

          {/* ORPHANED DEPOSIT AUDIT */}
          <div className="bg-gray-900 border border-amber-800/40 rounded-2xl p-5 mt-4 space-y-4">

            {/* Email status banner — shown after first audit run */}
            {reconAudit && (reconAudit.toolStatus === 'DISABLED' ? (
              // Email gate temporarily disabled — show warning instead of blocking
              // TODO: Revert to red blocking banner before sandbox launch
              <div className="rounded-xl p-3 border border-amber-600 bg-amber-900/20 text-xs text-amber-300 font-medium">
                ⚠️ Email notifications not configured. Fix will proceed <strong>without email alerts</strong>. Configure{' '}
                <code className="bg-amber-900/40 px-1 rounded">RECONCILIATION_EMAIL_PRIMARY</code> and{' '}
                <code className="bg-amber-900/40 px-1 rounded">RECONCILIATION_EMAIL_SECONDARY</code>{' '}
                in Sensitive Settings before sandbox launch.
              </div>
            ) : reconAudit.emailStatus && !reconAudit.emailStatus.tertiary?.valid ? (
              <div className="rounded-xl p-3 border border-amber-700/60 bg-amber-900/10 text-xs text-amber-300">
                ⚠️ Reconciliation fix is operational. Third notification recipient not configured — fixes will notify {reconAudit.emailStatus.recipients?.length ?? 2} recipient(s) only.
              </div>
            ) : reconAudit.toolStatus === 'OPERATIONAL' ? (
              <div className="rounded-xl p-3 border border-green-700/40 bg-green-900/10 text-xs text-green-400">
                ✅ Reconciliation system operational. Notifications will be sent to {reconAudit.emailStatus?.recipients?.length ?? 0} recipient(s): {reconAudit.emailStatus?.recipients?.join(', ')}.
              </div>
            ) : null)}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">🔍 Orphaned Deposit Audit</h3>
                <p className="text-xs text-gray-500 mt-0.5">Finds CONFIRMED deposits for deleted investor accounts that inflate the expected balance and cause reconciliation variance.</p>
              </div>
              <button onClick={async () => {
                setReconAuditLoading(true);
                setReconAudit(null);
                setReconFixSuccess(null);
                const t = localStorage.getItem('token');
                try {
                  const r = await fetch(`${API}/admin/reconciliation-audit`, { headers: { Authorization: `Bearer ${t}` } });
                  const d = await r.json();
                  if (r.ok) setReconAudit(d);
                  else notify('error', d.error || 'Audit failed');
                } catch { notify('error', 'Network error'); }
                setReconAuditLoading(false);
              }} disabled={reconAuditLoading} className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50 whitespace-nowrap">
                {reconAuditLoading ? '⏳ Scanning...' : '🔍 Run Audit'}
              </button>
            </div>

            {/* Fix success result */}
            {reconFixSuccess && (
              <div className="rounded-xl p-4 border border-green-700/50 bg-green-900/10 space-y-1">
                <p className="text-xs text-green-300 font-semibold">✅ {reconFixSuccess.message}</p>
                {reconFixSuccess.emailResults && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">Email notifications ({reconFixSuccess.emailStatus}):</p>
                    {reconFixSuccess.emailResults.map((r, i) => (
                      <p key={i} className={`text-xs font-mono ${r.success ? 'text-green-400' : 'text-red-400'}`}>
                        {r.success ? '✓' : '✗'} {r.email}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reconAudit && (
              <div className="space-y-4">
                {/* ── Summary grid ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Confirmed Deposits',    value: `$${parseFloat(reconAudit.confirmedDeposits).toFixed(2)}`,    sub: 'active users only' },
                    { label: 'Completed Withdrawals', value: `$${parseFloat(reconAudit.completedWithdrawals).toFixed(2)}`, sub: 'outflows' },
                    { label: 'Expected Balance',       value: `$${parseFloat(reconAudit.expectedBalance).toFixed(2)}`,      sub: 'deposits − withdrawals' },
                    { label: 'Actual Balance',         value: `$${parseFloat(reconAudit.actualBalance).toFixed(2)}`,        sub: 'sum of all wallets' },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="rounded-xl p-3 border border-gray-800 bg-gray-800/30">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-mono font-bold text-sm mt-0.5 text-white">{value}</p>
                      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
                    </div>
                  ))}
                </div>

                {/* ── Variance status banner ── */}
                {reconAudit.varianceDirection === 'OK' ? (
                  <div className="rounded-xl p-3 border border-green-700/40 bg-green-900/10">
                    <p className="text-xs text-green-400 font-semibold">✅ Ledger balanced — variance $0.00</p>
                  </div>
                ) : (
                  <div className={`rounded-xl p-3 border ${reconAudit.varianceDirection === 'EXCESS' ? 'border-amber-700/40 bg-amber-900/10' : 'border-red-700/40 bg-red-900/10'}`}>
                    <p className={`text-xs font-semibold ${reconAudit.varianceDirection === 'EXCESS' ? 'text-amber-300' : 'text-red-300'}`}>
                      {reconAudit.varianceDirection === 'EXCESS'
                        ? `⬆ $${parseFloat(reconAudit.varianceAbs).toFixed(2)} EXCESS — actual wallets hold more than deposits explain`
                        : `⬇ $${parseFloat(reconAudit.varianceAbs).toFixed(2)} SHORTFALL — wallets hold less than deposits explain`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ledger integrity gap: ${parseFloat(reconAudit.ledgerGap).toFixed(2)} (wallet_transactions net vs wallet balances
                      {parseFloat(reconAudit.ledgerGap) < 0.01 ? ' — internally consistent ✓' : ' — MISMATCH ⚠'})
                    </p>
                  </div>
                )}

                {/* ── Variance breakdown diagnostics ── */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Variance Breakdown</p>

                  {/* Deposit detail */}
                  <div className="rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {[
                          { label: 'Confirmed deposits (all incl. orphaned)',  value: reconAudit.confirmedDepositsAll,  note: '' },
                          { label: 'Orphaned confirmed deposits (user deleted)', value: reconAudit.orphanedTotal,         note: reconAudit.orphanedCount > 0 ? `${reconAudit.orphanedCount} record(s) — fix available below` : 'none', warn: reconAudit.orphanedCount > 0 },
                          { label: 'Previously voided deposits',                value: reconAudit.voidedTotal,           note: `${reconAudit.voidedCount} record(s)` },
                          { label: 'Treasury USD liability (fees collected)',   value: reconAudit.treasuryLiability,     note: 'IMTT + issuance fees — reduces investor balances' },
                          { label: 'IMTT refunds in wallet_transactions',       value: reconAudit.imttRefundTotal,       note: `${reconAudit.imttRefundCount} refund(s) — adds back to actual`, warn: reconAudit.imttRefundTotal > 0 },
                          { label: 'Non-deposit credits (dividends etc.)',      value: reconAudit.unexplainedCredits,    note: 'credits not from deposits — explain EXCESS', warn: reconAudit.unexplainedCredits > 0.01 },
                        ].map(({ label, value, note, warn }) => (
                          <tr key={label} className="border-b border-gray-800/40">
                            <td className={`py-2 px-3 ${warn ? 'text-amber-300' : 'text-gray-400'}`}>{label}</td>
                            <td className={`py-2 px-3 font-mono text-right ${warn ? 'text-amber-300 font-bold' : 'text-white'}`}>${parseFloat(value||0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-gray-600 text-right">{note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Transaction type breakdown */}
                  {reconAudit.txTypeBreakdown?.length > 0 && (
                    <>
                      <p className="text-xs text-gray-500 pt-1">Wallet transaction types</p>
                      <table className="w-full text-xs border border-gray-800 rounded-xl overflow-hidden">
                        <thead><tr className="text-gray-500 border-b border-gray-800 bg-gray-800/40">
                          {['Type','Count','Net Amount','Direction'].map(h => <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {reconAudit.txTypeBreakdown.map((r, i) => (
                            <tr key={i} className="border-b border-gray-800/40">
                              <td className="py-2 px-3 font-mono font-semibold">{r.type}</td>
                              <td className="py-2 px-3 text-gray-400">{r.count}</td>
                              <td className={`py-2 px-3 font-mono ${r.total >= 0 ? 'text-green-300' : 'text-red-300'}`}>${Math.abs(r.total).toFixed(2)}</td>
                              <td className="py-2 px-3 text-gray-500">{r.total >= 0 ? '⬆ credit' : '⬇ debit'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Duplicate transactions */}
                  {reconAudit.duplicateCount > 0 && (
                    <div className="rounded-xl border border-red-700/40 bg-red-900/10 p-3 space-y-2">
                      <p className="text-xs text-red-300 font-semibold">⚠ {reconAudit.duplicateCount} duplicate transaction reference(s) detected</p>
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-500">
                          {['Reference ID','Type','Copies','Total'].map(h => <th key={h} className="text-left py-1 pr-4 font-medium">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {reconAudit.duplicates.map((d, i) => (
                            <tr key={i}>
                              <td className="py-1 pr-4 font-mono text-gray-400">{d.referenceId?.slice(0, 12)}…</td>
                              <td className="py-1 pr-4">{d.type}</td>
                              <td className="py-1 pr-4 text-red-300 font-bold">{d.count}×</td>
                              <td className="py-1 pr-4 font-mono">${Math.abs(d.total).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Orphan fix section ── */}
                {reconAudit.orphanedCount > 0 ? (
                  <>
                    <p className="text-xs text-amber-400 font-medium">⚠ {reconAudit.orphanedCount} orphaned deposit(s) found — investor account was deleted without voiding these records.</p>
                    <table className="w-full text-xs border border-gray-800 rounded-xl overflow-hidden">
                      <thead><tr className="text-gray-500 border-b border-gray-800 bg-gray-800/40">
                        {['Deposit ID','Deleted User ID','Amount','Created'].map(h => <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {reconAudit.orphans.map((o, i) => (
                          <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                            <td className="py-2 px-3 font-mono text-gray-400">{o.id.slice(0, 8)}…</td>
                            <td className="py-2 px-3 font-mono text-red-400">{o.user_id?.slice(0, 8)}… (deleted)</td>
                            <td className="py-2 px-3 font-mono text-red-300">${parseFloat(o.amount_usd).toFixed(2)}</td>
                            <td className="py-2 px-3 text-gray-400">{new Date(o.created_at).toLocaleDateString('en-GB')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Preview Fix button — email gate temporarily disabled, always shown */}
                    <div className="flex items-center gap-3">
                      {/* TODO: Restore OPERATIONAL gate before sandbox launch */}
                      <button onClick={async () => {
                        setReconPreviewLoading(true);
                        setReconPreview(null);
                        setReconConfirmReason('');
                        setReconConfirmChecked(false);
                        const t = localStorage.getItem('token');
                        try {
                          const r = await fetch(`${API}/admin/reconciliation-preview`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } });
                          const d = await r.json();
                          if (r.ok) { setReconPreview(d); setReconFixModal(true); }
                          else notify('error', d.message || d.error || 'Preview failed');
                        } catch { notify('error', 'Network error'); }
                        setReconPreviewLoading(false);
                      }} disabled={reconPreviewLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-700 hover:bg-red-600 text-white disabled:opacity-50">
                        {reconPreviewLoading ? '⏳ Loading preview...' : `🔧 Preview Fix (${reconAudit.orphanedCount} deposit${reconAudit.orphanedCount > 1 ? 's' : ''})`}
                      </button>
                      <p className="text-xs text-gray-500">Preview shows exact changes before you confirm.</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">No orphaned deposits — Fix Variance button not applicable.</p>
                )}
              </div>
            )}

            {/* SUPER_ADMIN: Reconciliation Email Settings */}
            {isSuperAdmin && (
              <div className="border border-gray-700/40 rounded-xl p-4 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-300">⚙️ Reconciliation Email Settings</p>
                    <p className="text-xs text-gray-500">Recipients for fix notifications. Both primary and secondary are required.</p>
                  </div>
                  <button onClick={async () => {
                    const t = localStorage.getItem('token');
                    const r = await fetch(`${API}/admin/reconciliation-settings`, { headers: { Authorization: `Bearer ${t}` } });
                    const d = await r.json();
                    if (r.ok) {
                      setReconSettings(d);
                      setReconSettingsForm({ primary: d.primary?.email || '', secondary: d.secondary?.email || '', tertiary: d.tertiary?.email || '' });
                    }
                  }} className="text-xs text-blue-400 hover:text-blue-300 underline">Load current</button>
                </div>
                {reconSettings && (
                  <div className="space-y-2">
                    {[
                      { key: 'primary',   label: 'Primary (required)',   status: reconSettings.primary   },
                      { key: 'secondary', label: 'Secondary (required)', status: reconSettings.secondary },
                      { key: 'tertiary',  label: 'Tertiary (optional)',  status: reconSettings.tertiary  },
                    ].map(({ key, label, status }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
                        <span className="text-lg">{status?.valid ? '✅' : status?.email ? '❌' : '⚪'}</span>
                        <input
                          type="email"
                          value={reconSettingsForm[key]}
                          onChange={e => setReconSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={`${key}@tokenequityx.co.zw`}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-3 pt-1">
                      <button onClick={async () => {
                        setReconSettingsLoading(true);
                        setReconSettingsSaved(false);
                        const t = localStorage.getItem('token');
                        try {
                          const r = await fetch(`${API}/admin/reconciliation-settings`, {
                            method: 'PUT',
                            headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(reconSettingsForm),
                          });
                          const d = await r.json();
                          if (r.ok) { setReconSettings(d); setReconSettingsSaved(true); notify('success', 'Reconciliation emails updated.'); }
                          else notify('error', d.error || 'Save failed');
                        } catch { notify('error', 'Network error'); }
                        setReconSettingsLoading(false);
                      }} disabled={reconSettingsLoading}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50">
                        {reconSettingsLoading ? '⏳ Saving...' : reconSettingsSaved ? '✅ Saved' : 'Save'}
                      </button>
                      <p className="text-xs text-gray-600">Changes take effect immediately (no restart needed).</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RECONCILIATION PREVIEW + CONFIRM MODAL */}
          {reconFixModal && reconPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-gray-900 border border-red-700/50 rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
                <h3 className="font-bold text-base text-red-300">⚠ Reconciliation Fix — Review &amp; Confirm</h3>

                <div className="rounded-xl bg-gray-800/50 p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Fix type</span><span>{reconPreview.fixId}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Records to void</span><span className="text-red-300 font-bold">{reconPreview.changes?.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total amount</span><span className="text-red-300 font-bold">${parseFloat(reconPreview.totalAmount).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Will notify</span><span className="text-green-400">{reconPreview.recipients?.join(', ')}</span></div>
                </div>

                <p className="text-xs text-gray-400">{reconPreview.description}</p>

                {reconPreview.changes?.length > 0 && (
                  <table className="w-full text-xs border border-gray-800 rounded-lg overflow-hidden">
                    <thead><tr className="bg-gray-800/60 text-gray-500">
                      <th className="text-left py-1.5 px-2">Deposit ID</th>
                      <th className="text-left py-1.5 px-2">Amount</th>
                      <th className="text-left py-1.5 px-2">Created</th>
                    </tr></thead>
                    <tbody>
                      {reconPreview.changes.map((c, i) => (
                        <tr key={i} className="border-t border-gray-800/40">
                          <td className="py-1.5 px-2 font-mono text-gray-400">{String(c.id).slice(0, 10)}…</td>
                          <td className="py-1.5 px-2 font-mono text-red-300">${parseFloat(c.amount_usd).toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-gray-500">{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 block">Reason for adjustment <span className="text-red-400">*</span></label>
                  <textarea
                    rows={3}
                    value={reconConfirmReason}
                    onChange={e => setReconConfirmReason(e.target.value)}
                    placeholder="Describe why this adjustment is necessary (minimum 10 characters)..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={reconConfirmChecked} onChange={e => setReconConfirmChecked(e.target.checked)}
                    className="mt-0.5 accent-red-500" />
                  <span className="text-xs text-gray-300">I confirm this adjustment is accurate and approved. I understand this action will be permanently recorded in the audit log and notification emails will be sent to all configured recipients.</span>
                </label>

                <div className="flex gap-3 pt-1">
                  <button onClick={async () => {
                    setReconFixLoading(true);
                    const t = localStorage.getItem('token');
                    try {
                      const r = await fetch(`${API}/admin/reconciliation-fix`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: reconConfirmReason, confirmed: true }),
                      });
                      const d = await r.json();
                      if (r.ok) {
                        setReconFixModal(false);
                        setReconFixSuccess(d);
                        notify('success', d.message);
                        const r2 = await fetch(`${API}/admin/reconciliation-audit`, { headers: { Authorization: `Bearer ${t}` } });
                        const d2 = await r2.json();
                        if (r2.ok) setReconAudit(d2);
                      } else {
                        notify('error', d.message || d.error || 'Fix failed');
                      }
                    } catch { notify('error', 'Network error'); }
                    setReconFixLoading(false);
                  }} disabled={reconFixLoading || reconConfirmReason.trim().length < 10 || !reconConfirmChecked}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                    {reconFixLoading ? '⏳ Executing...' : '✅ Confirm & Execute Fix'}
                  </button>
                  <button onClick={() => { setReconFixModal(false); setReconPreview(null); setReconConfirmReason(''); setReconConfirmChecked(false); }}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADJUSTMENT TRANSACTION REVERSAL */}
          <div className="bg-gray-900 border border-orange-800/40 rounded-2xl p-5 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">🔃 Adjustment Transaction Reversal</h3>
                <p className="text-xs text-gray-500 mt-0.5">Find and reverse incorrectly-signed ADJUSTMENT wallet transactions. Creates ADJUSTMENT_REVERSAL counter-entries and corrects wallet balances.</p>
              </div>
              <button onClick={async () => {
                setAdjAuditLoading(true);
                setAdjAudit(null);
                setAdjSelected([]);
                setAdjReversalResult(null);
                const t = localStorage.getItem('token');
                try {
                  const r = await fetch(`${API}/admin/adjustment-audit`, { headers: { Authorization: `Bearer ${t}` } });
                  const d = await r.json();
                  if (r.ok) setAdjAudit(d);
                  else notify('error', d.error || 'Audit failed');
                } catch { notify('error', 'Network error'); }
                setAdjAuditLoading(false);
              }} disabled={adjAuditLoading} className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-700 hover:bg-orange-600 text-white disabled:opacity-50 whitespace-nowrap">
                {adjAuditLoading ? '⏳ Loading...' : '🔍 Load Adjustments'}
              </button>
            </div>

            {adjReversalResult && (
              <div className="rounded-xl p-4 border border-green-700/50 bg-green-900/10 space-y-1">
                <p className="text-xs text-green-300 font-semibold">✅ {adjReversalResult.message}</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { label: 'Total Reversed', value: `$${parseFloat(adjReversalResult.totalReversed||0).toFixed(2)}` },
                    { label: 'Ledger Net',     value: `$${parseFloat(adjReversalResult.ledgerNet||0).toFixed(2)}` },
                    { label: 'Ledger Gap',     value: `$${parseFloat(adjReversalResult.ledgerGap||0).toFixed(2)}`, warn: parseFloat(adjReversalResult.ledgerGap||0) > 0.01 },
                  ].map(m => (
                    <div key={m.label} className={`rounded-lg p-2 border ${m.warn ? 'border-amber-700/50 bg-amber-900/10' : 'border-gray-800 bg-gray-800/30'}`}>
                      <p className="text-xs text-gray-500">{m.label}</p>
                      <p className={`font-mono font-bold text-sm ${m.warn ? 'text-amber-300' : 'text-white'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adjAudit && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'ADJUSTMENT records',  value: adjAudit.adjustments?.length ?? 0 },
                    { label: 'Total credits (+)',    value: `$${parseFloat(adjAudit.totalAdjustmentCredits||0).toFixed(2)}`, warn: (adjAudit.totalAdjustmentCredits||0) > 0 },
                    { label: 'Total debits (−)',     value: `$${Math.abs(adjAudit.totalAdjustmentDebits||0).toFixed(2)}` },
                    { label: 'Ledger integrity gap', value: `$${parseFloat(adjAudit.ledgerGap||0).toFixed(2)}`, warn: (adjAudit.ledgerGap||0) > 0.01 },
                  ].map(({ label, value, warn }) => (
                    <div key={label} className={`rounded-xl p-3 border ${warn ? 'border-amber-700/50 bg-amber-900/10' : 'border-gray-800 bg-gray-800/30'}`}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`font-mono font-bold text-sm mt-0.5 ${warn ? 'text-amber-300' : 'text-white'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {adjAudit.adjustments?.length > 0 ? (
                  <>
                    {/* Select all / deselect */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox"
                          checked={adjSelected.length === adjAudit.adjustments.filter(a => !a.already_reversed).length && adjAudit.adjustments.some(a => !a.already_reversed)}
                          onChange={e => setAdjSelected(e.target.checked ? adjAudit.adjustments.filter(a => !a.already_reversed).map(a => a.id) : [])}
                          className="accent-orange-500" />
                        Select all unreversed
                      </label>
                      <span className="text-xs text-gray-600">{adjSelected.length} selected</span>
                    </div>

                    {/* Adjustment table */}
                    <table className="w-full text-xs border border-gray-800 rounded-xl overflow-hidden">
                      <thead><tr className="text-gray-500 border-b border-gray-800 bg-gray-800/40">
                        {['','ID','User','Amount','Balance Before→After','Description','Status'].map(h => <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {adjAudit.adjustments.map((a, i) => (
                          <tr key={i} className={`border-b border-gray-800/40 ${adjSelected.includes(a.id) ? 'bg-orange-900/10' : 'hover:bg-gray-800/20'}`}>
                            <td className="py-2 px-2">
                              {!a.already_reversed && (
                                <input type="checkbox"
                                  checked={adjSelected.includes(a.id)}
                                  onChange={e => setAdjSelected(s => e.target.checked ? [...s, a.id] : s.filter(x => x !== a.id))}
                                  className="accent-orange-500" />
                              )}
                            </td>
                            <td className="py-2 px-2 font-mono text-gray-400">{a.id.slice(0, 8)}…</td>
                            <td className="py-2 px-2 text-gray-300">{a.email || a.user_id?.slice(0, 8)}</td>
                            <td className={`py-2 px-2 font-mono font-bold ${a.amount_usd > 0 ? 'text-amber-300' : 'text-green-400'}`}>
                              {a.amount_usd > 0 ? '+' : ''}{parseFloat(a.amount_usd).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 font-mono text-gray-500 text-xs">
                              ${parseFloat(a.balance_before).toFixed(2)} → ${parseFloat(a.balance_after).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-gray-400 max-w-xs truncate">{a.description || '—'}</td>
                            <td className="py-2 px-2">
                              {a.already_reversed
                                ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-900/40 text-green-300">Reversed ✓</span>
                                : <span className="px-2 py-0.5 rounded-full text-xs bg-amber-900/40 text-amber-300">Pending</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {adjSelected.length > 0 && (
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setAdjReversalReason(''); setAdjReversalChecked(false); setAdjReversalModal(true); }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-700 hover:bg-orange-600 text-white">
                          🔃 Reverse {adjSelected.length} Selected Adjustment{adjSelected.length > 1 ? 's' : ''} →
                        </button>
                        <p className="text-xs text-gray-500">
                          Total: ${adjAudit.adjustments.filter(a => adjSelected.includes(a.id)).reduce((s,a) => s + Math.abs(a.amount_usd), 0).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-green-400">✅ No ADJUSTMENT transactions found.</p>
                )}
              </div>
            )}
          </div>

          {/* ADJUSTMENT REVERSAL MODAL */}
          {adjReversalModal && adjAudit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-gray-900 border border-orange-700/50 rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
                <h3 className="font-bold text-base text-orange-300">🔃 Confirm Adjustment Reversal</h3>

                <div className="rounded-xl bg-gray-800/50 p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Adjustments to reverse</span><span className="text-orange-300 font-bold">{adjSelected.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total amount</span><span className="text-orange-300 font-bold">
                    ${adjAudit.adjustments.filter(a => adjSelected.includes(a.id)).reduce((s,a) => s + Math.abs(a.amount_usd), 0).toFixed(2)}
                  </span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Action</span><span>Create ADJUSTMENT_REVERSAL counter-entries + correct wallet balances</span></div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 block">Reason <span className="text-red-400">*</span></label>
                  <textarea rows={3} value={adjReversalReason} onChange={e => setAdjReversalReason(e.target.value)}
                    placeholder="e.g. Incorrect sign on original adjustment — debits applied as credits (min 10 chars)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 resize-none" />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={adjReversalChecked} onChange={e => setAdjReversalChecked(e.target.checked)} className="mt-0.5 accent-orange-500" />
                  <span className="text-xs text-gray-300">I confirm these reversals are accurate. Original records will be preserved. This action is audit-logged.</span>
                </label>

                <div className="flex gap-3">
                  <button onClick={async () => {
                    setAdjReversalLoading(true);
                    const t = localStorage.getItem('token');
                    try {
                      const r = await fetch(`${API}/admin/adjustment-reversal`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: adjSelected, reason: adjReversalReason, confirmed: true }),
                      });
                      const d = await r.json();
                      if (r.ok) {
                        setAdjReversalModal(false);
                        setAdjReversalResult(d);
                        setAdjSelected([]);
                        notify('success', d.message);
                        // Refresh adjustment audit
                        const r2 = await fetch(`${API}/admin/adjustment-audit`, { headers: { Authorization: `Bearer ${t}` } });
                        const d2 = await r2.json();
                        if (r2.ok) setAdjAudit(d2);
                      } else {
                        notify('error', d.error || 'Reversal failed');
                      }
                    } catch { notify('error', 'Network error'); }
                    setAdjReversalLoading(false);
                  }} disabled={adjReversalLoading || adjReversalReason.trim().length < 10 || !adjReversalChecked}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-orange-700 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                    {adjReversalLoading ? '⏳ Executing...' : '✅ Confirm & Reverse'}
                  </button>
                  <button onClick={() => setAdjReversalModal(false)}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ANNUAL SPV FEES */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-4 space-y-4">
            <div>
              <h3 className="font-bold text-sm">📋 Annual SPV Fees</h3>
              <p className="text-xs text-gray-500 mt-0.5">USD 2,500 per listed SPV per annum. Generated automatically on each token's listing anniversary.</p>
            </div>
            {spvFees.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">No annual SPV fees generated yet. Fees are created automatically on each token's listing anniversary.</p>
            ) : (
              <table className="w-full text-xs border border-gray-800 rounded-xl overflow-hidden">
                <thead><tr className="text-gray-500 border-b border-gray-800 bg-gray-800/40">
                  {['Token','Entity','Period','Amount','Due Date','Status','Action'].map(h=><th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {spvFees.map((f,i)=>(
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-2 px-3 font-bold text-yellow-400">{f.token_symbol}</td>
                      <td className="py-2 px-3 text-gray-300 truncate max-w-xs">{f.entity_name||'—'}</td>
                      <td className="py-2 px-3">{f.fee_period}</td>
                      <td className="py-2 px-3 font-mono">${parseFloat(f.amount_usd).toFixed(2)}</td>
                      <td className="py-2 px-3 text-gray-400">{f.due_date}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${f.status==='PAID'?'bg-green-900/40 text-green-300':'bg-amber-900/40 text-amber-300'}`}>{f.status}</span>
                      </td>
                      <td className="py-2 px-3">
                        {f.status==='DUE' && (
                          <button onClick={async()=>{
                            const ref=window.prompt(`Enter payment reference for ${f.token_symbol} annual fee:`);
                            if(!ref) return;
                            const t=localStorage.getItem('token');
                            const r=await fetch(`${API}/settings/spv-fees/${f.id}/mark-paid`,{method:'PUT',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({payment_ref:ref})});
                            const d=await r.json();
                            if(r.ok){notify('success','Fee marked as paid.');setSpvFees(s=>s.map(x=>x.id===f.id?{...x,status:'PAID',payment_ref:ref}:x));}else notify('error',d.error);
                          }} className="px-2 py-1 rounded text-xs bg-green-700 hover:bg-green-600 text-white">
                            ✅ Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Staff Management ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-4 space-y-4">
            <div>
              <h3 className="font-bold text-sm">👥 Staff Management</h3>
              <p className="text-xs text-gray-500 mt-0.5">Create and manage auditor and compliance officer accounts.</p>
            </div>

            {/* Create staff form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Full Name *</label>
                <input type="text" value={newStaff.full_name}
                  onChange={e=>setNewStaff(s=>({...s,full_name:e.target.value}))}
                  placeholder="e.g. Jane Moyo"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email *</label>
                <input type="email" value={newStaff.email}
                  onChange={e=>setNewStaff(s=>({...s,email:e.target.value}))}
                  placeholder="staff@tokenequityx.co.zw"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Password *</label>
                <input type="password" value={newStaff.password}
                  onChange={e=>setNewStaff(s=>({...s,password:e.target.value}))}
                  placeholder="Temporary password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Role *</label>
                <select value={newStaff.role}
                  onChange={e=>setNewStaff(s=>({...s,role:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500">
                  <option value="AUDITOR">Auditor</option>
                  <option value="COMPLIANCE_OFFICER">Compliance Officer</option>
                </select>
              </div>
            </div>
            {staffMsg && <p className={`text-xs ${staffMsg.startsWith('✅')?'text-green-400':'text-red-400'}`}>{staffMsg}</p>}
            <button
              disabled={!newStaff.email||!newStaff.password||!newStaff.full_name}
              onClick={async()=>{
                setStaffMsg('');
                const token=localStorage.getItem('token');
                const r=await fetch(`${API}/auth/create-staff`,{
                  method:'POST',
                  headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
                  body:JSON.stringify(newStaff),
                });
                const d=await r.json();
                if(r.ok){
                  setStaffMsg('✅ Staff account created successfully.');
                  setNewStaff({email:'',password:'',full_name:'',role:'AUDITOR'});
                  const r2=await fetch(`${API}/auth/staff-list`,{headers:{Authorization:`Bearer ${token}`}});
                  const d2=await r2.json();
                  if(Array.isArray(d2)) setStaffList(d2);
                } else {
                  setStaffMsg(`❌ ${d.error||'Failed to create account.'}`);
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{background:GOLD}}>
              ➕ Create Staff Account
            </button>

            {/* Existing staff table */}
            {staffLoading ? (
              <p className="text-xs text-gray-500 text-center py-3">Loading staff...</p>
            ) : staffList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">No staff accounts found.</p>
            ) : (
              <table className="w-full text-xs border border-gray-800 rounded-xl overflow-hidden">
                <thead className="bg-gray-800 text-gray-400">
                  <tr>
                    {['Name','Email','Role','KYC Status','Created'].map(h=><th key={h} className="text-left py-2 px-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s,i)=>(
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-2 px-3 font-semibold text-white">{s.full_name||'—'}</td>
                      <td className="py-2 px-3 text-gray-300">{s.email}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.role==='AUDITOR'?'bg-blue-900/40 text-blue-300':'bg-purple-900/40 text-purple-300'}`}>{s.role}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.kyc_status==='APPROVED'?'bg-green-900/40 text-green-300':'bg-yellow-900/40 text-yellow-300'}`}>{s.kyc_status||'NONE'}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-400">{dt(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </div>
              </div>
            )}
            {/* Super Admin tab */}
            {JSON.parse(localStorage.getItem('user')||'{}')?.role === 'SUPER_ADMIN' && activeTab === 'superadmin' && (
              <div className="bg-slate-800 rounded-b p-6 text-center text-slate-400 text-sm">Coming soon</div>
            )}
          </div>
        )}

        {tab==='diagnostic'&&(
          <DiagnosticPanel token={typeof window !== 'undefined' ? localStorage.getItem('token') : ''} API={API}/>
        )}

      </div>

      {/* ── ASSIGN AUDITOR MODAL ── */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-1">Assign Auditor</h3>
            <p className="text-gray-400 text-sm mb-5">{assignModal.itemName}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Auditor</label>
                <select onChange={e=>setAssignNote(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600">
                  <option value="">-- Select Auditor --</option>
                  {(auditorList.length ? auditorList : users.filter(u=>u.role==='AUDITOR')).map(a=>(
                    <option key={a.id} value={a.email}>{a.full_name || a.email} ({a.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Instructions to Auditor (optional)</label>
                <textarea rows={3} placeholder="e.g. Please prioritise — SECZ deadline is 15 April." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600 resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setAssignModal(null);setAssignNote('');}} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
              <button onClick={()=>assignAuditor(assignModal.item, assignNote||'Pending assignment')} disabled={!assignNote} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{background:NAVY}}>🔍 Assign Auditor</button>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVE APPLICATION MODAL ── */}
      {appFeeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-1">Approve Application at Tuesday Meeting</h3>
            <p className="text-gray-400 text-sm mb-5">{appFeeModal.name} · {appFeeModal.symbol}</p>
            <div className="space-y-4">
              <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">Compliance fee to invoice issuer (fixed)</p>
                <p className="text-xl font-bold text-yellow-400">$1,500.00 USD</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nominated Auditor Email *</label>
                <input type="email" value={auditorEmailInput}
                  onChange={e => setAuditorEmailInput(e.target.value)}
                  placeholder="auditor@tokenequityx.co.zw"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Auditor Name</label>
                <input type="text" value={auditorNameInput}
                  onChange={e => setAuditorNameInput(e.target.value)}
                  placeholder="e.g. John Moyo CPA"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"/>
              </div>
              <p className="text-xs text-gray-500">The auditor will be notified and will contact the issuer directly to agree scope and fee. TokenEquityX only charges the compliance review fee.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setAppFeeModal(null);setAuditorEmailInput('');setAuditorNameInput('');}} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
              <button onClick={handleApproveApplication} disabled={!auditorEmailInput}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{background:GREEN}}>
                ✅ Approve & Notify Auditor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT APPLICATION MODAL ── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-1">Reject Application</h3>
            <p className="text-gray-400 text-sm mb-5">{rejectModal.name} · {rejectModal.symbol}</p>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Rejection Reason <span className="text-red-400">*</span></label>
              <textarea rows={4} value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)}
                placeholder="e.g. Insufficient audited financials. Please resubmit once 3 years of audited accounts are available."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-600 resize-none"/>
            </div>
            <p className="text-xs text-gray-500 mt-2">The issuer will receive an email with this reason.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setRejectModal(null);setRejectionReason('');}} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
              <button onClick={handleRejectApplication} disabled={!rejectionReason}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40">
                ❌ Reject & Notify Issuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM FEE MODAL ── */}
      {feeConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-1">Confirm Fee Received & Assign Auditor</h3>
            <p className="text-gray-400 text-sm mb-5">{feeConfirmModal.name} · {feeConfirmModal.symbol}</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Auditor Email <span className="text-red-400">*</span></label>
                <input type="email" value={auditorEmailInput} onChange={e=>setAuditorEmailInput(e.target.value)}
                  placeholder="auditor@firm.co.zw"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Auditor Name (for issuer email)</label>
                <input type="text" value={auditorNameInput} onChange={e=>setAuditorNameInput(e.target.value)}
                  placeholder="e.g. J. Sibanda CPA (ICAZ)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"/>
              </div>
              <p className="text-xs text-gray-500">Confirming fee will set status to UNDER_REVIEW and notify the issuer that their auditor has been assigned.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setFeeConfirmModal(null);setAuditorEmailInput('');setAuditorNameInput('');}} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
              <button onClick={handleConfirmFee} disabled={!auditorEmailInput}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{background:GREEN}}>
                ✅ Confirm & Assign Auditor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HARD DELETE LISTING MODAL ── */}
      {deleteListingModal && (() => {
        const { item, step, input } = deleteListingModal;
        const sym = item.symbol || item.name || '';
        const matches = input.trim().toUpperCase() === sym.toUpperCase();
        const close = () => setDeleteListingModal(null);
        const confirmDelete = async () => {
          try {
            const r = await api.delete(`/admin/listings/${sym}?confirm=true`);
            setPipeline(p => p.filter(i => i.id !== item.id));
            close();
            notify('success', r.data?.message || `${sym} permanently deleted from the platform.`);
          } catch (e) {
            notify('error', e.response?.data?.error || 'Delete failed');
          }
        };
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-red-900/60 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-red-400">🗑️ Delete Listing Permanently</h3>
                <button onClick={close} className="text-gray-500 hover:text-white text-xl">✕</button>
              </div>
              {step === 1 ? (
                <>
                  <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 mb-4 space-y-1">
                    <p className="text-red-300 text-sm font-semibold">⚠️ This action is irreversible.</p>
                    <p className="text-gray-400 text-xs">All records for <span className="text-white font-bold">{sym}</span> will be permanently deleted, including:</p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-0.5 list-disc list-inside">
                      <li>Submission and application data</li>
                      <li>Token holdings and order history</li>
                      <li>Primary offerings and subscriptions</li>
                      <li>P2P offers and settlement records</li>
                      <li>Audit logs and fee records</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">Type <span className="font-mono text-white bg-gray-800 px-1.5 py-0.5 rounded">{sym}</span> to confirm:</p>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setDeleteListingModal(m => ({ ...m, input: e.target.value }))}
                    placeholder={`Type ${sym} here`}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-red-600 mb-4"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button onClick={close} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">Cancel</button>
                    <button
                      disabled={!matches}
                      onClick={() => setDeleteListingModal(m => ({ ...m, step: 2 }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed bg-red-800 hover:bg-red-700 text-white">
                      Continue →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-300 text-sm mb-6">
                    Final confirmation — permanently delete <span className="font-bold text-white">{sym}</span> and all associated platform data? This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteListingModal(m => ({ ...m, step: 1 }))} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white">← Back</button>
                    <button
                      onClick={confirmDelete}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-700 hover:bg-red-600 text-white border border-red-500">
                      ⚠️ Permanently Delete {sym}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── USER PROFILE MODAL ── */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">User Profile</h2><button onClick={()=>setSelectedUser(null)} className="text-gray-500 hover:text-white text-xl">✕</button></div>
            <div className="space-y-2 text-sm">
              {[
                ['Email',         selectedUser.email||'—'],
                ['Phone',         selectedUser.phone||'—'],
                ['Country',       selectedUser.country||'—'],
                ['City',          selectedUser.city||'—'],
                ['Date of Birth', selectedUser.date_of_birth?dt(selectedUser.date_of_birth):'—'],
                ['Wallet',        selectedUser.wallet_address?`${selectedUser.wallet_address.slice(0,8)}…${selectedUser.wallet_address.slice(-6)}`:'—'],
                ['Current Role',  selectedUser.role],
                ['KYC Status',    selectedUser.kyc_status],
                ['Account Status',selectedUser.account_status||'ACTIVE'],
                ['Joined',        dt(selectedUser.created_at)],
                ['Last Login',    selectedUser.last_login?dt(selectedUser.last_login):'Never'],
              ].map(([l,v])=>(
                <div key={l} className="flex justify-between py-1 border-b border-gray-800/50 last:border-0"><span className="text-gray-400 text-xs">{l}</span><span className={`text-xs ${l==='Current Role'?'text-yellow-400 font-bold':l==='KYC Status'?selectedUser.kyc_status==='APPROVED'?'text-green-400':'text-amber-400':l==='Account Status'?selectedUser.account_status==='SUSPENDED'?'text-red-400':'text-green-400':''}`}>{v}</span></div>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Approve Membership As</label>
              <div className="grid grid-cols-3 gap-2">
                {['INVESTOR','ISSUER','PARTNER'].map(r=>(
                  <div key={r} onClick={()=>setUserModalRole(r)} className={`cursor-pointer text-center py-2 rounded-xl border text-xs font-bold transition-all ${userModalRole===r?'border-blue-500 bg-blue-900/30 text-blue-300':'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                    {r==='INVESTOR'?'👤':r==='ISSUER'?'🏢':'🤝'} {r}
                  </div>
                ))}
              </div>
            </div>
            <button disabled={userModalLoading||(userModalRole===selectedUser.role&&selectedUser.kyc_status==='APPROVED')}
              onClick={async()=>{setUserModalLoading(true);const token=localStorage.getItem('token');await fetch(`${API}/admin/users/${selectedUser.id}/role`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({role:userModalRole})});await fetchUsers();setSelectedUser(null);setUserModalLoading(false);}}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-colors" style={{background:GREEN}}>
              {userModalLoading?'⏳ Saving…':`✓ Approve as ${userModalRole}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}