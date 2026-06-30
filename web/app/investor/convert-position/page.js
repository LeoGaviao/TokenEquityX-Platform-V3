'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
import { useWallet } from '../../../hooks/useWallet';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const dt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const ASSET_TYPES = ['EQUITY','BOND','REIT','INFRASTRUCTURE','COMMODITY','AGRICULTURE'];

const STATUS_STEPS = [
  { key: 'PENDING',                   label: 'Under Review',          icon: '🔍' },
  { key: 'AWAITING_LENDER_CONSENT',   label: 'Awaiting Lender Consent', icon: '📝' },
  { key: 'AUDITOR_APPROVED',          label: 'Auditor Approved',      icon: '✅' },
  { key: 'LIVE',                      label: 'Tokens Live',           icon: '🟢' },
];

function FileField({ label, name, hint, onChange, required }) {
  const [filename, setFilename] = useState('');
  return (
    <div>
      <label className="text-xs font-semibold text-gray-300 block mb-1">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${filename ? 'border-green-600 bg-green-900/20' : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'}`}>
        <span className="text-xl">{filename ? '✅' : '📎'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-300 truncate">{filename || 'Click to select file'}</p>
          {!filename && <p className="text-xs text-gray-600">PDF, JPG, PNG — max 10 MB</p>}
        </div>
        <input type="file" name={name} accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={e => { const f = e.target.files[0]; setFilename(f?.name || ''); onChange(e); }}/>
      </label>
    </div>
  );
}

export default function ConvertPositionPage() {
  const { user, ready } = useWallet();
  const router = useRouter();

  const [jurisdictions,  setJurisdictions]  = useState([]);
  const [loadingJ,       setLoadingJ]       = useState(true);
  const [mySubmissions,  setMySubmissions]  = useState([]);
  const [loadingS,       setLoadingS]       = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [submitted,      setSubmitted]      = useState(null); // { referenceNumber, tokenSymbol, applicationStatus, lockupDays }
  const [error,          setError]          = useState('');

  const [form, setForm] = useState({
    spv_jurisdiction: '', underlying_owner_name: '', existing_position_description: '',
    existing_position_value_usd: '', asset_type: 'EQUITY', token_symbol: '',
    token_name: '', total_supply: '', lender_consent_required: false,
  });
  const [files, setFiles] = useState({ ownership_proof: null, transfer_agreement: null, lender_consent: null });

  useEffect(() => {
    fetch(`${API}/submissions/jurisdictions/enabled`)
      .then(r => r.json()).then(d => { setJurisdictions(Array.isArray(d) ? d : []); setLoadingJ(false); })
      .catch(() => { setJurisdictions([]); setLoadingJ(false); });
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    const t = localStorage.getItem('token');
    fetch(`${API}/submissions/my`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        const convs = (Array.isArray(d) ? d : []).filter(s => s.submission_type === 'EXISTING_POSITION_CONVERSION');
        setMySubmissions(convs);
        setLoadingS(false);
      })
      .catch(() => setLoadingS(false));
  }, [ready, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.spv_jurisdiction) { setError('Please select a jurisdiction.'); return; }
    if (!files.ownership_proof) { setError('Proof of ownership document is required.'); return; }
    if (!files.transfer_agreement) { setError('Transfer/assignment agreement is required.'); return; }

    setSubmitting(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (files.ownership_proof)   fd.append('ownership_proof',    files.ownership_proof);
    if (files.transfer_agreement) fd.append('transfer_agreement', files.transfer_agreement);
    if (files.lender_consent)    fd.append('lender_consent',     files.lender_consent);

    const t = localStorage.getItem('token');
    try {
      const r = await fetch(`${API}/submissions/conversion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Submission failed.'); setSubmitting(false); return; }
      setSubmitted(d);
    } catch (err) {
      setError('Network error — please try again.');
    }
    setSubmitting(false);
  };

  if (!ready) return null;
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Please connect your wallet to continue.</p>
          <button onClick={() => router.push('/')} className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold">Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/investor')} className="text-gray-400 hover:text-white text-sm">← Dashboard</button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Convert Existing Position</h1>
          <p className="text-xs text-gray-500">Tokenise and list a pre-existing equity or debt position on the secondary market</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* My existing conversion submissions */}
        {!loadingS && mySubmissions.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm mb-4 text-gray-200">Your Conversion Requests</h2>
            <div className="space-y-4">
              {mySubmissions.map(s => {
                const stepIdx = STATUS_STEPS.findIndex(st => st.key === s.application_status);
                return (
                  <div key={s.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-blue-300">{s.token_symbol}</p>
                        <p className="text-xs text-gray-500">Ref: {s.reference_number} · Submitted {dt(s.created_at)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${s.application_status === 'LIVE' ? 'bg-green-900/50 text-green-300 border-green-700/50' : s.application_status === 'AWAITING_LENDER_CONSENT' ? 'bg-amber-900/50 text-amber-300 border-amber-700/50' : 'bg-blue-900/50 text-blue-300 border-blue-700/50'}`}>
                        {STATUS_STEPS.find(st => st.key === s.application_status)?.label || s.application_status}
                      </span>
                    </div>
                    {/* Status track */}
                    <div className="flex gap-1 items-center">
                      {STATUS_STEPS.map((st, i) => {
                        const done = i <= stepIdx;
                        const active = i === stepIdx;
                        return (
                          <div key={st.key} className="flex items-center gap-1 flex-1 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${done ? 'bg-green-700' : 'bg-gray-700'} ${active ? 'ring-2 ring-green-400' : ''}`}>
                              {done ? '✓' : <span className="text-gray-500">{i + 1}</span>}
                            </div>
                            <p className={`text-xs truncate ${done ? 'text-green-400' : 'text-gray-600'}`}>{st.label}</p>
                            {i < STATUS_STEPS.length - 1 && <div className={`h-px flex-1 shrink ${done && i < stepIdx ? 'bg-green-700' : 'bg-gray-700'}`}/>}
                          </div>
                        );
                      })}
                    </div>
                    {s.application_status === 'AWAITING_LENDER_CONSENT' && (
                      <div className="mt-3 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-300">
                        Action required: Upload signed lender consent documentation via your TokenEquityX account manager.
                      </div>
                    )}
                    {s.lockup_end_date && (
                      <p className="text-xs text-gray-500 mt-2">Lockup ends: {dt(s.lockup_end_date)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Success state */}
        {submitted && (
          <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="font-bold text-lg text-green-300 mb-1">Conversion Request Submitted</h2>
            <p className="text-sm text-gray-300 mb-4">{submitted.message}</p>
            <div className="bg-gray-900 rounded-xl p-4 text-left space-y-2 mb-4">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Reference</span><span className="font-mono text-white">{submitted.referenceNumber}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Token Symbol</span><span className="font-bold text-blue-300">{submitted.tokenSymbol}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Status</span><span>{submitted.applicationStatus}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Lockup Period</span><span>{submitted.lockupDays} days after approval</span></div>
            </div>
            <button onClick={() => router.push('/investor')} className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold">Back to Dashboard</button>
          </div>
        )}

        {/* Form */}
        {!submitted && (
          <>
            {/* Jurisdiction unavailability notice */}
            {!loadingJ && jurisdictions.length === 0 && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">🌍</div>
                <h2 className="font-bold text-amber-300 mb-2">Not Yet Available in Your Jurisdiction</h2>
                <p className="text-sm text-gray-400 mb-3">
                  Existing position conversion is currently undergoing legal review and is not yet available in any jurisdiction. We will notify you when it becomes available.
                </p>
                <p className="text-xs text-gray-600">For Zimbabwe: Pending review by Dickson Mundia (Mundia and Mudhara).</p>
              </div>
            )}

            {!loadingJ && jurisdictions.length > 0 && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* How it works */}
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
                  <h3 className="font-semibold text-sm text-blue-300 mb-2">How Existing Position Conversion Works</h3>
                  <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                    <li>You transfer your pre-existing equity or debt position into an SPV</li>
                    <li>The platform reviews your documents (ownership proof, transfer agreement)</li>
                    <li>Once approved, tokens are minted directly to your wallet — no capital raise required</li>
                    <li>A lockup period applies before you can sell on the secondary market</li>
                    <li>If your position is debt-secured, lender consent may be required</li>
                  </ul>
                </div>

                {/* Position details */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-gray-200">Position Details</h3>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">SPV Jurisdiction <span className="text-red-400">*</span></label>
                    <p className="text-xs text-gray-500 mb-2">Country of SPV registration — must have legal clearance for this product.</p>
                    <select value={form.spv_jurisdiction} onChange={e => setForm(f => ({...f, spv_jurisdiction: e.target.value}))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                      <option value="">Select jurisdiction…</option>
                      {jurisdictions.map(j => (
                        <option key={j.country_code} value={j.country_code}>{j.country_name} ({j.country_code}) — {j.conversion_lockup_days}d lockup</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Underlying Owner / Beneficiary Name <span className="text-red-400">*</span></label>
                    <p className="text-xs text-gray-500 mb-2">Legal name of the entity or person currently holding the position.</p>
                    <input value={form.underlying_owner_name} onChange={e => setForm(f => ({...f, underlying_owner_name: e.target.value}))}
                      placeholder="e.g. Harare Capital Partners (Pvt) Ltd"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"/>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Position Description <span className="text-red-400">*</span></label>
                    <p className="text-xs text-gray-500 mb-2">Describe the nature of the existing position (e.g. 12% equity stake in XYZ Holdings, 5-year secured bond at 18% p.a.).</p>
                    <textarea value={form.existing_position_description} onChange={e => setForm(f => ({...f, existing_position_description: e.target.value}))}
                      placeholder="Describe the position in detail…" rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Existing Position Value (USD) <span className="text-red-400">*</span></label>
                      <input type="number" min="1" step="0.01" value={form.existing_position_value_usd}
                        onChange={e => setForm(f => ({...f, existing_position_value_usd: e.target.value}))}
                        placeholder="e.g. 500000"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Asset Type <span className="text-red-400">*</span></label>
                      <select value={form.asset_type} onChange={e => setForm(f => ({...f, asset_type: e.target.value}))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Token details */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-gray-200">Token Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Token Symbol <span className="text-red-400">*</span></label>
                      <input value={form.token_symbol} onChange={e => setForm(f => ({...f, token_symbol: e.target.value.toUpperCase()}))}
                        maxLength={8} placeholder="e.g. HCPR"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500"/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Token Name <span className="text-red-400">*</span></label>
                      <input value={form.token_name} onChange={e => setForm(f => ({...f, token_name: e.target.value}))}
                        placeholder="e.g. Harare Capital Partners"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Total Token Supply <span className="text-red-400">*</span></label>
                    <p className="text-xs text-gray-500 mb-2">All tokens minted go directly to your wallet. Initial price = Position Value ÷ Total Supply.</p>
                    <input type="number" min="1000" step="1" value={form.total_supply}
                      onChange={e => setForm(f => ({...f, total_supply: e.target.value}))}
                      placeholder="e.g. 1000000"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"/>
                    {form.existing_position_value_usd && form.total_supply && (
                      <p className="text-xs text-blue-400 mt-1">
                        Initial price per token: ${(parseFloat(form.existing_position_value_usd) / parseInt(form.total_supply)).toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-gray-200">Supporting Documents</h3>
                  <FileField label="Proof of Ownership" name="ownership_proof" required
                    hint="Share certificate, register extract, or other legally binding proof of ownership."
                    onChange={e => setFiles(f => ({...f, ownership_proof: e.target.files[0] || null}))}/>
                  <FileField label="Transfer / Assignment Agreement" name="transfer_agreement" required
                    hint="Signed agreement transferring the position into the SPV structure."
                    onChange={e => setFiles(f => ({...f, transfer_agreement: e.target.files[0] || null}))}/>

                  <div className="border-t border-gray-800 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input type="checkbox" checked={form.lender_consent_required}
                        onChange={e => setForm(f => ({...f, lender_consent_required: e.target.checked}))}
                        className="w-4 h-4 accent-blue-500"/>
                      <span className="text-xs text-gray-300">This position is subject to a lender/creditor with consent rights over transfer</span>
                    </label>
                    {form.lender_consent_required && (
                      <FileField label="Lender Consent Document (optional at this stage)" name="lender_consent"
                        hint="If you already have written lender consent, upload it here. Otherwise the application will be paused at the Awaiting Lender Consent stage."
                        onChange={e => setFiles(f => ({...f, lender_consent: e.target.files[0] || null}))}/>
                    )}
                  </div>
                </div>

                {/* Legal notice */}
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    By submitting this form you confirm that: (a) you are the legal or beneficial owner of the position described; (b) you have authority to transfer this position into an SPV structure; (c) the information provided is accurate and complete to the best of your knowledge. TokenEquityX reserves the right to reject applications that cannot be verified.
                  </p>
                </div>

                {error && <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-3 text-sm text-red-300">{error}</div>}

                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {submitting ? 'Submitting…' : 'Submit Conversion Request'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
