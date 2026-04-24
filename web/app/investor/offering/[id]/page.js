'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const NAVY = '#1A3C5E';
const GOLD = '#C8972B';

function fmt(n) {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function daysLeft(deadline) {
  const diff = new Date(deadline) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default function OfferingPitchPage() {
  const router  = useRouter();
  const params  = useParams();
  const id      = params?.id;

  const [offering,    setOffering]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [subAmount,   setSubAmount]   = useState('');
  const [subLoading,  setSubLoading]  = useState(false);
  const [msg,         setMsg]         = useState(null);
  const [activeTab,   setActiveTab]   = useState('overview');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    fetch(`${API}/offerings/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (data.error) { router.push('/investor'); return; }
      setOffering(data);
    }).catch(() => router.push('/investor'))
    .finally(() => setLoading(false));
  }, [id]);

  async function subscribe() {
    if (!subAmount || parseFloat(subAmount) <= 0) {
      setMsg({ type: 'error', text: 'Please enter a valid amount.' }); return;
    }
    setSubLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API}/offerings/${id}/subscribe`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount_usd: parseFloat(subAmount) }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `✅ ${data.message}` });
        setSubAmount('');
        const t2 = localStorage.getItem('token');
        fetch(`${API}/offerings/${id}`, { headers: { Authorization: `Bearer ${t2}` } })
          .then(r => r.json()).then(setOffering).catch(() => {});
      } else {
        setMsg({ type: 'error', text: data.error || 'Subscription failed.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setSubLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
      <p className="text-gray-400">Loading offering...</p>
    </div>
  );

  if (!offering) return null;

  const pct         = Math.min(100, (parseFloat(offering.total_raised_usd || 0) / parseFloat(offering.target_raise_usd)) * 100);
  const days        = daysLeft(offering.subscription_deadline);
  const subData     = offering.submission_data
    ? (typeof offering.submission_data === 'string' ? JSON.parse(offering.submission_data) : offering.submission_data)
    : {};
  const docs        = subData?.documents || [];
  const auditReport = offering.audit_report
    ? (typeof offering.audit_report === 'string' ? JSON.parse(offering.audit_report) : offering.audit_report)
    : null;

  const TABS = [
    { key: 'overview',  label: 'Overview' },
    { key: 'financials',label: 'Financials' },
    { key: 'documents', label: `Documents (${docs.length})` },
    { key: 'audit',     label: 'Audit Report' },
    { key: 'subscribe', label: '🏦 Subscribe' },
  ];

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-bold text-xl">{offering.token_symbol}</h1>
            <span className="text-gray-400 text-sm">{offering.token_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300 border border-green-700/40">OPEN</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{offering.asset_type}</span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">{offering.company_name} · {offering.sector} · {offering.jurisdiction}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-yellow-400">${parseFloat(offering.offering_price_usd).toFixed(4)}</p>
          <p className="text-xs text-gray-500">per token</p>
        </div>
      </div>

      {/* Progress banner */}
      <div className="bg-gray-900/60 border-b border-gray-800 px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span className="text-green-400 font-semibold">{fmt(offering.total_raised_usd)} raised</span>
            <span>Target: {fmt(offering.target_raise_usd)}</span>
            <span className={days <= 7 ? 'text-red-400 font-semibold' : ''}>{days} days left</span>
            <span>{offering.subscriber_count} investors</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{pct.toFixed(1)}% funded</span>
            <span>Deadline: {new Date(offering.subscription_deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Notification */}
        {msg && (
          <div className={`rounded-xl p-4 border mb-4 text-sm ${msg.type === 'success' ? 'bg-green-900/40 border-green-700 text-green-300' : 'bg-red-900/40 border-red-700 text-red-300'}`}>
            {msg.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === t.key
                  ? 'border-yellow-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-bold text-base mb-3">About {offering.company_name}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {offering.company_description || 'No company description provided.'}
                  </p>
                  {offering.issuer_email && (
                    <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Issuer Contact</p>
                        <p className="text-white font-medium">{offering.issuer_name}</p>
                        <a href={`mailto:${offering.issuer_email}`} className="text-blue-400 hover:text-blue-300 text-xs">{offering.issuer_email}</a>
                      </div>
                      {offering.issuer_city && (
                        <div>
                          <p className="text-gray-500 text-xs">Location</p>
                          <p className="text-white text-sm">{offering.issuer_city}, {offering.issuer_country}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-bold text-base mb-3">Offering Rationale</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{offering.offering_rationale || 'No rationale provided.'}</p>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-bold text-base mb-3">Key Terms</h3>
                  <div className="space-y-2">
                    {[
                      ['Offering Price',        `$${parseFloat(offering.offering_price_usd).toFixed(4)} per token`],
                      ['Target Raise',          fmt(offering.target_raise_usd)],
                      ['Total Tokens Offered',  parseInt(offering.total_tokens_offered).toLocaleString()],
                      ['Min Subscription',      fmt(offering.min_subscription_usd)],
                      ['Max Subscription',      offering.max_subscription_usd ? fmt(offering.max_subscription_usd) : 'No limit'],
                      ['Issuance Fee',          `${(parseFloat(offering.issuance_fee_rate||0.02)*100).toFixed(1)}% of proceeds`],
                      ['Registration',          offering.registration_number || '—'],
                      ['Jurisdiction',          offering.jurisdiction || '—'],
                      ['Sector',                offering.sector || '—'],
                      ['Asset Type',            offering.asset_type || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                        <span className="text-gray-400 text-sm">{label}</span>
                        <span className="text-white text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* FINANCIALS TAB */}
            {activeTab === 'financials' && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-base mb-4">Financial Data</h3>
                {subData.financialData ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(subData.financialData).filter(([,v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => (
                      <div key={k} className="bg-gray-800/60 rounded-xl p-3">
                        <p className="text-gray-500 text-xs capitalize mb-1">{k.replace(/([A-Z])/g,' $1').trim()}</p>
                        <p className="font-semibold text-white text-sm">
                          {['revenueTTM','ebitdaTTM','freeCashFlow','totalDebt','cash','propertyValuation','netOperatingIncome','faceValue','annualRevenue'].includes(k)
                            ? fmt(v) : v}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No financial data available.</p>
                )}
              </div>
            )}

            {/* DOCUMENTS TAB */}
            {activeTab === 'documents' && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-base mb-4">Supporting Documents</h3>
                {docs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No documents uploaded.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc, i) => {
                      const ext  = (doc.name || '').split('.').pop()?.toLowerCase();
                      const icon = ext === 'pdf' ? '📄' : ['xlsx','xls'].includes(ext) ? '📊' : ['docx','doc'].includes(ext) ? '📝' : '📎';
                      return (
                        <div key={i} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{icon}</span>
                            <div>
                              <p className="text-sm text-white font-medium">{doc.name}</p>
                              {doc.size && <p className="text-xs text-gray-500">{(doc.size/1024).toFixed(0)} KB</p>}
                            </div>
                          </div>
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-800/50">
                              ⬇ Download
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">Unavailable</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* AUDIT REPORT TAB */}
            {activeTab === 'audit' && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-base mb-4">Auditor Certification</h3>
                {auditReport ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Certified Price',    `$${parseFloat(auditReport.certifiedPrice || 0).toFixed(4)}`],
                        ['Risk Rating',        auditReport.riskRating || '—'],
                        ['Listing Type',       auditReport.suggestedListingType?.replace('_',' ') || '—'],
                        ['Annual Revenue',     auditReport.annualRevenue ? fmt(auditReport.annualRevenue) : '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-gray-800/60 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">{label}</p>
                          <p className="font-semibold text-white text-sm">{value}</p>
                        </div>
                      ))}
                    </div>
                    {auditReport.auditFindings && (
                      <div>
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Audit Findings</p>
                        <p className="text-gray-300 text-sm leading-relaxed bg-gray-800/40 rounded-xl p-4">{auditReport.auditFindings}</p>
                      </div>
                    )}
                    {auditReport.valuationMethodology && (
                      <div>
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Valuation Methodology</p>
                        <p className="text-gray-300 text-sm leading-relaxed bg-gray-800/40 rounded-xl p-4">{auditReport.valuationMethodology}</p>
                      </div>
                    )}
                    {auditReport.caveats && (
                      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
                        <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">Caveats & Conditions</p>
                        <p className="text-gray-300 text-sm">{auditReport.caveats}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Audit report not available.</p>
                )}
              </div>
            )}

            {/* SUBSCRIBE TAB */}
            {activeTab === 'subscribe' && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-bold text-base mb-4">Subscribe to {offering.token_symbol}</h3>
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 mb-4 text-xs text-blue-300">
                  ℹ️ Your subscription will be deducted from your USD fiat wallet balance. A {(parseFloat(offering.issuance_fee_rate||0.02)*100).toFixed(1)}% issuance fee applies to proceeds raised.
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Subscription Amount (USD) · Min {fmt(offering.min_subscription_usd)}
                      {offering.max_subscription_usd ? ` · Max ${fmt(offering.max_subscription_usd)}` : ''}
                    </label>
                    <input type="number" value={subAmount} onChange={e => setSubAmount(e.target.value)}
                      placeholder={`e.g. ${parseFloat(offering.min_subscription_usd||5000).toLocaleString()}`}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500"/>
                  </div>
                  {subAmount && parseFloat(subAmount) > 0 && (
                    <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Tokens you receive</span>
                        <span className="font-bold text-green-400">{(parseFloat(subAmount)/parseFloat(offering.offering_price_usd)).toLocaleString(undefined,{maximumFractionDigits:2})} {offering.token_symbol}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Price per token</span>
                        <span className="text-white">${parseFloat(offering.offering_price_usd).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                        <span className="text-gray-400">Total deducted from wallet</span>
                        <span className="font-bold text-white">${parseFloat(subAmount).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  <button onClick={subscribe} disabled={subLoading || !subAmount}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-gray-900 disabled:opacity-50 transition-all"
                    style={{background: GOLD}}>
                    {subLoading ? '⏳ Processing...' : `✅ Confirm Subscription — $${parseFloat(subAmount||0).toLocaleString()}`}
                  </button>
                  <p className="text-xs text-gray-600 text-center">
                    By subscribing you confirm you have read the offering documents and understand the risks involved.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick subscribe */}
            {activeTab !== 'subscribe' && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-sm font-semibold mb-3">Quick Subscribe</p>
                <input type="number" value={subAmount} onChange={e => setSubAmount(e.target.value)}
                  placeholder={`Min ${fmt(offering.min_subscription_usd)}`}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 mb-2"/>
                {subAmount && parseFloat(subAmount) > 0 && (
                  <p className="text-xs text-green-400 mb-2">
                    ≈ {(parseFloat(subAmount)/parseFloat(offering.offering_price_usd)).toLocaleString(undefined,{maximumFractionDigits:2})} {offering.token_symbol} tokens
                  </p>
                )}
                <button onClick={subscribe} disabled={subLoading || !subAmount}
                  className="w-full py-2.5 rounded-lg text-sm font-bold text-gray-900 disabled:opacity-50"
                  style={{background: GOLD}}>
                  {subLoading ? '⏳' : '✅ Subscribe'}
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              {[
                ['Status',       offering.status],
                ['Subscribers',  offering.subscriber_count],
                ['Raised',       fmt(offering.total_raised_usd)],
                ['Target',       fmt(offering.target_raise_usd)],
                ['Days Left',    `${days} days`],
                ['Oracle Price', `$${parseFloat(offering.current_price_usd||0).toFixed(4)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Approved by */}
            {offering.admin_notes && (
              <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-4">
                <p className="text-green-400 text-xs font-semibold mb-1">✅ Admin Approved</p>
                <p className="text-gray-400 text-xs">{offering.admin_notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
