'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

// ── Step definitions ───────────────────────────────────────────────────────
const RETAIL_STEPS = [
  { id: 'welcome',  label: 'Welcome',       icon: '👋' },
  { id: 'personal', label: 'Personal Info', icon: '🪪' },
  { id: 'address',  label: 'Address',       icon: '🏠' },
  { id: 'docs',     label: 'Documents',     icon: '📄' },
  { id: 'risk',     label: 'Risk Profile',  icon: '📊' },
];
const CORPORATE_STEPS = [
  { id: 'welcome',  label: 'Welcome',        icon: '👋' },
  { id: 'personal', label: 'Representative', icon: '🪪' },
  { id: 'address',  label: 'Address',        icon: '🏠' },
  { id: 'docs',     label: 'Documents',      icon: '📄' },
  { id: 'company',  label: 'Company Info',   icon: '🏢' },
  { id: 'risk',     label: 'Risk Profile',   icon: '📊' },
];
const INSTITUTION_STEPS = [
  { id: 'welcome',     label: 'Welcome',      icon: '👋' },
  { id: 'personal',    label: 'Officer Info', icon: '🪪' },
  { id: 'address',     label: 'Address',      icon: '🏠' },
  { id: 'docs',        label: 'Documents',    icon: '📄' },
  { id: 'institution', label: 'Institution',  icon: '🏦' },
  { id: 'mandate',     label: 'Mandate',      icon: '📋' },
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

function stepsForTier(tier) {
  if (tier === 'CORPORATE')   return CORPORATE_STEPS;
  if (tier === 'INSTITUTION') return INSTITUTION_STEPS;
  return RETAIL_STEPS;
}

// ── Risk questionnaire ─────────────────────────────────────────────────────
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
const INPUT    = 'w-full bg-[#0D1B2A] border border-[#1A3C5E] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C8972B] placeholder-gray-600';
const TEXTAREA = INPUT + ' resize-none';

// ── Helper components ──────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function WalletPromptBanner({ token, onLinked }) {
  const [status, setStatus] = useState('');
  const [linked, setLinked]  = useState(false);

  async function connect() {
    if (!window.ethereum) { setStatus('MetaMask not detected. You can connect your wallet later from Profile → Security.'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const wallet_address = accounts[0];
      const res = await fetch(`${API_BASE}/auth/link-wallet`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wallet_address }),
      });
      const data = await res.json();
      if (res.ok) { setLinked(true); setStatus(''); onLinked(wallet_address); }
      else setStatus(data.error || 'Failed to link wallet.');
    } catch { setStatus('MetaMask connection failed. You can try again from your profile.'); }
  }

  if (linked) {
    return (
      <div className="mb-6 flex items-center gap-3 bg-green-900/30 border border-green-700/50 rounded-lg px-4 py-3 text-green-300 text-sm">
        <span>🦊</span> MetaMask wallet linked — you're all set for on-chain settlement.
      </div>
    );
  }

  return (
    <div className="mb-6 bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
      <p className="text-amber-300 text-sm font-semibold mb-1">Connect your MetaMask wallet (recommended)</p>
      <p className="text-amber-400/80 text-xs mb-3">
        A linked wallet enables USDC deposits, on-chain token transfers, and faster settlement. You can skip this and connect later from your profile.
      </p>
      {status && <p className="text-xs text-red-300 mb-2">{status}</p>}
      <button onClick={connect}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white bg-amber-700/60 hover:bg-amber-700 border border-amber-600/50 transition">
        <span>🦊</span> Connect MetaMask Now
      </button>
    </div>
  );
}

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

function NavButtons({ step, canAdvance, isLastStep, advance, loading, nextLabel, onBack }) {
  const handleBack = onBack || null;
  const showBack   = step > 0 || !!onBack;
  return (
    <div className="mt-6 flex justify-between items-center">
      {showBack
        ? <button onClick={handleBack || (() => {})} className="text-gray-400 text-sm hover:text-gray-200">← Back</button>
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
  const [steps, setSteps] = useState(RETAIL_STEPS);
  const [step,  setStep]  = useState(0);
  const [user,  setUser]  = useState(null);

  // Investor tier selection
  const [investorTier,  setInvestorTier]  = useState(null);   // 'RETAIL' | 'CORPORATE' | 'INSTITUTION'
  const [tierSelected,  setTierSelected]  = useState(false);
  const [platformSettings, setPlatformSettings] = useState({});

  // Personal fields (shared across all tiers/roles)
  const [personal, setPersonal] = useState({
    fullName: '', dateOfBirth: '', nationality: '',
    idType: 'national_id', idNumber: '', phone: '',
    occupation: '', jobTitle: '',
  });

  // Address
  const [address, setAddress] = useState({
    addressLine1: '', addressLine2: '', city: '', country: '',
  });

  // Documents
  const [idDoc,      setIdDoc]      = useState(null);
  const [companyDoc, setCompanyDoc] = useState(null);
  const [mandateDoc, setMandateDoc] = useState(null);

  // Risk questionnaire
  const [riskAnswers, setRiskAnswers] = useState({});
  const [riskResult,  setRiskResult]  = useState(null);
  const [investorDecl, setInvestorDecl] = useState(false);

  // Tier 3 mandate declaration
  const [institutionDecl, setInstitutionDecl] = useState(false);

  // Corporate details (Tier 2)
  const [corporate, setCorporate] = useState({
    companyName: '', registrationNumber: '', countryOfRegistration: '',
    businessType: '', sourceOfFunds: '', businessDescription: '',
    directors: [{ name: '', idNumber: '', email: '' }],
    beneficialOwners: [{ name: '', ownershipPct: '', nationality: '' }],
    amlDecl: false, pepDecl: false,
  });

  // Institutional details (Tier 3)
  const [institutional, setInstitutional] = useState({
    institutionName: '', institutionType: 'ASSET_MANAGER',
    registrationNumber: '', countryOfRegistration: '',
    aumUsd: '', ipecRegistered: false, seczRegistered: false,
    otherRegulator: '', mandateScope: '', sourceOfFunds: '',
    amlDecl: false, pepDecl: false,
  });

  // Issuer / Partner declarations
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
    // Fetch public platform settings for tier min investment display
    fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/settings/public')
      .then(r => r.json())
      .then(d => { if (d && typeof d === 'object') setPlatformSettings(d); })
      .catch(() => {});
  }, []);

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

    // Non-investor roles skip tier selection and go straight to their steps
    if (r !== 'INVESTOR') {
      const roleSteps = r === 'ISSUER' ? ISSUER_STEPS : PARTNER_STEPS;
      setSteps(roleSteps);
      setTierSelected(true);
    }
  }, []);

  // Select a tier and enter the multi-step flow
  const selectTier = (tier) => {
    setInvestorTier(tier);
    setSteps(stepsForTier(tier));
    setTierSelected(true);
    setStep(0);
  };

  const stepId     = steps[step]?.id;
  const isLastStep = step === steps.length - 1;

  const canAdvance = () => {
    switch (stepId) {
      case 'welcome': return true;

      case 'personal': {
        const base = !!(
          personal.fullName.trim() &&
          personal.dateOfBirth &&
          personal.nationality.trim() &&
          personal.idNumber.trim() &&
          personal.phone.trim()
        );
        if (investorTier === 'CORPORATE' || investorTier === 'INSTITUTION' || role === 'ISSUER')
          return base && !!personal.jobTitle.trim();
        return base;
      }

      case 'address':
        return !!(address.addressLine1.trim() && address.city.trim() && address.country.trim());

      case 'docs':
        if (investorTier === 'CORPORATE' || investorTier === 'INSTITUTION')
          return !!idDoc && !!companyDoc;
        return !!idDoc;

      case 'company':
        return !!(
          corporate.companyName.trim() &&
          corporate.registrationNumber.trim() &&
          corporate.countryOfRegistration.trim() &&
          corporate.businessType.trim() &&
          corporate.sourceOfFunds.trim() &&
          corporate.amlDecl &&
          corporate.pepDecl
        );

      case 'institution':
        return !!(
          institutional.institutionName.trim() &&
          institutional.institutionType &&
          institutional.registrationNumber.trim() &&
          institutional.countryOfRegistration.trim() &&
          institutional.aumUsd &&
          institutional.mandateScope.trim() &&
          institutional.sourceOfFunds.trim() &&
          institutional.amlDecl &&
          institutional.pepDecl
        );

      case 'mandate':
        return !!mandateDoc && institutionDecl;

      case 'risk':
        return Object.keys(riskAnswers).length === RISK_QUESTIONS.length && investorDecl;

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

  const goBack = () => {
    if (step === 0) {
      // Return to tier selection
      setTierSelected(false);
      setInvestorTier(null);
    } else {
      setStep(s => s - 1);
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
      const fd = new FormData();

      fd.append('fullName',     personal.fullName.trim());
      fd.append('dateOfBirth',  personal.dateOfBirth);
      fd.append('nationality',  personal.nationality.trim());
      fd.append('idType',       personal.idType);
      fd.append('idNumber',     personal.idNumber.trim());
      fd.append('phone',        personal.phone.trim());
      fd.append('addressLine1', address.addressLine1.trim());
      fd.append('addressLine2', address.addressLine2.trim());
      fd.append('city',         address.city.trim());
      fd.append('country',      address.country.trim());
      fd.append('role',         role);

      if (idDoc) fd.append('id_doc', idDoc);

      if (role === 'INVESTOR') {
        fd.append('investorTier', investorTier);

        if (investorTier === 'RETAIL') {
          if (personal.occupation.trim()) fd.append('occupation', personal.occupation.trim());
          fd.append('riskProfile', riskResult?.profile || 'BALANCED');
          fd.append('riskScore',   String(riskResult?.score  || 0));
          fd.append('riskAnswers', JSON.stringify(riskAnswers));
        }

        if (investorTier === 'CORPORATE') {
          fd.append('jobTitle', personal.jobTitle.trim());
          if (companyDoc) fd.append('company_doc', companyDoc);
          fd.append('corporateDetails', JSON.stringify({
            companyName:           corporate.companyName.trim(),
            registrationNumber:    corporate.registrationNumber.trim(),
            countryOfRegistration: corporate.countryOfRegistration.trim(),
            businessType:          corporate.businessType.trim(),
            sourceOfFunds:         corporate.sourceOfFunds.trim(),
            businessDescription:   corporate.businessDescription.trim(),
            directors:             corporate.directors.filter(d => d.name.trim()),
            beneficialOwners:      corporate.beneficialOwners.filter(b => b.name.trim()),
            amlDecl:               corporate.amlDecl,
            pepDecl:               corporate.pepDecl,
          }));
          fd.append('riskProfile', riskResult?.profile || 'BALANCED');
          fd.append('riskScore',   String(riskResult?.score  || 0));
          fd.append('riskAnswers', JSON.stringify(riskAnswers));
        }

        if (investorTier === 'INSTITUTION') {
          fd.append('jobTitle', personal.jobTitle.trim());
          if (companyDoc)  fd.append('company_doc',        companyDoc);
          if (mandateDoc)  fd.append('investment_mandate', mandateDoc);
          fd.append('institutionalDetails', JSON.stringify({
            institutionName:       institutional.institutionName.trim(),
            institutionType:       institutional.institutionType,
            registrationNumber:    institutional.registrationNumber.trim(),
            countryOfRegistration: institutional.countryOfRegistration.trim(),
            aumUsd:                institutional.aumUsd,
            ipecRegistered:        institutional.ipecRegistered,
            seczRegistered:        institutional.seczRegistered,
            otherRegulator:        institutional.otherRegulator.trim(),
            mandateScope:          institutional.mandateScope.trim(),
            sourceOfFunds:         institutional.sourceOfFunds.trim(),
            amlDecl:               institutional.amlDecl,
            pepDecl:               institutional.pepDecl,
          }));
          // No risk profiling for Tier 3
        }
      }

      if (role === 'ISSUER') {
        fd.append('jobTitle', personal.jobTitle.trim());
      }
      if (role === 'PARTNER') {
        fd.append('institutionName', partnerDecl.institutionName.trim());
        fd.append('jobTitle',        partnerDecl.jobTitle.trim());
      }

      await api.post('/kyc/submit', fd);
      await api.post('/auth/complete-onboarding');

      setSubmitted(true);
      localStorage.setItem('user', JSON.stringify({
        ...user,
        onboarding_complete:  1,
        kyc_status:           'PENDING',
        investor_tier:        investorTier || undefined,
        premium_subscription_status: role === 'INVESTOR' ? 'TRIAL' : undefined,
      }));

      const dest = role === 'ISSUER' ? '/issuer' : role === 'PARTNER' ? '/banking-partner' : '/investor';
      setTimeout(() => router.push(dest), 3000);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Submitted ──────────────────────────────────────────────────────────
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

  // ── Tier selection screen (INVESTOR only, before step flow) ────────────
  if (role === 'INVESTOR' && !tierSelected) {
    const fmtMin = (key) => {
      const val = platformSettings[key];
      return val ? `$${parseFloat(val).toLocaleString()}` : '—';
    };
    const tiers = [
      {
        tier:     'RETAIL',
        icon:     '🧑',
        label:    'Retail Investor',
        subtitle: 'Tier 1',
        desc:     'I am investing as an individual',
        minKey:   'tier1_min_investment_usd',
      },
      {
        tier:     'CORPORATE',
        icon:     '🏢',
        label:    'Corporate Investor',
        subtitle: 'Tier 2',
        desc:     'I am investing on behalf of a company or business entity',
        minKey:   'tier2_min_investment_usd',
      },
      {
        tier:     'INSTITUTION',
        icon:     '🏦',
        label:    'Investment Institution',
        subtitle: 'Tier 3',
        desc:     'I represent an asset manager, pension fund, or investment fund',
        minKey:   'tier3_min_investment_usd',
      },
    ];
    return (
      <div className="min-h-screen bg-[#0D1B2A] px-4 py-12">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-[#C8972B] font-bold tracking-widest text-sm mb-2">STEP 3 OF 3</div>
            <h1 className="text-3xl font-bold text-white mb-2">What type of investor are you?</h1>
            <p className="text-gray-400 text-sm">
              Select the category that best describes how you are investing. This determines your KYC requirements.
            </p>
          </div>
          <div className="space-y-4">
            {tiers.map(({ tier, icon, label, subtitle, desc, minKey }) => (
              <button
                key={tier}
                onClick={() => selectTier(tier)}
                className="w-full text-left bg-[#0D2137] border border-[#1A3C5E] hover:border-[#C8972B] rounded-xl p-5 transition group"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-base">{label}</span>
                      <span className="text-xs bg-[#1A3C5E] text-[#C8972B] px-2 py-0.5 rounded-full font-semibold">{subtitle}</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{desc}</p>
                    <p className="text-gray-600 text-xs">
                      Min investment: <span className="text-gray-400 font-medium">{fmtMin(minKey)}</span>
                    </p>
                  </div>
                  <div className="text-gray-600 group-hover:text-[#C8972B] text-xl transition">→</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Step flow ──────────────────────────────────────────────────────────
  const pageTitle = role === 'ISSUER'            ? 'Issuer Verification'            :
                    role === 'PARTNER'            ? 'Partner Onboarding'             :
                    investorTier === 'CORPORATE'  ? 'Corporate Investor Onboarding'  :
                    investorTier === 'INSTITUTION'? 'Institutional Investor Onboarding' :
                    'KYC Verification';

  const docLabel = personal.idType === 'passport'        ? 'Passport'         :
                   personal.idType === 'drivers_licence'  ? "Driver's Licence" : 'National ID';

  const navProps = { step, canAdvance, isLastStep, advance, loading };
  const backFn   = (role === 'INVESTOR' && step === 0) ? () => { setTierSelected(false); setInvestorTier(null); } : null;

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
                {role === 'ISSUER' ? '🏢' : role === 'PARTNER' ? '🤝' :
                 investorTier === 'CORPORATE' ? '🏢' : investorTier === 'INSTITUTION' ? '🏦' : '👋'}
              </div>
              <h3 className="text-white font-bold text-xl mb-3">
                {role === 'ISSUER'              ? "Let's set up your issuer profile"      :
                 role === 'PARTNER'             ? 'Banking Partner Onboarding'             :
                 investorTier === 'CORPORATE'   ? 'Corporate Investor Onboarding'          :
                 investorTier === 'INSTITUTION' ? 'Institutional Investor Onboarding'      :
                 'Set up your investor profile'}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                {role === 'ISSUER'
                  ? "To list your company on TokenEquityX, we need to verify your identity as an authorised representative. This is required by Zimbabwe's Securities and Exchange Commission (SECZ)."
                  : role === 'PARTNER'
                  ? 'To activate your banking partner integration, we need to verify your identity and institutional credentials. All information is handled in strict confidence.'
                  : investorTier === 'CORPORATE'
                  ? 'To onboard your company as a corporate investor, we need to verify the identity of your authorised representative and your company registration details. This complies with AML/CFT requirements.'
                  : investorTier === 'INSTITUTION'
                  ? 'Institutional onboarding requires identity verification for your designated officer, entity registration details, and a copy of your investment mandate. This process typically takes 5–10 minutes.'
                  : "To protect investors and comply with Zimbabwe's AML regulations, we need to verify your identity before you can invest. The process takes about 5 minutes."}
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {['Secure & encrypted', 'Reviewed in 24–48h', 'Required by SECZ'].map(t => (
                  <div key={t} className="bg-[#1A3C5E]/40 rounded-lg p-3 text-gray-400 text-xs">{t}</div>
                ))}
              </div>
              {role === 'INVESTOR' && !user?.wallet_address && (
                <WalletPromptBanner token={localStorage.getItem('token')} onLinked={(addr) => setUser(u => ({ ...u, wallet_address: addr }))} />
              )}
              <NavButtons {...navProps} onBack={backFn} nextLabel="Get Started →" />
            </div>
          )}

          {/* ── PERSONAL INFO ── */}
          {stepId === 'personal' && (
            <div>
              <h3 className="text-white font-bold mb-1">Personal Information</h3>
              <p className="text-gray-400 text-sm mb-5">
                {investorTier === 'CORPORATE'
                  ? 'Details of the authorised company representative.'
                  : investorTier === 'INSTITUTION'
                  ? 'Details of the designated officer.'
                  : role === 'ISSUER'
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
                <FormField label="Phone Number" required>
                  <input type="tel" value={personal.phone}
                    onChange={e => setPersonal(p => ({...p, phone: e.target.value}))}
                    placeholder="+263 71 234 5678" className={INPUT} />
                </FormField>
                {investorTier === 'RETAIL' && (
                  <FormField label="Occupation">
                    <input type="text" value={personal.occupation}
                      onChange={e => setPersonal(p => ({...p, occupation: e.target.value}))}
                      placeholder="e.g. Engineer, Teacher, Business Owner" className={INPUT} />
                  </FormField>
                )}
                {(investorTier === 'CORPORATE' || investorTier === 'INSTITUTION' || role === 'ISSUER') && (
                  <FormField label={investorTier === 'INSTITUTION' ? 'Job Title at Institution' : 'Role / Title at the company'} required>
                    <input type="text" value={personal.jobTitle}
                      onChange={e => setPersonal(p => ({...p, jobTitle: e.target.value}))}
                      placeholder="e.g. CEO, CFO, Director, Fund Manager" className={INPUT} />
                  </FormField>
                )}
              </div>
              <NavButtons {...navProps} onBack={backFn} />
            </div>
          )}

          {/* ── ADDRESS ── */}
          {stepId === 'address' && (
            <div>
              <h3 className="text-white font-bold mb-1">Address & Contact</h3>
              <p className="text-gray-400 text-sm mb-5">
                {investorTier === 'CORPORATE' || investorTier === 'INSTITUTION'
                  ? 'Residential address of the authorised representative.'
                  : 'Your residential address as it appears on your proof of address document.'}
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
              <NavButtons {...navProps} />
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {stepId === 'docs' && (
            <div>
              <h3 className="text-white font-bold mb-1">
                {investorTier === 'CORPORATE' || investorTier === 'INSTITUTION'
                  ? 'Identity & Registration Documents'
                  : 'Identity Document'}
              </h3>
              <p className="text-gray-400 text-sm mb-5">
                {investorTier === 'CORPORATE'
                  ? 'Upload your personal ID and your company registration certificate.'
                  : investorTier === 'INSTITUTION'
                  ? 'Upload your personal ID and your institution registration certificate.'
                  : role === 'ISSUER'
                  ? 'Upload a government-issued ID for the authorised company representative.'
                  : role === 'PARTNER'
                  ? 'Upload a government-issued ID for the institutional representative.'
                  : 'Upload a government-issued photo ID. Must show your full name, photo, and date of birth.'}
              </p>
              <div className="space-y-4">
                <div>
                  {(investorTier === 'CORPORATE' || investorTier === 'INSTITUTION') && (
                    <p className="text-gray-500 text-xs mb-2">1. Representative ID (national ID or passport)</p>
                  )}
                  <FileUpload
                    label={`Upload ${docLabel}`}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={setIdDoc}
                    file={idDoc}
                  />
                </div>
                {(investorTier === 'CORPORATE' || investorTier === 'INSTITUTION') && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">
                      2. {investorTier === 'INSTITUTION' ? 'Institution' : 'Company'} Registration Certificate
                    </p>
                    <FileUpload
                      label="Upload Registration Certificate"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={setCompanyDoc}
                      file={companyDoc}
                    />
                  </div>
                )}
              </div>
              <p className="text-gray-600 text-xs mt-3">Accepted: PDF, JPG, PNG — maximum 10 MB per file</p>
              <NavButtons {...navProps} />
            </div>
          )}

          {/* ── COMPANY INFO (Tier 2) ── */}
          {stepId === 'company' && (
            <div>
              <h3 className="text-white font-bold mb-1">Company Information</h3>
              <p className="text-gray-400 text-sm mb-5">
                Details of the company or business entity making this investment.
              </p>
              <div className="space-y-4">
                <FormField label="Company Name" required>
                  <input type="text" value={corporate.companyName}
                    onChange={e => setCorporate(c => ({...c, companyName: e.target.value}))}
                    placeholder="Registered company name" className={INPUT} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Registration Number" required>
                    <input type="text" value={corporate.registrationNumber}
                      onChange={e => setCorporate(c => ({...c, registrationNumber: e.target.value}))}
                      placeholder="e.g. 12345/2020" className={INPUT} />
                  </FormField>
                  <FormField label="Country of Registration" required>
                    <input type="text" value={corporate.countryOfRegistration}
                      onChange={e => setCorporate(c => ({...c, countryOfRegistration: e.target.value}))}
                      placeholder="e.g. Zimbabwe" className={INPUT} />
                  </FormField>
                </div>
                <FormField label="Business Type" required>
                  <select value={corporate.businessType}
                    onChange={e => setCorporate(c => ({...c, businessType: e.target.value}))}
                    className={INPUT}>
                    <option value="">Select type…</option>
                    <option value="PRIVATE_LIMITED">Private Limited Company</option>
                    <option value="PUBLIC_LIMITED">Public Limited Company</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="TRUST">Trust</option>
                    <option value="OTHER">Other</option>
                  </select>
                </FormField>
                <FormField label="Source of Investment Funds" required>
                  <input type="text" value={corporate.sourceOfFunds}
                    onChange={e => setCorporate(c => ({...c, sourceOfFunds: e.target.value}))}
                    placeholder="e.g. Operating profits, retained earnings" className={INPUT} />
                </FormField>
                <FormField label="Brief Description of Business">
                  <textarea value={corporate.businessDescription}
                    onChange={e => setCorporate(c => ({...c, businessDescription: e.target.value}))}
                    placeholder="What does the company do?" rows={2} className={TEXTAREA} />
                </FormField>

                {/* Directors */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-400 text-xs">Directors</label>
                    <button type="button"
                      onClick={() => setCorporate(c => ({...c, directors: [...c.directors, {name:'',idNumber:'',email:''}]}))}
                      className="text-xs text-[#C8972B] hover:underline">+ Add Director</button>
                  </div>
                  <div className="space-y-2">
                    {corporate.directors.map((d, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2">
                        <input type="text" value={d.name} placeholder="Full name"
                          onChange={e => setCorporate(c => {const dirs=[...c.directors];dirs[i]={...dirs[i],name:e.target.value};return{...c,directors:dirs};})}
                          className={INPUT} />
                        <input type="text" value={d.idNumber} placeholder="ID number"
                          onChange={e => setCorporate(c => {const dirs=[...c.directors];dirs[i]={...dirs[i],idNumber:e.target.value};return{...c,directors:dirs};})}
                          className={INPUT} />
                        <div className="flex gap-1">
                          <input type="email" value={d.email} placeholder="Email"
                            onChange={e => setCorporate(c => {const dirs=[...c.directors];dirs[i]={...dirs[i],email:e.target.value};return{...c,directors:dirs};})}
                            className={INPUT} />
                          {corporate.directors.length > 1 && (
                            <button type="button"
                              onClick={() => setCorporate(c => ({...c, directors: c.directors.filter((_,j)=>j!==i)}))}
                              className="text-red-500 hover:text-red-400 px-1 text-sm">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beneficial Owners */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-400 text-xs">Beneficial Owners ≥10% <span className="text-gray-600">(FATF Rec 24)</span></label>
                    <button type="button"
                      onClick={() => setCorporate(c => ({...c, beneficialOwners: [...c.beneficialOwners, {name:'',ownershipPct:'',nationality:''}]}))}
                      className="text-xs text-[#C8972B] hover:underline">+ Add Owner</button>
                  </div>
                  <div className="space-y-2">
                    {corporate.beneficialOwners.map((b, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2">
                        <input type="text" value={b.name} placeholder="Full name"
                          onChange={e => setCorporate(c => {const bos=[...c.beneficialOwners];bos[i]={...bos[i],name:e.target.value};return{...c,beneficialOwners:bos};})}
                          className={INPUT} />
                        <input type="number" value={b.ownershipPct} placeholder="Ownership %"
                          onChange={e => setCorporate(c => {const bos=[...c.beneficialOwners];bos[i]={...bos[i],ownershipPct:e.target.value};return{...c,beneficialOwners:bos};})}
                          className={INPUT} />
                        <div className="flex gap-1">
                          <input type="text" value={b.nationality} placeholder="Nationality"
                            onChange={e => setCorporate(c => {const bos=[...c.beneficialOwners];bos[i]={...bos[i],nationality:e.target.value};return{...c,beneficialOwners:bos};})}
                            className={INPUT} />
                          {corporate.beneficialOwners.length > 1 && (
                            <button type="button"
                              onClick={() => setCorporate(c => ({...c, beneficialOwners: c.beneficialOwners.filter((_,j)=>j!==i)}))}
                              className="text-red-500 hover:text-red-400 px-1 text-sm">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Declarations */}
                <div className="space-y-3 pt-2 border-t border-[#1A3C5E]">
                  {[
                    ['amlDecl', 'I confirm this company complies with AML/CFT requirements and the source of funds is legitimate'],
                    ['pepDecl', 'I declare that all directors and beneficial owners have been screened for PEP and sanctions status'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={corporate[key]}
                        onChange={e => setCorporate(c => ({...c, [key]: e.target.checked}))}
                        className="mt-0.5 accent-[#C8972B] w-4 h-4 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <NavButtons {...navProps} />
            </div>
          )}

          {/* ── INSTITUTIONAL INFO (Tier 3) ── */}
          {stepId === 'institution' && (
            <div>
              <h3 className="text-white font-bold mb-1">Institutional Information</h3>
              <p className="text-gray-400 text-sm mb-5">
                Details of the investment institution making this application.
              </p>
              <div className="space-y-4">
                <FormField label="Institution Name" required>
                  <input type="text" value={institutional.institutionName}
                    onChange={e => setInstitutional(s => ({...s, institutionName: e.target.value}))}
                    placeholder="Full legal name of the institution" className={INPUT} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Institution Type" required>
                    <select value={institutional.institutionType}
                      onChange={e => setInstitutional(s => ({...s, institutionType: e.target.value}))}
                      className={INPUT}>
                      <option value="ASSET_MANAGER">Asset Manager</option>
                      <option value="PENSION_FUND">Pension Fund</option>
                      <option value="INVESTMENT_FUND">Investment Fund</option>
                      <option value="INSURANCE_COMPANY">Insurance Company</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </FormField>
                  <FormField label="Registration Number" required>
                    <input type="text" value={institutional.registrationNumber}
                      onChange={e => setInstitutional(s => ({...s, registrationNumber: e.target.value}))}
                      placeholder="Company / fund reg. number" className={INPUT} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Country of Registration" required>
                    <input type="text" value={institutional.countryOfRegistration}
                      onChange={e => setInstitutional(s => ({...s, countryOfRegistration: e.target.value}))}
                      placeholder="e.g. Zimbabwe" className={INPUT} />
                  </FormField>
                  <FormField label="Assets Under Management (USD)" required>
                    <input type="number" value={institutional.aumUsd}
                      onChange={e => setInstitutional(s => ({...s, aumUsd: e.target.value}))}
                      placeholder="e.g. 50000000" className={INPUT} />
                  </FormField>
                </div>

                {/* Regulatory status */}
                <div>
                  <label className="block text-gray-400 text-xs mb-2">Regulatory Status</label>
                  <div className="space-y-2">
                    {[
                      ['ipecRegistered', 'IPEC Registered'],
                      ['seczRegistered', 'SECZ Registered'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={institutional[key]}
                          onChange={e => setInstitutional(s => ({...s, [key]: e.target.checked}))}
                          className="accent-[#C8972B] w-4 h-4" />
                        <span className="text-gray-300 text-sm">{label}</span>
                      </label>
                    ))}
                    <FormField label="Other Regulator">
                      <input type="text" value={institutional.otherRegulator}
                        onChange={e => setInstitutional(s => ({...s, otherRegulator: e.target.value}))}
                        placeholder="Name of other regulatory body (if applicable)" className={INPUT} />
                    </FormField>
                  </div>
                </div>

                <FormField label="Investment Mandate Scope" required>
                  <textarea value={institutional.mandateScope}
                    onChange={e => setInstitutional(s => ({...s, mandateScope: e.target.value}))}
                    placeholder="Briefly describe the types of assets your mandate permits you to invest in"
                    rows={3} className={TEXTAREA} />
                </FormField>
                <FormField label="Source of Investment Funds" required>
                  <input type="text" value={institutional.sourceOfFunds}
                    onChange={e => setInstitutional(s => ({...s, sourceOfFunds: e.target.value}))}
                    placeholder="e.g. Member contributions, premium income" className={INPUT} />
                </FormField>

                <div className="space-y-3 pt-2 border-t border-[#1A3C5E]">
                  {[
                    ['amlDecl', 'I confirm this institution complies with AML/CFT requirements'],
                    ['pepDecl', 'I declare that the institution\'s beneficial owners and key personnel have been screened for PEP and sanctions status'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={institutional[key]}
                        onChange={e => setInstitutional(s => ({...s, [key]: e.target.checked}))}
                        className="mt-0.5 accent-[#C8972B] w-4 h-4 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <NavButtons {...navProps} />
            </div>
          )}

          {/* ── INVESTMENT MANDATE (Tier 3) ── */}
          {stepId === 'mandate' && (
            <div>
              <h3 className="text-white font-bold mb-1">Investment Mandate Document</h3>
              <p className="text-gray-400 text-sm mb-5">
                Upload the document that authorises your institution to invest in tokenised securities.
                This may be your investment policy statement, trust deed investment clause, or board resolution.
              </p>
              <FileUpload
                label="Investment Mandate Document *"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={setMandateDoc}
                file={mandateDoc}
              />
              <p className="text-gray-600 text-xs mt-3">PDF preferred — maximum 10 MB</p>
              <div className="mt-5 pt-4 border-t border-[#1A3C5E]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={institutionDecl}
                    onChange={e => setInstitutionDecl(e.target.checked)}
                    className="mt-0.5 accent-[#C8972B] w-4 h-4 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">
                    I confirm that this institution is authorised to invest in tokenised digital securities under its governing mandate and applicable regulatory framework
                  </span>
                </label>
              </div>
              <NavButtons {...navProps} nextLabel="Submit Application →" />
            </div>
          )}

          {/* ── RISK PROFILE (Tier 1 & 2) ── */}
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

              <div className="mt-5 pt-4 border-t border-[#1A3C5E]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={investorDecl}
                    onChange={e => setInvestorDecl(e.target.checked)}
                    className="mt-0.5 accent-[#C8972B] w-4 h-4 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">
                    {investorTier === 'CORPORATE'
                      ? `I confirm I am authorised to invest on behalf of ${corporate.companyName || 'the company'} and that this investment is within the company's mandate`
                      : 'I understand that investing in tokenised securities carries risk and I may lose some or all of my invested capital'}
                  </span>
                </label>
              </div>

              <NavButtons {...navProps} nextLabel="Submit KYC →" />
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
              <NavButtons {...navProps} nextLabel="Submit →" />
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
              <NavButtons {...navProps} nextLabel="Submit →" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
