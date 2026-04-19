'use client';
import { useWallet } from '../../hooks/useWallet';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const NAVY = '#1A3C5E';
const GOLD = '#C8972B';
const GREEN = '#16a34a';

const fmt = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(2)}`;
const dt  = (d) => new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

const inputCls    = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-600";
const textareaCls = inputCls + " resize-none";

const VALUATION_MODELS = {
  'Real Estate': { name:'NAV + Cap Rate',    fields:['Net Rental Income','Cap Rate (%)','Total Assets','Total Liabilities'] },
  'Mining':      { name:'Resource NPV',      fields:['Resource Estimate (oz)','PGM Price (USD/oz)','Operating Cost (USD/oz)','Discount Rate (%)'] },
  'Bond':        { name:'Present Value',     fields:['Face Value','Coupon Rate (%)','Yield to Maturity (%)','Time to Maturity (years)'] },
  'Equity':      { name:'DCF + Multiples',   fields:['Revenue (USD)','EBITDA Margin (%)','Revenue Growth (%)','EV/EBITDA Multiple (x)'] },
};

const COMPLETION_COLORS = { APPROVED:'bg-green-900/50 text-green-300', REJECTED:'bg-red-900/50 text-red-300', INFO_REQUESTED:'bg-amber-900/50 text-amber-300' };
const PRIORITY_BG       = { HIGH:'bg-red-900/30 border-red-700/50', MEDIUM:'bg-amber-900/30 border-amber-700/50', LOW:'bg-gray-800/50 border-gray-700/30' };

// ── AUDIT REVIEW PANEL ──────────────────────────────────────────
function AuditReviewPanel({ item, note, setNote, doAction, userRole }) {
  const [fullData,   setFullData]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Audit report fields
  const [certifiedPrice,    setCertifiedPrice]    = useState('');
  const [valuationMethod,   setValuationMethod]   = useState('');
  const [findings,          setFindings]          = useState('');
  const [methodology,       setMethodology]       = useState('');
  const [riskRating,        setRiskRating]        = useState('');
  const [caveats,           setCaveats]           = useState('');
  const [yearsOfFinancials, setYearsOfFinancials] = useState('');
  const [annualRevenue,     setAnnualRevenue]     = useState('');
  const [reportSection,     setReportSection]     = useState('data'); // data | report | signoff
  const [enginePrice,       setEnginePrice]       = useState(null);
  const [engineLoading,     setEngineLoading]      = useState(false);
  const [varianceJustification, setVarianceJustification] = useState('');

  useEffect(() => {
    setLoading(true);
    setCertifiedPrice(''); setFindings(''); setRiskRating(''); setMethodology('');
    setReportSection('data');
    api.get(`/submissions/${item.id}`)
      .then(r => { setFullData(r.data); })
      .catch(() => setFullData(null))
      .finally(() => setLoading(false));
  }, [item.id]);

  const rawDataJson    = fullData?.data_json || {};
  const financial      = rawDataJson?.financialData || rawDataJson || {};
  const isTokenisation = item.type === 'TOKENISATION' || financial.type === 'TOKENISATION_APPLICATION';
  const documents      = rawDataJson?.documents || financial.documents || [];

  // Fetch engine reference price when financial data is available
  useEffect(() => {
    if (!fullData || !item.token) return;
    const rawData = fullData.data_json || {};
    const financialData = rawData?.financialData || rawData || {};
    const hasData = financialData && (
      financialData.revenueTTM || financialData.faceValue ||
      financialData.propertyValuation || financialData.totalResourceTonnes || financialData.annualRevenue
    );
    if (!hasData) return;
    setEngineLoading(true);
    api.post('/pipeline/preview', { tokenSymbol: item.token, financialData })
      .then(r => { if (r.data?.pricePerToken) setEnginePrice(r.data); })
      .catch(() => {})
      .finally(() => setEngineLoading(false));
  }, [fullData, item.token]);

  // Calculate variance between certified price and engine price
  const enginePriceNum   = enginePrice ? parseFloat(enginePrice.pricePerToken || 0) : null;
  const certifiedPriceNum = certifiedPrice ? parseFloat(certifiedPrice) : null;
  const priceVariancePct = enginePriceNum && certifiedPriceNum && enginePriceNum > 0
    ? ((certifiedPriceNum - enginePriceNum) / enginePriceNum * 100)
    : null;
  const varianceExceedsThreshold = priceVariancePct !== null && Math.abs(priceVariancePct) > 5;
  const existingReport = fullData?.audit_report ? (
    typeof fullData.audit_report === 'string' ? JSON.parse(fullData.audit_report) : fullData.audit_report
  ) : null;

  // Suggested listing type based on inputs
  const suggestedType = parseInt(yearsOfFinancials) >= 3 && parseFloat(annualRevenue) >= 1500000
    ? 'BROWNFIELD_BOURSE' : yearsOfFinancials ? 'GREENFIELD_P2P' : null;

  const handleSubmitReport = async (recommendation) => {
    if (!certifiedPrice) { alert('Certified oracle price is required.'); return; }
    if (!riskRating)     { alert('Risk rating is required.'); return; }
    if (!findings)       { alert('Audit findings are required.'); return; }
    setSubmitting(true);
    try {
      if (varianceExceedsThreshold && !varianceJustification.trim()) {
        alert('You must provide a variance justification when the certified price deviates more than 5% from the engine reference price.');
        setSubmitting(false);
        return;
      }
      const res = await api.put(`/submissions/${item.id}/audit-report`, {
        findings, methodology, riskRating, recommendation,
        caveats, certifiedPrice, valuationMethod,
        engineReferencePrice: enginePriceNum || null,
        priceVariancePct:     priceVariancePct || null,
        varianceJustification: varianceJustification || null,
        yearsOfFinancials, annualRevenueUsd: annualRevenue,
      });
      // Also set oracle price if approving
      if (recommendation === 'APPROVE') {
        try {
          await api.post('/oracle/set', {
            tokenSymbol: item.token || item.token_symbol,
            price: parseFloat(certifiedPrice),
            source: `Auditor certification — ${valuationMethod||'Independent valuation'} — ${new Date().toISOString().split('T')[0]}`,
          });
        } catch(e) { console.warn('Oracle set skipped:', e.message); }
      }
      await doAction(item.id, res.data.status, certifiedPrice, valuationMethod);
    } catch(err) {
      alert(err.response?.data?.error || 'Report submission failed.');
    } finally { setSubmitting(false); }
  };

  const SECTIONS = [
    { key:'data',   label:'📊 Application Data' },
    { key:'docs',   label:'📎 Documents' },
    { key:'report', label:'📋 Audit Report' },
    { key:'signoff',label:'✅ Sign-Off' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col" style={{maxHeight:'85vh'}}>
      {/* Header */}
      <div className="p-5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg leading-tight">
              {financial.legalEntityName || item.entity_name || item.token_symbol}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded text-yellow-400">{item.token_symbol}</span>
              {item.reference && <span className="font-mono text-xs text-gray-500">Ref: {item.reference}</span>}
              <span className="text-xs text-gray-500">{dt(item.submitted)} · {item.days_pending}d pending</span>
              {item.assigned_auditor && <span className="text-xs text-blue-300">Assigned: {item.assigned_auditor}</span>}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                item.status==='AUDITOR_APPROVED'?'bg-green-900/50 text-green-300':
                item.status==='UNDER_REVIEW'?'bg-blue-900/50 text-blue-300':
                'bg-amber-900/50 text-amber-300'}`}>{item.status?.replace('_',' ')}</span>
            </div>
          </div>
          {existingReport && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-green-400 font-bold">✓ Report submitted</p>
              <p className="text-xs text-gray-500">{dt(existingReport.reportDate)}</p>
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mt-4">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={()=>setReportSection(s.key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                reportSection===s.key ? 'text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`} style={reportSection===s.key?{background:NAVY}:{}}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading submission…</div>
        ) : (

          /* ── SECTION: APPLICATION DATA ── */
          reportSection === 'data' && (
            <div className="space-y-4">
              {isTokenisation ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Legal Entity',       financial.legalEntityName],
                      ['Registration No.',   financial.registrationNumber],
                      ['Proposed Symbol',    financial.proposedSymbol],
                      ['Asset Class',        financial.assetClass],
                      ['Jurisdiction',       financial.jurisdiction],
                      ['Target Raise',       financial.targetRaiseUsd ? fmt(financial.targetRaiseUsd) : null],
                      ['Issue Price',        financial.tokenIssuePrice ? `$${parseFloat(financial.tokenIssuePrice).toFixed(4)}` : null],
                      ['Total Supply',       financial.totalSupply ? parseInt(financial.totalSupply).toLocaleString() : null],
                      ['Expected Yield',     financial.expectedYield],
                      ['Distribution',       financial.distributionFrequency],
                    ].filter(([,v])=>v).map(([k,v])=>(
                      <div key={k} className="bg-gray-800/60 rounded-lg px-3 py-2">
                        <p className="text-gray-500 text-xs">{k}</p>
                        <p className="font-semibold text-sm">{v}</p>
                      </div>
                    ))}
                  </div>
                  {financial.assetDescription && (
                    <div className="bg-gray-800/60 rounded-lg px-3 py-3">
                      <p className="text-gray-500 text-xs mb-1">Asset Description</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{financial.assetDescription}</p>
                    </div>
                  )}
                  {(financial.keyPersonnel||[]).filter(p=>p.name).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Key Personnel</p>
                      {financial.keyPersonnel.filter(p=>p.name).map((p,i)=>(
                        <div key={i} className="flex gap-3 text-xs bg-gray-800/50 rounded-lg px-3 py-2 mb-1">
                          <span className="text-gray-400 w-24 flex-shrink-0">{p.role}</span>
                          <span className="font-medium">{p.name}</span>
                          {p.email&&<span className="text-gray-500">{p.email}</span>}
                          {p.idNumber&&<span className="text-gray-500 font-mono">ID: {p.idNumber}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Revenue',         financial.revenue ? fmt(financial.revenue) : null],
                    ['EBITDA',          financial.ebitda ? fmt(financial.ebitda) : null],
                    ['Total Assets',    financial.netAssets ? fmt(financial.netAssets) : null],
                    ['Net Liabilities', financial.netLiabilities ? fmt(financial.netLiabilities) : null],
                    ...Object.entries(financial.operationalKpis||{}).filter(([,v])=>v),
                  ].filter(([,v])=>v).map(([k,v])=>(
                    <div key={k} className="bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-gray-500 text-xs capitalize">{k.replace(/_/g,' ')}</p>
                      <p className="font-semibold text-sm">{v}</p>
                    </div>
                  ))}
                  {financial.managementStatement&&(
                    <div className="col-span-2 bg-gray-800/60 rounded-lg px-3 py-3">
                      <p className="text-gray-500 text-xs mb-1">Management Statement</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{financial.managementStatement}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {/* ── SECTION: DOCUMENTS ── */}
        {!loading && reportSection === 'docs' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">{documents.length} document{documents.length!==1?'s':''} submitted</p>
            {documents.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No documents uploaded.</p>}
            {documents.map((doc,i) => {
              const name   = doc.originalName || doc.storedName || `Document ${i+1}`;
              const url    = doc.url ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api','') || 'http://localhost:3001'}${doc.url}` : null;
              const sizeKb = doc.size ? `${(doc.size/1024).toFixed(0)} KB` : '';
              const ext    = name.split('.').pop()?.toLowerCase();
              const icon   = ext==='pdf'?'📄':['xlsx','xls','csv'].includes(ext)?'📊':['docx','doc'].includes(ext)?'📝':'📎';
              return (
                <div key={i} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate">{name}</p>
                      {sizeKb&&<p className="text-xs text-gray-500">{sizeKb}</p>}
                    </div>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" download={name}
                      className="flex-shrink-0 ml-3 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors">
                      ⬇ Download
                    </a>
                  ) : (
                    <span className="text-xs text-gray-600 ml-3">URL missing</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── SECTION: AUDIT REPORT ── */}
        {!loading && reportSection === 'report' && (
          <div className="space-y-4">
            {existingReport && (
              <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4">
                <p className="text-green-300 text-xs font-bold mb-2">✓ Audit Report Already Submitted — {dt(existingReport.reportDate)}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">Risk Rating: </span><span className="font-bold">{existingReport.riskRating}</span></div>
                  <div><span className="text-gray-400">Recommendation: </span><span className="font-bold">{existingReport.recommendation}</span></div>
                  <div><span className="text-gray-400">Certified Price: </span><span className="font-bold text-yellow-400">${existingReport.certifiedPrice?.toFixed(4)}</span></div>
                  <div><span className="text-gray-400">Listing Suggestion: </span><span className="font-bold">{existingReport.suggestedListingType?.replace('_',' ')}</span></div>
                </div>
                {existingReport.findings&&<p className="text-gray-300 text-xs mt-3 leading-relaxed">{existingReport.findings}</p>}
                <button onClick={()=>setReportSection('report_edit')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
                  Edit & resubmit report
                </button>
              </div>
            )}

            {(!existingReport || reportSection==='report_edit') && userRole !== 'ADMIN' && (
              <>
                <p className="text-gray-400 text-sm">Complete all sections of the audit report. This report is shared with the Admin and the Issuer.</p>

                {/* Listing type helper */}
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Listing Type Assessment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Years of Audited Financials</label>
                      <input type="number" min="0" max="50" placeholder="e.g. 2"
                        value={yearsOfFinancials} onChange={e=>setYearsOfFinancials(e.target.value)}
                        className={inputCls}/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Annual Revenue (USD)</label>
                      <input type="number" min="0" placeholder="e.g. 1500000"
                        value={annualRevenue} onChange={e=>setAnnualRevenue(e.target.value)}
                        className={inputCls}/>
                    </div>
                  </div>
                  {suggestedType && (
                    <div className={`mt-3 rounded-lg px-4 py-3 ${suggestedType==='BROWNFIELD_BOURSE'?'bg-blue-900/40 border border-blue-700/50':'bg-amber-900/30 border border-amber-700/50'}`}>
                      <p className={`text-sm font-bold ${suggestedType==='BROWNFIELD_BOURSE'?'text-blue-300':'text-amber-300'}`}>
                        {suggestedType==='BROWNFIELD_BOURSE' ? '🏛 Brownfield — Main Bourse Eligible' : '🔄 Greenfield — Peer-to-Peer Only'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {suggestedType==='BROWNFIELD_BOURSE'
                          ? 'Meets criteria: ≥3 years audited financials + revenue ≥ USD 1.5M. Full order book trading on main bourse.'
                          : 'Does not yet meet brownfield criteria. P2P trading only — no order book. Can be upgraded later.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Variance justification — required if >5% deviation */}
                {varianceExceedsThreshold && (
                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
                    <label className="text-xs text-amber-300 block mb-1 font-semibold">
                      ⚠️ Variance Justification Required *
                    </label>
                    <p className="text-xs text-gray-400 mb-2">
                      Your certified price deviates more than 5% from the engine reference price. You must document your justification for this variance. This is required for regulatory compliance.
                    </p>
                    <textarea rows={3}
                      value={varianceJustification}
                      onChange={e=>setVarianceJustification(e.target.value)}
                      placeholder="e.g. Applied a 12% liquidity discount to the engine DCF output due to limited secondary market depth for this asset class. Comparable transactions in Q1 2026 support the adjusted price."
                      className="w-full bg-gray-800 border border-amber-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"/>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Audit Findings <span className="text-red-400">*</span></label>
                  <textarea rows={4} value={findings} onChange={e=>setFindings(e.target.value)}
                    placeholder="Summarise your key findings from review of the submitted financial data, documents, and business description."
                    className={textareaCls}/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valuation Methodology</label>
                  <textarea rows={3} value={methodology} onChange={e=>setMethodology(e.target.value)}
                    placeholder="Describe the valuation model used and key assumptions made (e.g. cap rate applied, discount rate, comparable transactions)."
                    className={textareaCls}/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Caveats & Conditions</label>
                  <textarea rows={3} value={caveats} onChange={e=>setCaveats(e.target.value)}
                    placeholder="Any conditions attached to approval, items flagged for future review, or qualifications to the opinion."
                    className={textareaCls}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Risk Rating <span className="text-red-400">*</span></label>
                    <select value={riskRating} onChange={e=>setRiskRating(e.target.value)} className={inputCls}>
                      <option value="">— Select —</option>
                      <option value="LOW">LOW — Well-established asset, strong financials</option>
                      <option value="MEDIUM">MEDIUM — Some risk factors, adequate documentation</option>
                      <option value="HIGH">HIGH — Significant risk factors or incomplete data</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Valuation Method</label>
                    <select value={valuationMethod} onChange={e=>setValuationMethod(e.target.value)} className={inputCls}>
                      <option value="">— Select —</option>
                      <option>NAV + Cap Rate</option>
                      <option>NAV + Cap Rate (REIT)</option>
                      <option>Resource NPV</option>
                      <option>Bond Present Value</option>
                      <option>DCF + Revenue Multiple</option>
                      <option>Infrastructure DCF</option>
                      <option>Independent Appraisal</option>
                      <option>Issue Price (New Listing)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {userRole === 'ADMIN' && !existingReport && (
              <p className="text-gray-500 text-sm text-center py-8">No audit report submitted yet.</p>
            )}
          </div>
        )}

        {/* ── SECTION: SIGN-OFF ── */}
        {!loading && reportSection === 'signoff' && (
          <div className="space-y-4">
            {userRole === 'ADMIN' ? (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">👁️ Admin view only — only the assigned auditor can certify prices and sign off submissions.</p>
                {item.assigned_auditor && <p className="text-blue-300 text-xs mt-2">Assigned to: <strong>{item.assigned_auditor}</strong></p>}
                {!item.assigned_auditor && <p className="text-amber-300 text-xs mt-2">⚠️ No auditor assigned — assign one from the Admin Pipeline.</p>}
              </div>
            ) : (
              <>
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-5">
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">🔮 Oracle Price Certification</p>
                  <p className="text-gray-400 text-xs mb-4">
                    {isTokenisation
                      ? 'Set the initial certified listing price. This becomes the oracle price for all trading and distributions.'
                      : 'Set the certified oracle price for this quarter based on your review of the submitted data.'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Certified Oracle Price (USD) <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.0001" min="0"
                          placeholder={isTokenisation ? (financial.tokenIssuePrice||'1.0000') : (item.current_oracle||1).toFixed(4)}
                          value={certifiedPrice} onChange={e=>setCertifiedPrice(e.target.value)}
                          className="w-full bg-gray-800 border border-blue-700 rounded-lg pl-6 pr-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-blue-400"/>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Method</label>
                      <select value={valuationMethod} onChange={e=>setValuationMethod(e.target.value)} className={inputCls}>
                        <option value="">— Select —</option>
                        <option>Issue Price (New Listing)</option>
                        <option>NAV + Cap Rate</option>
                        <option>Resource NPV</option>
                        <option>Bond Present Value</option>
                        <option>DCF + Revenue Multiple</option>
                        <option>Independent Appraisal</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Valuation Engine Reference Panel */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">🔢 Valuation Engine Reference</p>
                      {engineLoading && <span className="text-xs text-gray-500">Calculating…</span>}
                    </div>
                    {!enginePrice && !engineLoading && (
                      <p className="text-xs text-gray-500">No engine output available — insufficient financial data submitted by issuer.</p>
                    )}
                    {enginePrice && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-gray-900/60 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500 mb-1">Asset Type</p>
                            <p className="font-bold text-yellow-400 text-sm">{enginePrice.assetType}</p>
                          </div>
                          <div className="bg-gray-900/60 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500 mb-1">Blended Enterprise Value</p>
                            <p className="font-bold text-green-400">{enginePrice.blended >= 1e6 ? `$${(enginePrice.blended/1e6).toFixed(2)}M` : `$${parseFloat(enginePrice.blended||0).toLocaleString()}`}</p>
                          </div>
                          <div className="bg-gray-900/60 rounded-lg p-3 text-center border-2 border-blue-600/50">
                            <p className="text-xs text-gray-500 mb-1">Engine Reference Price</p>
                            <p className="font-black text-blue-300 text-lg">${parseFloat(enginePrice.pricePerToken||0).toFixed(4)}</p>
                          </div>
                        </div>
                        {enginePrice.models && Object.entries(enginePrice.models)
                          .filter(([,v]) => v && (v.enterpriseValue > 0 || v.price > 0 || v.nav > 0)).length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Model Breakdown</p>
                            <div className="space-y-1.5">
                              {Object.entries(enginePrice.models)
                                .filter(([,v]) => v && (v.enterpriseValue > 0 || v.price > 0 || v.nav > 0))
                                .map(([modelName, modelData]) => {
                                  const val = modelData?.enterpriseValue || modelData?.price || modelData?.nav || 0;
                                  const labels = { revenueMultiple:'Revenue Multiple', ebitdaMultiple:'EBITDA Multiple', dcf:'DCF', nav:'NAV', capRate:'Cap Rate', resourceValuation:'Resource NPV', bondPricing:'Bond PV', infrastructure:'Infrastructure DCF' };
                                  return (
                                    <div key={modelName} className="flex items-center justify-between bg-gray-900/40 rounded-lg px-3 py-1.5 text-xs">
                                      <span className="text-gray-400">{labels[modelName] || modelName}</span>
                                      <span className="font-bold text-yellow-400">{val >= 1e6 ? `$${(val/1e6).toFixed(2)}M` : `$${parseFloat(val).toLocaleString()}`}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                        {certifiedPrice && !isNaN(parseFloat(certifiedPrice)) && (
                          <div className={`rounded-lg p-3 text-xs ${varianceExceedsThreshold ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-green-900/20 border border-green-800/40'}`}>
                            <div className="flex items-center justify-between">
                              <span className={varianceExceedsThreshold ? 'text-amber-300 font-semibold' : 'text-green-300 font-semibold'}>
                                {varianceExceedsThreshold ? '⚠️ Variance exceeds 5% threshold' : '✓ Variance within acceptable range'}
                              </span>
                              <span className={`font-mono font-bold ${priceVariancePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {priceVariancePct !== null ? `${priceVariancePct >= 0 ? '+' : ''}${priceVariancePct.toFixed(2)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-1.5 text-gray-400">
                              <span>Engine: <span className="text-blue-300 font-mono">${enginePriceNum?.toFixed(4)}</span></span>
                              <span>Certified: <span className="text-white font-mono">${parseFloat(certifiedPrice).toFixed(4)}</span></span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {certifiedPrice && !isNaN(parseFloat(certifiedPrice)) && !isTokenisation && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        ['Current Price', `$${(item.current_oracle||1).toFixed(4)}`, 'text-white'],
                        ['Certified Price', `$${parseFloat(certifiedPrice).toFixed(4)}`, 'text-blue-300'],
                        ['Change', `${((parseFloat(certifiedPrice)-(item.current_oracle||1))/(item.current_oracle||1)*100).toFixed(2)}%`,
                          parseFloat(certifiedPrice)>=(item.current_oracle||1)?'text-green-400':'text-red-400'],
                      ].map(([l,v,c])=>(
                        <div key={l} className="bg-gray-800/60 rounded-lg px-3 py-2 text-center">
                          <p className="text-gray-500 text-xs mb-1">{l}</p>
                          <p className={`font-bold text-sm ${c}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auditor notes to issuer */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Notes to Issuer (visible on their dashboard)</label>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
                    placeholder="Summary of outcome, key conditions, or next steps for the issuer."
                    className={textareaCls}/>
                </div>

                {/* Certification declaration */}
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    By submitting this audit report, I certify that I have independently reviewed the submitted information,
                    the oracle price is supported by documented evidence, and this opinion complies with ICAZ professional
                    standards and the TokenEquityX Auditor Code of Conduct.
                  </p>
                </div>

                <div className="space-y-2">
                  {(!findings || !riskRating || !certifiedPrice) && (
                    <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg px-4 py-3">
                      <p className="text-amber-300 text-xs font-bold mb-1">Complete before signing off:</p>
                      {!findings&&<p className="text-amber-400 text-xs">• Audit findings (Report tab)</p>}
                      {!riskRating&&<p className="text-amber-400 text-xs">• Risk rating (Report tab)</p>}
                      {!certifiedPrice&&<p className="text-amber-400 text-xs">• Certified oracle price (above)</p>}
                    </div>
                  )}
                  {item.type === 'FINANCIAL_DATA' && (
                    <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-4">
                      <p className="text-xs font-semibold text-blue-300 mb-1">🔄 Quarterly Re-certification</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        This is a financial data re-submission for an already-listed token. Your certified price will update the oracle price used for all trading, order matching and distribution calculations. The previous oracle price will be replaced immediately upon admin approval. Ensure your certified price reflects current market conditions and is supported by the submitted financial data.
                      </p>
                      {item.current_oracle && (
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-gray-400">Current oracle: <span className="font-mono text-white">${parseFloat(item.current_oracle).toFixed(4)}</span></span>
                          {enginePriceNum && <span className="text-gray-400">Engine reference: <span className="font-mono text-blue-300">${enginePriceNum.toFixed(4)}</span></span>}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={()=>handleSubmitReport('APPROVE')}
                    disabled={submitting || !certifiedPrice || !riskRating || !findings}
                    className="w-full py-3 rounded-xl font-bold text-white bg-green-700 hover:bg-green-600 disabled:opacity-40 transition-colors">
                    {submitting ? '⏳ Submitting report…' : '✅ Submit Audit Report & Approve'}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={()=>handleSubmitReport('REQUEST_INFO')} disabled={submitting}
                      className="py-2.5 rounded-xl font-semibold text-amber-300 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700 disabled:opacity-40 text-sm">
                      📋 Request More Information
                    </button>
                    <button onClick={()=>handleSubmitReport('REJECT')} disabled={submitting || !findings || !riskRating}
                      className="py-2.5 rounded-xl font-semibold text-red-300 bg-red-900/40 hover:bg-red-900/60 border border-red-700 disabled:opacity-40 text-sm">
                      ❌ Reject Submission
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


const mockCompleted = [
  { issuer:'ZimInfra Bond', symbol:'ZWIB', period:'Q4 2025', reviewed:'15 Jan 2026', outcome:'APPROVED', oracle_set:'$1.0050', notes:'All data verified. Bond pricing model within 0.5% of submission.' },
  { issuer:'Harare CBD REIT', symbol:'HCPR', period:'Q4 2025', reviewed:'10 Jan 2026', outcome:'APPROVED', oracle_set:'$1.0020', notes:'Minor correction to cap rate applied. Resubmission not required.' },
  { issuer:'Great Dyke Minerals', symbol:'GDMR', period:'Q3 2025', reviewed:'05 Oct 2025', outcome:'REJECTED', oracle_set:'—', notes:'Resource estimate methodology not JORC-compliant. Resubmission required.' },
];

export default function AuditorDashboard() {
  const { account, user, ready } = useWallet();
  const router = useRouter();

  const [queue,      setQueue]      = useState([]);
  const [completed, setCompleted] = useState([]);
  const [selItem,    setSelItem]    = useState(null);
  const [tab,        setTab]        = useState('queue');
  const [loading,    setLoading]    = useState(true);
  const [note,       setNote]       = useState('');
  const [offerings,         setOfferings]         = useState([]);
  const [selOffering,       setSelOffering]        = useState(null);
  const [offeringLoading,   setOfferingLoading]    = useState(false);
  const [offeringForm,      setOfferingForm]       = useState({ recommendation:'', auditor_notes:'', price_assessment:'' });
  const [offeringSubmitting,setOfferingSubmitting] = useState(false);
  const [actionMsg,  setActionMsg]  = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return null;
    const _u = JSON.parse(localStorage.getItem('user') || '{}');
if (!_u?.role) return;
   
if (!['AUDITOR','ADMIN'].includes(_u?.role)) { window.location.href = '/'; return; }
    loadData();
    loadOfferings();
  }, [ready]);

  const loadOfferings = async () => {
    setOfferingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/offerings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setOfferings(data);
    } catch {}
    setOfferingLoading(false);
  };

  const loadData = async () => {
    try {
      const res = await api.get('/submissions/pending');
      if (res.data?.length) {
        // Normalize the submission data to match the queue shape the auditor UI expects
        const normalized = res.data.map(s => {
          const daysPending = Math.floor((Date.now() - new Date(s.created_at)) / (1000*60*60*24));
          const isTokenisation = s.submission_type === 'TOKENISATION_APPLICATION';
          return {
            id:             s.id,
            issuer:         s.issuer_wallet ? `${s.issuer_wallet.slice(0,6)}…${s.issuer_wallet.slice(-4)}` : 'Unknown',
            token:          s.token_symbol,
            period:         s.period,
            submitted:      s.created_at,
            days_pending:   daysPending,
            completeness:   s.document_count > 0 ? Math.min(100, 60 + s.document_count * 10) : 40,
            priority:       daysPending > 7 ? 'HIGH' : daysPending > 3 ? 'MEDIUM' : 'LOW',
            status:         s.status,
            reference:      s.reference_number,
            type:           isTokenisation ? 'TOKENISATION' : 'FINANCIAL_DATA',
            document_count: s.document_count || 0,
            docs:           Array.from({length: s.document_count||0}, (_,i) => `Document ${i+1}`),
            data:           { type: s.submission_type, entity: s.entity_name, reference: s.reference_number },
            assigned_auditor: s.assigned_auditor || null,
            current_oracle: 1.0000,
            model_price:    1.0000,
            flags:          daysPending > 7 ? [`Submission pending for ${daysPending} days`] : [],
            // Financial fields will load on detail view
            revenue:        null,
            ebitda:         null,
          };
        });
        setQueue(normalized);
        // Also fetch completed reviews
api.get('/auditor/completed').then(r => {
  if (Array.isArray(r.data) && r.data.length) {
    setCompleted(r.data.map(s => {
      let auditReport = {};
      try { auditReport = typeof s.audit_report === 'string' ? JSON.parse(s.audit_report) : (s.audit_report || {}); } catch {}
      return {
        issuer:     s.issuer_email || s.entity_name || 'Unknown',
        symbol:     s.token_symbol,
        period:     s.period || '—',
        reviewed:   s.reviewed_at ? new Date(s.reviewed_at).toLocaleDateString('en-GB') : '—',
        outcome:    s.status === 'AUDITOR_APPROVED' || s.status === 'ADMIN_APPROVED' ? 'APPROVED' : 'REJECTED',
        oracle_set: auditReport.certifiedPrice ? `$${parseFloat(auditReport.certifiedPrice).toFixed(4)}` : '—',
        notes:      auditReport.findings || s.admin_notes || '—',
      };
    }));
  }
}).catch(() => {});
      }
    } catch(e) { console.error('Failed to load queue:', e); }
    finally { setLoading(false); }
  };

  const doAction = async (id, action, certifiedPrice, valuationMethod) => {
    const item = queue.find(q=>q.id===id);
    if (!item) return;
    try {
      await api.put(`/submissions/${id}/status`, {
        status: action,
        notes:  note ||
          (action==='APPROVED' && certifiedPrice
            ? `Certified price: $${parseFloat(certifiedPrice).toFixed(4)}. Method: ${valuationMethod||'Independent valuation'}. Approved by auditor on ${new Date().toLocaleDateString()}.`
            : null),
      });
    } catch(e) { console.error('Action failed:', e); }
    const msgs = {
      APPROVED:       `✅ ${item.entity_name||item.token||item.period} — APPROVED. Oracle price $${certifiedPrice ? parseFloat(certifiedPrice).toFixed(4) : 'set'}. Issuer notified.`,
      REJECTED:       `❌ ${item.entity_name||item.token} — REJECTED. Reason submitted to issuer.`,
      INFO_REQUESTED: `📋 Additional information requested. Notes sent to issuer.`,
    };
    setActionMsg({ type: action==='APPROVED'?'success':action==='REJECTED'?'error':'info', text: msgs[action] });
    setQueue(q=>q.filter(i=>i.id!==id));
    setSelItem(null);
    setNote('');
    setTimeout(()=>setActionMsg(null), 6000);
  };

  if (typeof window === 'undefined') return null;
  if (!JSON.parse(localStorage.getItem('user') || '{}')?.role) return null;

  const pending  = queue.length;
  const overdue  = queue.filter(q=>q.days_pending>7).length;
  const doneMonth = completed.filter(c=>c.outcome==='APPROVED').length;

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
              <p className="text-gray-500 text-xs">Auditor Portal</p>
            </div>
            <span className="ml-2 text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded-full">AUDITOR</span>
          </div>
          <nav className="flex gap-1">
            {['queue','valuation','completed','flags','offerings'].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}>
                {t}
                {t==='queue'&&pending>0&&<span className="ml-1 bg-red-600 text-white text-xs px-1.5 rounded-full">{pending}</span>}
                {t==='flags'&&queue.filter(q=>q.flags.length>0).length>0&&<span className="ml-1 bg-amber-600 text-white text-xs px-1.5 rounded-full">{queue.filter(q=>q.flags.length>0).length}</span>}
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
        {actionMsg && (
          <div className={`rounded-xl p-4 border mb-6 ${actionMsg.type==='success'?'bg-green-900/40 border-green-700 text-green-300':actionMsg.type==='error'?'bg-red-900/40 border-red-700 text-red-300':'bg-blue-900/40 border-blue-700 text-blue-300'}`}>
            {actionMsg.text}
          </div>
        )}

        {/* ══════ KPI ROW ══════ */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label:'Pending Reviews',   value:pending,   icon:'⏳', color:pending>0?'text-amber-400':'text-white' },
            { label:'Overdue (>7 days)', value:overdue,   icon:'🚨', color:overdue>0?'text-red-400':'text-green-400' },
            { label:'Approved This Month', value:doneMonth, icon:'✅', color:'text-green-400' },
            { label:'Avg Review Time',   value:'4.2 days', icon:'📊', color:'text-white' },
          ].map((k,i)=>(
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
                <span className="text-xl">{k.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ══════ TAB: QUEUE ══════ */}
        {tab==='queue' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Queue list */}
            <div className="xl:col-span-2 space-y-3">
              <h2 className="font-bold text-lg">Review Queue</h2>
              {queue.length === 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                  <p className="text-4xl mb-3">🎉</p>
                  <p className="text-gray-400">Queue is empty — all submissions reviewed!</p>
                </div>
              )}
              {queue.map(item=>(
                <div key={item.id} onClick={()=>setSelItem(selItem?.id===item.id?null:item)}
                  className={`rounded-xl p-4 border cursor-pointer transition-all ${
                    selItem?.id===item.id?'border-blue-500 bg-blue-900/20':PRIORITY_BG[item.priority]
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm">{item.entity_name||item.issuer}</p>
                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{item.symbol}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          item.priority==='HIGH'?'bg-red-900/60 text-red-300':
                          item.priority==='MEDIUM'?'bg-amber-900/60 text-amber-300':
                          'bg-gray-700 text-gray-400'
                        }`}>{item.priority}</span>
                          {item.type === 'FINANCIAL_DATA' && (
                            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-700/50">
                              🔄 Quarterly Re-certification
                            </span>
                          )}
                        {item.type==='TOKENISATION'&&<span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">TOKENISATION</span>}
                        {item.assigned_auditor&&<span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">✓ Assigned</span>}
                      </div>
                      <p className="text-gray-500 text-xs">{item.asset_class} · {item.period}</p>
                      <p className="text-gray-600 text-xs">Submitted {dt(item.submitted)} · {item.days_pending} days pending</p>
                    </div>
                  </div>

                  {/* Completeness */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Data completeness</span>
                      <span className={`text-xs font-bold ${item.completeness>=90?'text-green-400':item.completeness>=70?'text-yellow-400':'text-red-400'}`}>{item.completeness}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{
                        width:`${item.completeness}%`,
                        background:item.completeness>=90?GREEN:item.completeness>=70?GOLD:'#dc2626'
                      }}/>
                    </div>
                  </div>

                  {/* Flags */}
                  {item.flags.length>0 && (
                    <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-2 mt-2">
                      {item.flags.map((f,i)=><p key={i} className="text-amber-300 text-xs">⚠️ {f}</p>)}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-600">{(item.docs||[]).length} docs</span>
                    </div>
                    <span className="text-xs text-blue-400">{selItem?.id===item.id?'▲ Collapse':'▼ Review →'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Review panel */}
            <div className="xl:col-span-3">
              {!selItem ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center h-64 flex flex-col items-center justify-center">
                  <p className="text-3xl mb-3">👈</p>
                  <p className="text-gray-400">Select a submission from the queue to review</p>
                </div>
              ) : (
                <AuditReviewPanel
                  item={selItem}
                  note={note} setNote={setNote}
                  doAction={doAction}
                  userRole={user?.role}
                  account={account}
                />
              )}
            </div>
          </div>
        )}

        {/* ══════ TAB: VALUATION ══════ */}
        {tab==='valuation' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Valuation Model Reference</h2>
            <p className="text-gray-500 text-sm">The platform uses six valuation models. Each model takes issuer-submitted data and produces a reference price per token. You review the model output and either approve it (setting the oracle price) or request changes.</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {[
                { name:'NAV + Cap Rate',        asset:'Real Estate', formula:'Net Rental Income ÷ Cap Rate = Property Value → Value ÷ Token Supply = Token Price', inputs:'Net rental income, cap rate, total assets, total liabilities' },
                { name:'Resource NPV',          asset:'Mining',      formula:'(Resource Estimate × PGM Price × Recovery) − CapEx → NPV at discount rate ÷ Token Supply', inputs:'JORC resource estimate, spot prices, operating costs, discount rate' },
                { name:'Bond Present Value',    asset:'Bond/Debt',   formula:'Σ(Coupon/(1+YTM)^t) + Face Value/(1+YTM)^T ÷ Token Supply', inputs:'Face value, coupon rate, yield to maturity, maturity date' },
                { name:'DCF + Revenue Multiple',asset:'Equity',      formula:'(FCF ÷ (WACC − g)) weighted with Revenue × Multiple ÷ Token Supply', inputs:'Revenue, EBITDA margin, growth rate, WACC, exit multiple' },
                { name:'Infrastructure DCF',    asset:'Infrastructure', formula:'Σ(Revenue − OpEx − CapEx)/(1+r)^t ÷ Token Supply', inputs:'Concession revenue, operating costs, remaining concession term, discount rate' },
                { name:'NAV + Cap Rate (REIT)', asset:'REIT',        formula:'Weighted portfolio NAV across all properties ÷ Token Supply', inputs:'Per-property: rental income, cap rate, occupancy, lease expiry profile' },
              ].map((m,i)=>(
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold">{m.name}</p>
                      <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{m.asset}</span>
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Formula (simplified)</p>
                    <p className="text-xs font-mono text-yellow-300">{m.formula}</p>
                  </div>
                  <p className="text-xs text-gray-500"><span className="text-gray-400 font-semibold">Required inputs: </span>{m.inputs}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ TAB: COMPLETED ══════ */}
        {tab==='completed' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Review History</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/50">
                    {['Issuer','Symbol','Period','Reviewed','Outcome','Oracle Set','Auditor Notes'].map(h=>(
                      <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completed.map((c,i)=>(
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3 px-4 font-medium">{c.issuer}</td>
                      <td className="py-3 px-4"><span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{c.symbol}</span></td>
                      <td className="py-3 px-4 text-gray-400">{c.period}</td>
                      <td className="py-3 px-4 text-gray-400">{c.reviewed}</td>
                      <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${COMPLETION_COLORS[c.outcome]}`}>{c.outcome}</span></td>
                      <td className="py-3 px-4 font-mono text-yellow-400">{c.oracle_set}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-xs truncate">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='offerings' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Primary Offering Reviews</h2>
              <p className="text-gray-500 text-sm mt-0.5">Review issuer primary offering proposals and submit your recommendation to admin.</p>
            </div>

            {offeringLoading && <div className="text-center py-8 text-gray-500 text-sm">⏳ Loading offerings…</div>}

            {!offeringLoading && offerings.length === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">📋</p>
                <p className="font-semibold mb-1">No offerings pending review</p>
                <p className="text-gray-500 text-sm">Offering proposals submitted by issuers will appear here for your review.</p>
              </div>
            )}

            {/* Offering list */}
            {!offeringLoading && offerings.length > 0 && !selOffering && (
              <div className="space-y-3">
                {offerings.map(o=>(
                  <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-bold text-blue-300">{o.symbol}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            o.status==='PENDING_APPROVAL'?'bg-amber-900/50 text-amber-300':
                            o.status==='AUDITOR_REVIEWED'?'bg-blue-900/50 text-blue-300':
                            'bg-gray-700 text-gray-400'
                          }`}>{o.status?.replace('_',' ')}</span>
                          {o.auditor_recommendation && (
                            <span className={`text-xs font-bold ${
                              o.auditor_recommendation==='APPROVE'?'text-green-400':
                              o.auditor_recommendation==='REJECT'?'text-red-400':'text-amber-400'
                            }`}>My recommendation: {o.auditor_recommendation?.replace('_',' ')}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-gray-500">Offering Price</p><p className="font-bold text-white">${parseFloat(o.offering_price_usd||0).toFixed(4)}</p></div>
                          <div><p className="text-gray-500">Target Raise</p><p className="font-bold text-white">${parseFloat(o.target_raise_usd||0).toLocaleString()}</p></div>
                          <div><p className="text-gray-500">Total Tokens</p><p className="font-bold text-white">{parseInt(o.total_tokens_offered||0).toLocaleString()}</p></div>
                          <div><p className="text-gray-500">Deadline</p><p className="font-bold text-white">{new Date(o.subscription_deadline).toLocaleDateString('en-GB')}</p></div>
                        </div>
                        {o.offering_rationale && (
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed italic">"{o.offering_rationale}"</p>
                        )}
                      </div>
                      <button onClick={()=>{ setSelOffering(o); setOfferingForm({ recommendation: o.auditor_recommendation||'', auditor_notes: o.auditor_notes||'', price_assessment: o.price_assessment||'' }); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60 flex-shrink-0">
                        {o.status==='AUDITOR_REVIEWED'?'View Review':'Review →'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Offering review form */}
            {selOffering && (
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <button onClick={()=>setSelOffering(null)} className="text-gray-400 hover:text-white text-sm">← Back</button>
                  <h3 className="font-bold text-lg">{selOffering.symbol} — Offering Review</h3>
                </div>

                {/* Offering details */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm text-gray-300 mb-3">📋 Offering Terms Proposed by Issuer</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    {[
                      ['Token', selOffering.symbol],
                      ['Issuer', selOffering.issuer_name || selOffering.issuer_email || '—'],
                      ['Offering Price', `$${parseFloat(selOffering.offering_price_usd||0).toFixed(4)}`],
                      ['Oracle Price', selOffering.oracle_price ? `$${parseFloat(selOffering.oracle_price).toFixed(4)}` : '—'],
                      ['Target Raise', `$${parseFloat(selOffering.target_raise_usd||0).toLocaleString()}`],
                      ['Total Tokens', parseInt(selOffering.total_tokens_offered||0).toLocaleString()],
                      ['Min Subscription', `$${parseFloat(selOffering.min_subscription_usd||0).toFixed(2)}`],
                      ['Deadline', new Date(selOffering.subscription_deadline).toLocaleDateString('en-GB')],
                    ].map(([label, value])=>(
                      <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                        <p className="font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  {selOffering.offering_rationale && (
                    <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Issuer Rationale</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{selOffering.offering_rationale}</p>
                    </div>
                  )}
                  {selOffering.oracle_price && (
                    <div className={`mt-3 rounded-lg p-3 text-xs ${
                      Math.abs(parseFloat(selOffering.offering_price_usd) - parseFloat(selOffering.oracle_price)) / parseFloat(selOffering.oracle_price) > 0.1
                        ? 'bg-red-900/20 border border-red-800/40 text-red-300'
                        : 'bg-green-900/20 border border-green-800/40 text-green-300'
                    }`}>
                      {Math.abs(parseFloat(selOffering.offering_price_usd) - parseFloat(selOffering.oracle_price)) / parseFloat(selOffering.oracle_price) > 0.1
                        ? `⚠️ Offering price deviates more than 10% from oracle price ($${parseFloat(selOffering.oracle_price).toFixed(4)}). Review carefully.`
                        : `✓ Offering price is within 10% of oracle price ($${parseFloat(selOffering.oracle_price).toFixed(4)}).`
                      }
                    </div>
                  )}
                </div>

                {/* Review form */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                  <h4 className="font-semibold text-sm text-gray-300">🔍 Your Review</h4>

                  {/* Recommendation */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Recommendation *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value:'APPROVE',          label:'✅ Approve',          color:'green' },
                        { value:'REQUEST_CHANGES',  label:'⚠️ Request Changes',  color:'amber' },
                        { value:'REJECT',           label:'❌ Reject',           color:'red'   },
                      ].map(opt=>(
                        <div key={opt.value}
                          onClick={()=>setOfferingForm(f=>({...f, recommendation: opt.value}))}
                          className={`cursor-pointer rounded-xl p-3 border text-center transition-all text-sm font-semibold ${
                            offeringForm.recommendation === opt.value
                              ? opt.color==='green' ? 'border-green-500 bg-green-900/30 text-green-300'
                              : opt.color==='amber' ? 'border-amber-500 bg-amber-900/30 text-amber-300'
                              : 'border-red-500 bg-red-900/30 text-red-300'
                              : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-500'
                          }`}>
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price assessment */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Price Assessment</label>
                    <input
                      value={offeringForm.price_assessment}
                      onChange={e=>setOfferingForm(f=>({...f, price_assessment: e.target.value}))}
                      placeholder="e.g. Offering price is fair and consistent with Q4 2025 certified oracle price of $1.0240"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600"/>
                  </div>

                  {/* Auditor notes */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Detailed Findings *</label>
                    <textarea
                      rows={5}
                      value={offeringForm.auditor_notes}
                      onChange={e=>setOfferingForm(f=>({...f, auditor_notes: e.target.value}))}
                      placeholder="Document your review findings — price justification, financial basis for the raise, any conditions or concerns, and your overall assessment."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600 resize-none"/>
                  </div>

                  <button
                    onClick={async()=>{
                      if (!offeringForm.recommendation) { alert('Please select a recommendation.'); return; }
                      if (!offeringForm.auditor_notes)  { alert('Please enter your findings.'); return; }
                      setOfferingSubmitting(true);
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/offerings/${selOffering.id}/auditor-review`, {
                          method: 'PUT',
                          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify(offeringForm)
                        });
                        const data = await res.json();
                        if (!res.ok) { alert(data.error || 'Submission failed'); setOfferingSubmitting(false); return; }
                        setActionMsg({ type:'success', text:`✅ Review submitted: ${offeringForm.recommendation}. Admin has been notified.` });
                        setTimeout(()=>setActionMsg(null), 4000);
                        setSelOffering(null);
                        loadOfferings();
                      } catch { alert('Could not submit review. Is the API running?'); }
                      setOfferingSubmitting(false);
                    }}
                    disabled={offeringSubmitting || !offeringForm.recommendation || !offeringForm.auditor_notes}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40 bg-blue-700 hover:bg-blue-600">
                    {offeringSubmitting ? '⏳ Submitting…' : '📤 Submit Auditor Review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ TAB: FLAGS ══════ */}
        {tab==='flags' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Compliance Flags</h2>
            <p className="text-gray-500 text-sm">Automatic flags raised by the valuation engine and compliance monitors.</p>
            {queue.filter(q=>q.flags.length>0).map(item=>(
              <div key={item.id} className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold">{item.issuer}</span>
                      <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{item.symbol}</span>
                      <span className="text-gray-500 text-xs">{item.period}</span>
                    </div>
                    {item.flags.map((f,i)=>(
                      <p key={i} className="text-amber-300 text-sm flex items-start gap-2">
                        <span>⚠️</span><span>{f}</span>
                      </p>
                    ))}
                  </div>
                  <button onClick={()=>{setSelItem(item);setTab('queue');}}
                    className="text-xs bg-amber-800 hover:bg-amber-700 text-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap ml-4">
                    Review Submission
                  </button>
                </div>
              </div>
            ))}
            {queue.filter(q=>q.flags.length>0).length===0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">✅</p>
                <p className="text-gray-400">No active compliance flags</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
