'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ── Step definitions per role ──────────────────────────────────────────────
const INVESTOR_STEPS = [
  { id: 'welcome',  label: 'Welcome',       icon: '👋' },
  { id: 'personal', label: 'Personal Info', icon: '🪪' },
  { id: 'address',  label: 'Address',       icon: '🏠' },
  { id: 'docs',     label: 'Documents',     icon: '📄' },
  { id: 'risk',     label: 'Risk Profile',  icon: '📊' },
];
const ISSUER_STEPS = [
  { id: 'welcome',     label: 'Welcome',      icon: '👋' },
  { id: 'personal',    label: 'Personal Info', icon: '🪪' },
  { id: 'address',     label: 'Address',      icon: '🏠' },
  { id: 'docs',        label: 'Documents',    icon: '📄' },
  { id: 'declaration', label: 'Declaration',  icon: '✍️' },
];
const PARTNER_STEPS = [
  { id: 'welcome',     label: 'Welcome',      icon: '👋' },
  { id: 'personal',    label: 'Personal Info', icon: '🪪' },
  { id: 'address',     label: 'Address',      icon: '🏠' },
  { id: 'docs',        label: 'Documents',    icon: '📄' },
  { id: 'declaration', label: 'Declaration',  icon: '✍️' },
];
const STEPS_FOR_ROLE = { INVESTOR: INVESTOR_STEPS, ISSUER: ISSUER_STEPS, PARTNER: PARTNER_STEPS };

// ── Risk questionnaire — investors only ────────────────────────────────────
const RISK_QUESTIONS = [
  {
    id: 'objective',
    question: 'What is your primary investment objective?',
    options: [
      { label: 'Preserve capital — I cannot afford any losses', score: 1 },
      { label: 'Generate steady income with low risk',          score: 2 },
      { label: 'Long-term growth with moderate risk',           score: 3 },
      { label: 'Maximum returns — I accept high volatility',    score: 4 },
    ],
  },
  {
    id: 'horizon',
    question: 'How long do you plan to hold your investments?',
    options: [
      { label: 'Less than 1 year',  score: 1 },
      { label: '1 – 3 years',       score: 2 },
      { label: '3 – 7 years',       score: 3 },
      { label: 'More than 7 years', score: 4 },
    ],
  },
  {
    id: 'reaction',
    question: 'If your portfolio dropped 20% in one month, you would…',
    options: [
      { label: 'Sell everything immediately',  score: 1 },
      { label: 'Sell some to reduce risk',     score: 2 },
      { label: 'Hold and wait for recovery',   score: 3 },
      { label: 'Buy more at the lower price',  score: 4 },
    ],
  },
  {
    id: 'experience',
    question: 'How would you describe your investment experience?',
    options: [
      { label: 'None — this is my first investment',                      score: 1 },
      { label: 'Some — stocks or savings accounts',                       score: 2 },
      { label: 'Experienced — bonds, unit trusts, or alternatives',       score: 3 },
      { label: 'Expert — digital assets, private equity, or derivatives', score: 4 },
    ],
  },
  {
    id: 'income',
    question: 'What is your approximate annual income (USD)?',
    options: [
      { label: 'Under $10,000',       score: 1 },
      { label: '$10,000 – $50,000',   score: 2 },
      { label: '$50,000 – $150,000',  score: 3 },
      { label: 'Over $150,000',       score: 4 },
    ],
  },
  {
    id: 'liquidity',
    question: 'How soon might you need access to these funds?',
    options: [
      { label: 'Within 6 months',           score: 1 },
      { label: 'Within 1 – 2 years',        score: 2 },
      { label: 'Can lock away 3 – 5 years', score: 3 },
      { label: 'No foreseeable need',        score: 4 },
    ],
  },
];

function calculateRiskProfile(answers) {
  const total = Object.values(answers).reduce((s, v) => s + v, 0);
  if (total <= 10) return { profile: 'CONSERVATIVE', score: total };
  if (total <= 15) return { profile: 'BALANCED',     score: total };
  if (total <= 20) return { profile: 'GROWTH',       score: total };
  return               { profile: 'SPECULATIVE',   score: total };
}

const PROFILE_COLORS = {
  CONSERVATIVE: 'text-blue-400',
  BALANCED:     'text-green-400',
  GROWTH:       'text-yellow-400',
  SPECULATIVE:  'text-red-400',
};
const PROFILE_DESC = {
  CONSERVATIVE: 'Capital preservation focus. Suitable for low-risk, fixed-income assets.',
  BALANCED:     'Mix of income and growth. Access to most asset classes on the platform.',
  GROWTH:       'Growth-oriented. Suitable for equities and higher-yield instruments.',
  SPECULATIVE:  'High risk / high reward. Full access including speculative digital assets.',
};

// ── Shared styles ──────────────────────────────────────────────────────────
const INPUT = 'w-full bg-[#0D1B2A] border border-[#1A3C5E] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C8972B] placeholder-gray-600';

// ── Helper components ──────────────────────────────────────────────────────
function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">
        {label}{required && <span className="text-[#C8972B] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function NavButtons({ step, setStep, canAdvance, isLastStep, advance, loading, nextLabel }) {
  return (
    <div className="mt-6 flex justify-between items-center">
      {step > 0
        ? <button onClick={() => setStep(s => s - 1)} className="text-gray-400 text-sm hover:text-gray-200">← Back</button>
        : <div />
      }
      <button
        onClick={advance}
        disabled={!canAdvance() || loading}
        className="bg-[#C8972B] text-white px-6 py-2 rounded text-sm font-semibold disabled:opacity-40 transition"
      >
        {loading ? 'Submitting…' : nextLabel ?? (isLastStep ? 'Submit →' : 'Next →')}
      </button>
    </div>
  );
}

function FileUpload({ label, accept, onChange, file }) {
  return (
    <label className="block cursor-pointer">
      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
        file ? 'border-green-500/50 bg-green-900/10' : 'border-[#1A3C5E] hover:border-[#C8972B]/50'
      }`}>
        {file ? (
          <div>
            <div className="text-green-400 text-2xl mb-2">✓</div>
            <div className="text-white text-sm font-medium">{file.name}</div>
            <div className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB — click to change</div>
          </div>
        ) : (
          <div>
            <div className="text-gray-500 text-2xl mb-2">📁</div>
            <div className="text-gray-300 text-sm">{label}</div>
            <div className="text-gray-600 text-xs mt-1">PDF, JPG, PNG — max 10 MB</div>
          </div>
        )}
      </div>
      <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
    </label>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();

  const [role,  setRole]  = useState('INVESTOR');
  const [steps, setSteps] = useState(INVESTOR_STEPS);
  const [step,  setStep]  = useState(0);
  const [user,  setUser]  = useState(null);

  const [personal, setPersonal] = useState({
    fullName: '', dateOfBirth: '', nationality: '',
    idType: 'national_id', idNumber: '', jobTitle: '',
  });
  const [address, setAddress] = useState({
    addressLine1: '', addressLine2: '', city: '', country: '',
  });
  const [idDoc, setIdDoc] = useState(null);

  const [riskAnswers, setRiskAnswers] = useState({});
  const [riskResult,  setRiskResult]  = useState(null);

  const [issuerDecl, setIssuerDecl] = useState({
    authorised: false, goodStanding: false, accurate: false,
  });
  const [partnerDecl, setPartnerDecl] = useState({
    authorised: false, agreeTerms: false, institutionName: '', jobTitle: '',
  });

  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/signup'); return; }
    const u = JSON.parse(stored);

    const cleanUser = { ...u };
    delete cleanUser.kyc_status;
    localStorage.setItem('user', JSON.stringify(cleanUser));

    if (
      cleanUser.onboarding_complete === true ||
      cleanUser.onboarding_complete === 'true' ||
      cleanUser.onboarding_complete === 1
    ) {
      router.push(`/${(cleanUser.role || 'investor').toLowerCase()}`);
      return;
    }

    setUser(cleanUser);
    const r = cleanUser.role || 'INVESTOR';
    setRole(r);
    setSteps(STEPS_FOR_ROLE[r] || INVESTOR_STEPS);
  }, []);

  const stepId     = steps[step]?.id;
  const isLastStep = step === steps.length - 1;

  const canAdvance = () => {
    switch (stepId) {
      case 'welcome':  return true;
      case 'personal':
        return !!(
          personal.fullName.trim() &&
          personal.dateOfBirth &&
          personal.nationality.trim() &&
          personal.idNumber.trim() &&
          (role !== 'ISSUER' || personal.jobTitle.trim())
        );
      case 'address':
        return !!(address.addressLine1.trim() && address.city.trim() && address.country.trim());
      case 'docs':
        return !!idDoc;
      case 'risk':
        return Object.keys(riskAnswers).length === RISK_QUESTIONS.length;
      case 'declaration':
        if (role === 'ISSUER')
          return issuerDecl.authorised && issuerDecl.goodStanding && issuerDecl.accurate;
        if (role === 'PARTNER')
          return partnerDecl.authorised && partnerDecl.agreeTerms &&
                 partnerDecl.institutionName.trim() !== '' && partnerDecl.jobTitle.trim() !== '';
        return false;
      default: return false;
    }
  };

  const advance = () => { if (isLastStep) handleSubmit(); else setStep(s => s + 1); };

  const answerRisk = (qId, score) => {
    const updated = { ...riskAnswers, [qId]: score };
    setRiskAnswers(updated);
    if (Object.keys(updated).length === RISK_QUESTIONS.length) setRiskResult(calculateRiskProfile(updated));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();

      fd.append('fullName',     personal.fullName.trim());
      fd.append('dateOfBirth',  personal.dateOfBirth);
      fd.append('nationality',  personal.nationality.trim());
      fd.append('idType',       personal.idType);
      fd.append('idNumber',     personal.idNumber.trim());
      fd.append('addressLine1', address.addressLine1.trim());
      fd.append('addressLine2', address.addressLine2.trim());
      fd.append('city',         address.city.trim());
      fd.append('country',      address.country.trim());
      fd.append('role',         role);

      if (idDoc) fd.append('id_doc', idDoc);

      if (role === 'INVESTOR') {
        fd.append('riskProfile', riskResult?.profile || 'BALANCED');
        fd.append('riskScore',   String(riskResult?.score  || 0));
        fd.append('riskAnswers', JSON.stringify(riskAnswers));
      }
      if (role === 'ISSUER') {
        fd.append('jobTitle', personal.jobTitle.trim());
      }
      if (role === 'PARTNER') {
        fd.append('institutionName', partnerDecl.institutionName.trim());
        fd.append('jobTitle',        partnerDecl.jobTitle.trim());
      }

      const kycRes = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!kycRes.ok) {
        const body = await kycRes.json().catch(() => ({}));
        throw new Error(body.error || 'KYC submission failed');
      }

      await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      setSubmitted(true);
      localStorage.setItem('user', JSON.stringify({ ...user, onboarding_complete: 1, kyc_status: 'PENDING' }));

      const dest = role === 'ISSUER' ? '/issuer' : role === 'PARTNER' ? '/banking-partner' : '/investor';
      setTimeout(() => router.push(dest), 3000);
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">KYC Submitted!</h2>
          <p className="text-gray-400 text-sm">
            Your documents are under review. We'll approve your account within 24–48 hours.
            You'll be redirected to your dashboard now.
          </p>
          <div className="mt-4 text-[#C8972B] text-sm">Redirecting…</div>
        </div>
      </div>
    );
  }

  const pageTitle = role === 'ISSUER'  ? 'Issuer Verification'  :
                    role === 'PARTNER' ? 'Partner Onboarding'    : 'KYC Verification';
  const docLabel  = personal.idType === 'passport'        ? 'Passport'          :
                    personal.idType === 'drivers_licence'  ? "Driver's Licence"  : 'National ID';

  return (
    <div className="min-h-screen bg-[#0D1B2A] px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-[#C8972B] font-bold tracking-widest text-sm mb-2">STEP 3 OF 3</div>
          <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
          <p className="text-gray-400 text-sm mt-2">
            Required by law under Zimbabwe's AML regulations. Documents are reviewed within 24–48 hours.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between mb-8 px-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex flex-col items-center ${i <= step ? 'text-[#C8972B]' : 'text-gray-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
                  i < step   ? 'bg-[#C8972B] border-[#C8972B]' :
                  i === step ? 'border-[#C8972B]'               : 'border-gray-700'
                }`}>
                  {i < step ? '✓' : s.icon}
                </div>
                <div className="text-xs mt-1 hidden sm:block">{s.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-[#C8972B]' : 'bg-gray-700'}`} style={{width:'32px'}} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0D2137] border border-[#1A3C5E] rounded-lg p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">{error}</div>
          )}

          {/* ── WELCOME ── */}
          {stepId === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">
                {role === 'ISSUER' ? '🏢' : role === 'PARTNER' ? '🤝' : '👋'}
              </div>
              <h3 className="text-white font-bold text-xl mb-3">
                {role === 'ISSUER'  ? "Let's set up your issuer profile"  :
                 role === 'PARTNER' ? 'Banking Partner Onboarding'         :
                 'Welcome to TokenEquityX'}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                {role === 'ISSUER'
                  ? "To list your company on TokenEquityX, we need to verify your identity as an authorised representative. This is required by Zimbabwe's Securities and Exchange Commission (SECZ)."
                  : role === 'PARTNER'
                  ? 'To activate your banking partner integration, we need to verify your identity and institutional credentials. All information is handled in strict confidence.'
                  : "To protect investors and comply with Zimbabwe's AML regulations, we need to verify your identity before you can invest. The process takes about 5 minutes."}
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {['Secure & encrypted', 'Reviewed in 24–48h', 'Required by SECZ'].map(t => (
                  <div key={t} className="bg-[#1A3C5E]/40 rounded-lg p-3 text-gray-400 text-xs">{t}</div>
                ))}
              </div>
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} nextLabel="Get Started →" />
            </div>
          )}

          {/* ── PERSONAL INFO ── */}
          {stepId === 'personal' && (
            <div>
              <h3 className="text-white font-bold mb-1">Personal Information</h3>
              <p className="text-gray-400 text-sm mb-5">
                {role === 'ISSUER'
                  ? 'Details of the authorised company representative.'
                  : role === 'PARTNER'
                  ? 'Details of the authorised institutional representative.'
                  : 'Your personal details as they appear on your official ID document.'}
              </p>
              <div className="space-y-4">
                <FormField label="Full Name" required>
                  <input type="text" value={personal.fullName}
                    onChange={e => setPersonal(p => ({...p, fullName: e.target.value}))}
                    placeholder="As it appears on your ID" className={INPUT} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Date of Birth" required>
                    <input type="date" value={personal.dateOfBirth}
                      onChange={e => setPersonal(p => ({...p, dateOfBirth: e.target.value}))}
                      className={INPUT} />
                  </FormField>
                  <FormField label="Nationality" required>
                    <input type="text" value={personal.nationality}
                      onChange={e => setPersonal(p => ({...p, nationality: e.target.value}))}
                      placeholder="e.g. Zimbabwean" className={INPUT} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="ID Type" required>
                    <select value={personal.idType}
                      onChange={e => setPersonal(p => ({...p, idType: e.target.value}))}
                      className={INPUT}>
                      <option value="national_id">National ID</option>
                      <option value="passport">Passport</option>
                      <option value="drivers_licence">Driver's Licence</option>
                    </select>
                  </FormField>
                  <FormField label="ID Number" required>
                    <input type="text" value={personal.idNumber}
                      onChange={e => setPersonal(p => ({...p, idNumber: e.target.value}))}
                      placeholder="ID / Passport number" className={INPUT} />
                  </FormField>
                </div>
                {role === 'ISSUER' && (
                  <FormField label="Your role / title at the company" required>
                    <input type="text" value={personal.jobTitle}
                      onChange={e => setPersonal(p => ({...p, jobTitle: e.target.value}))}
                      placeholder="e.g. CEO, CFO, Director" className={INPUT} />
                  </FormField>
                )}
              </div>
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} />
            </div>
          )}

          {/* ── ADDRESS ── */}
          {stepId === 'address' && (
            <div>
              <h3 className="text-white font-bold mb-1">Address & Contact</h3>
              <p className="text-gray-400 text-sm mb-5">
                Your residential address as it appears on your proof of address document.
              </p>
              <div className="space-y-4">
                <FormField label="Address Line 1" required>
                  <input type="text" value={address.addressLine1}
                    onChange={e => setAddress(a => ({...a, addressLine1: e.target.value}))}
                    placeholder="Street address" className={INPUT} />
                </FormField>
                <FormField label="Address Line 2">
                  <input type="text" value={address.addressLine2}
                    onChange={e => setAddress(a => ({...a, addressLine2: e.target.value}))}
                    placeholder="Apartment, suite, floor (optional)" className={INPUT} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="City" required>
                    <input type="text" value={address.city}
                      onChange={e => setAddress(a => ({...a, city: e.target.value}))}
                      placeholder="City" className={INPUT} />
                  </FormField>
                  <FormField label="Country" required>
                    <input type="text" value={address.country}
                      onChange={e => setAddress(a => ({...a, country: e.target.value}))}
                      placeholder="Country" className={INPUT} />
                  </FormField>
                </div>
              </div>
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} />
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {stepId === 'docs' && (
            <div>
              <h3 className="text-white font-bold mb-1">Identity Document</h3>
              <p className="text-gray-400 text-sm mb-5">
                {role === 'ISSUER'
                  ? 'Upload a government-issued ID for the authorised company representative.'
                  : role === 'PARTNER'
                  ? 'Upload a government-issued ID for the institutional representative.'
                  : 'Upload a government-issued photo ID. Must show your full name, photo, and date of birth.'}
              </p>
              <FileUpload
                label={`Upload ${docLabel}`}
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={setIdDoc}
                file={idDoc}
              />
              <p className="text-gray-600 text-xs mt-3">Accepted: PDF, JPG, PNG — maximum 10 MB</p>
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} />
            </div>
          )}

          {/* ── RISK PROFILE — investor only ── */}
          {stepId === 'risk' && (
            <div>
              <h3 className="text-white font-bold mb-1">Investor Risk Profile</h3>
              <p className="text-gray-400 text-sm mb-5">
                Answer 6 questions so we can match you with suitable investments. Required under IOSCO suitability principles.
              </p>
              <div className="space-y-5">
                {RISK_QUESTIONS.map((q, qi) => (
                  <div key={q.id}>
                    <p className="text-gray-200 text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
                    <div className="space-y-1.5">
                      {q.options.map(opt => (
                        <button key={opt.score} onClick={() => answerRisk(q.id, opt.score)}
                          className={`w-full text-left px-3 py-2 rounded text-sm border transition ${
                            riskAnswers[q.id] === opt.score
                              ? 'border-[#C8972B] bg-[#C8972B]/10 text-white'
                              : 'border-[#1A3C5E] text-gray-400 hover:border-[#C8972B]/50'
                          }`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {riskResult && (
                <div className="mt-5 bg-[#1A3C5E]/50 rounded p-4">
                  <p className="text-gray-400 text-xs mb-1">Your risk profile</p>
                  <p className={`text-lg font-bold ${PROFILE_COLORS[riskResult.profile]}`}>{riskResult.profile}</p>
                  <p className="text-gray-400 text-xs mt-1">{PROFILE_DESC[riskResult.profile]}</p>
                </div>
              )}
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} nextLabel="Submit KYC →" />
            </div>
          )}

          {/* ── ISSUER DECLARATION ── */}
          {stepId === 'declaration' && role === 'ISSUER' && (
            <div>
              <h3 className="text-white font-bold mb-1">Issuer Declaration</h3>
              <p className="text-gray-400 text-sm mb-5">
                Please confirm the following before submitting your application to TokenEquityX.
              </p>
              <div className="space-y-4">
                {[
                  ['authorised',   'I confirm I am an authorised representative of the company I intend to list'],
                  ['goodStanding', 'I confirm the company is registered and in good standing in its jurisdiction'],
                  ['accurate',     'I understand that all information submitted must be accurate and complete'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox"
                      checked={issuerDecl[key]}
                      onChange={e => setIssuerDecl(d => ({...d, [key]: e.target.checked}))}
                      className="mt-0.5 accent-[#C8972B] w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{label}</span>
                  </label>
                ))}
              </div>
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} nextLabel="Submit →" />
            </div>
          )}

          {/* ── PARTNER DECLARATION ── */}
          {stepId === 'declaration' && role === 'PARTNER' && (
            <div>
              <h3 className="text-white font-bold mb-1">Partner Declaration</h3>
              <p className="text-gray-400 text-sm mb-5">
                Please confirm the following before completing your partner registration.
              </p>
              <div className="space-y-4">
                {[
                  ['authorised', 'I confirm I am an authorised representative of the partnering institution'],
                  ['agreeTerms', 'I agree to the TokenEquityX Banking Partner Terms and Conditions'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox"
                      checked={partnerDecl[key]}
                      onChange={e => setPartnerDecl(d => ({...d, [key]: e.target.checked}))}
                      className="mt-0.5 accent-[#C8972B] w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{label}</span>
                  </label>
                ))}
                <FormField label="Institution name" required>
                  <input type="text" value={partnerDecl.institutionName}
                    onChange={e => setPartnerDecl(d => ({...d, institutionName: e.target.value}))}
                    placeholder="Name of your institution" className={INPUT} />
                </FormField>
                <FormField label="Your role at the institution" required>
                  <input type="text" value={partnerDecl.jobTitle}
                    onChange={e => setPartnerDecl(d => ({...d, jobTitle: e.target.value}))}
                    placeholder="e.g. Head of Digital Assets, CTO" className={INPUT} />
                </FormField>
              </div>
              <NavButtons step={step} setStep={setStep} canAdvance={canAdvance}
                isLastStep={isLastStep} advance={advance} loading={loading} nextLabel="Submit →" />
            </div>
          )}
        </div>

        {/* KYC is mandatory — no skip allowed */}
      </div>
    </div>
  );
}
