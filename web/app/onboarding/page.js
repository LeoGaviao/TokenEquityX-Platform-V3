'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 'identity', label: 'Identity',        icon: '🪪' },
  { id: 'address',  label: 'Address',         icon: '🏠' },
  { id: 'funds',    label: 'Source of Funds', icon: '💰' },
  { id: 'risk',     label: 'Risk Profile',    icon: '📊' },
  { id: 'review',   label: 'Submit',          icon: '✅' },
];

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
      { label: 'Less than 1 year',    score: 1 },
      { label: '1 – 3 years',         score: 2 },
      { label: '3 – 7 years',         score: 3 },
      { label: 'More than 7 years',   score: 4 },
    ],
  },
  {
    id: 'reaction',
    question: 'If your portfolio dropped 20% in one month, you would…',
    options: [
      { label: 'Sell everything immediately',             score: 1 },
      { label: 'Sell some to reduce risk',                score: 2 },
      { label: 'Hold and wait for recovery',              score: 3 },
      { label: 'Buy more at the lower price',             score: 4 },
    ],
  },
  {
    id: 'experience',
    question: 'How would you describe your investment experience?',
    options: [
      { label: 'None — this is my first investment',                         score: 1 },
      { label: 'Some — stocks or savings accounts',                          score: 2 },
      { label: 'Experienced — bonds, unit trusts, or alternatives',          score: 3 },
      { label: 'Expert — digital assets, private equity, or derivatives',    score: 4 },
    ],
  },
  {
    id: 'income',
    question: 'What is your approximate annual income (USD)?',
    options: [
      { label: 'Under $10,000',          score: 1 },
      { label: '$10,000 – $50,000',      score: 2 },
      { label: '$50,000 – $150,000',     score: 3 },
      { label: 'Over $150,000',          score: 4 },
    ],
  },
  {
    id: 'liquidity',
    question: 'How soon might you need access to these funds?',
    options: [
      { label: 'Within 6 months',           score: 1 },
      { label: 'Within 1 – 2 years',        score: 2 },
      { label: 'Can lock away 3 – 5 years', score: 3 },
      { label: 'No foreseeable need',       score: 4 },
    ],
  },
];

function calculateRiskProfile(answers) {
  const total = Object.values(answers).reduce((s, v) => s + v, 0);
  let profile;
  if (total <= 10) profile = 'CONSERVATIVE';
  else if (total <= 15) profile = 'BALANCED';
  else if (total <= 20) profile = 'GROWTH';
  else profile = 'SPECULATIVE';
  return { profile, score: total };
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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]           = useState(0);
  const [user, setUser]           = useState(null);
  const [files, setFiles]         = useState({ id_doc: null, proof_address: null, source_funds: null });
  const [riskAnswers, setRiskAnswers] = useState({});
  const [riskResult, setRiskResult]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) return router.push('/signup');
    const u = JSON.parse(stored);
    setUser(u);
    // Issuers and Partners skip full KYC onboarding — they do it in their dashboard
    if (u.role === 'ISSUER' || u.role === 'PARTNER') {
      // Mark onboarding complete immediately and redirect
      const token = localStorage.getItem('token');
      fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      }).then(() => {
        const updatedUser = { ...u, onboarding_complete: 1 };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        router.push(`/${u.role.toLowerCase()}`);
      });
    }
  }, []);

  const uploadFile = (field, file) => setFiles(prev => ({ ...prev, [field]: file }));

  const answerRisk = (questionId, score) => {
    const updated = { ...riskAnswers, [questionId]: score };
    setRiskAnswers(updated);
    if (Object.keys(updated).length === RISK_QUESTIONS.length) {
      setRiskResult(calculateRiskProfile(updated));
    }
  };

  const allRiskAnswered = Object.keys(riskAnswers).length === RISK_QUESTIONS.length;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      if (files.id_doc)        formData.append('id_doc', files.id_doc);
      if (files.proof_address) formData.append('proof_address', files.proof_address);
      if (files.source_funds)  formData.append('source_funds', files.source_funds);
      formData.append('riskProfile', riskResult?.profile || 'BALANCED');
      formData.append('riskScore',   String(riskResult?.score || 0));
      formData.append('riskAnswers', JSON.stringify(riskAnswers));

      await fetch('/api/kyc/submit', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData
      });

      await fetch('/api/auth/complete-onboarding', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      setSubmitted(true);

      const updatedUser = { ...user, onboarding_complete: 1, kyc_status: 'PENDING' };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setTimeout(() => {
        const role = user?.role?.toLowerCase() || 'investor';
        router.push(`/${role}`);
      }, 3000);
    } catch {
      alert('Submission failed. Please try again.');
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
            Your documents are under review. We'll approve your account within 24-48 hours.
            You'll be redirected to your dashboard now.
          </p>
          <div className="mt-4 text-[#C8972B] text-sm">Redirecting…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-[#C8972B] font-bold tracking-widest text-sm mb-2">STEP 3 OF 3</div>
          <h1 className="text-3xl font-bold text-white">KYC Verification</h1>
          <p className="text-gray-400 text-sm mt-2">
            Required by law under Zimbabwe's AML regulations. Documents are reviewed within 24-48 hours.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-between mb-8 px-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex flex-col items-center ${i <= step ? 'text-[#C8972B]' : 'text-gray-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
                  i < step  ? 'bg-[#C8972B] border-[#C8972B]' :
                  i === step ? 'border-[#C8972B]' : 'border-gray-700'
                }`}>
                  {i < step ? '✓' : s.icon}
                </div>
                <div className="text-xs mt-1 hidden sm:block">{s.label}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-[#C8972B]' : 'bg-gray-700'}`} style={{width: '32px'}} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-[#0D2137] border border-[#1A3C5E] rounded-lg p-6">

          {/* Step 0 — Identity */}
          {step === 0 && (
            <div>
              <h3 className="text-white font-bold mb-2">Government-issued photo ID</h3>
              <p className="text-gray-400 text-sm mb-4">
                National ID card, passport, or driver's licence. Must show your full name, photo, and date of birth.
              </p>
              <FileUpload
                label="Upload ID Document"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={f => uploadFile('id_doc', f)}
                file={files.id_doc}
              />
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(1)} disabled={!files.id_doc}
                  className="bg-[#C8972B] text-white px-6 py-2 rounded text-sm disabled:opacity-40"
                >Next →</button>
              </div>
            </div>
          )}

          {/* Step 1 — Address */}
          {step === 1 && (
            <div>
              <h3 className="text-white font-bold mb-2">Proof of Address</h3>
              <p className="text-gray-400 text-sm mb-4">
                Utility bill or bank statement dated within the last 3 months. Must show your name and address.
              </p>
              <FileUpload
                label="Upload Proof of Address"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={f => uploadFile('proof_address', f)}
                file={files.proof_address}
              />
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(0)} className="text-gray-400 text-sm">← Back</button>
                <button
                  onClick={() => setStep(2)} disabled={!files.proof_address}
                  className="bg-[#C8972B] text-white px-6 py-2 rounded text-sm disabled:opacity-40"
                >Next →</button>
              </div>
            </div>
          )}

          {/* Step 2 — Source of Funds */}
          {step === 2 && (
            <div>
              <h3 className="text-white font-bold mb-2">Source of Funds Declaration</h3>
              <p className="text-gray-400 text-sm mb-4">
                Bank statement, payslip, or tax return showing the origin of the funds you'll invest.
                This is a legal requirement under Zimbabwe's Financial Intelligence Unit regulations.
              </p>
              <FileUpload
                label="Upload Source of Funds Document"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={f => uploadFile('source_funds', f)}
                file={files.source_funds}
              />
              <p className="text-gray-600 text-xs mt-2">
                Acceptable: Bank statements (3 months), payslips, business financial statements, inheritance/gift documentation.
              </p>
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(1)} className="text-gray-400 text-sm">← Back</button>
                <button
                  onClick={() => setStep(3)} disabled={!files.source_funds}
                  className="bg-[#C8972B] text-white px-6 py-2 rounded text-sm disabled:opacity-40"
                >Next: Risk Profile →</button>
              </div>
            </div>
          )}

          {/* Step 3 — Risk Questionnaire */}
          {step === 3 && (
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
                        <button
                          key={opt.score}
                          onClick={() => answerRisk(q.id, opt.score)}
                          className={`w-full text-left px-3 py-2 rounded text-sm border transition ${
                            riskAnswers[q.id] === opt.score
                              ? 'border-[#C8972B] bg-[#C8972B]/10 text-white'
                              : 'border-[#1A3C5E] text-gray-400 hover:border-[#C8972B]/50'
                          }`}
                        >
                          {opt.label}
                        </button>
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

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="text-gray-400 text-sm">← Back</button>
                <button
                  onClick={() => setStep(4)} disabled={!allRiskAnswered}
                  className="bg-[#C8972B] text-white px-6 py-2 rounded text-sm disabled:opacity-40"
                >Review →</button>
              </div>
            </div>
          )}

          {/* Step 4 — Review & Submit */}
          {step === 4 && (
            <div>
              <h3 className="text-white font-bold mb-4">Review & Submit</h3>
              <div className="space-y-3 mb-4">
                {[
                  ['Identity Document', files.id_doc],
                  ['Proof of Address', files.proof_address],
                  ['Source of Funds', files.source_funds],
                ].map(([label, file]) => (
                  <div key={label} className="flex items-center justify-between bg-[#1A3C5E] rounded p-3">
                    <span className="text-gray-300 text-sm">{label}</span>
                    <span className={`text-xs ${file ? 'text-green-400' : 'text-red-400'}`}>
                      {file ? `✓ ${file.name}` : '✗ Missing'}
                    </span>
                  </div>
                ))}
                {riskResult && (
                  <div className="flex items-center justify-between bg-[#1A3C5E] rounded p-3">
                    <span className="text-gray-300 text-sm">Risk Profile</span>
                    <span className={`text-xs font-semibold ${PROFILE_COLORS[riskResult.profile]}`}>
                      ✓ {riskResult.profile} (score {riskResult.score}/24)
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-[#1A3C5E]/50 rounded p-4 mb-6">
                <p className="text-gray-300 text-xs leading-relaxed">
                  By submitting, you confirm that all documents are genuine, you are the person named in the documents,
                  and you consent to TokenEquityX retaining these documents for regulatory compliance purposes.
                  Review typically takes 24-48 hours. You will be notified by email when approved.
                </p>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(3)} className="text-gray-400 text-sm">← Back</button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !files.id_doc || !files.proof_address || !files.source_funds || !allRiskAnswered}
                  className="bg-[#C8972B] text-white px-8 py-2 rounded text-sm font-semibold disabled:opacity-40"
                >
                  {loading ? 'Submitting…' : 'Submit KYC Documents'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* KYC is mandatory — no skip allowed */}
      </div>
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
            <div className="text-gray-600 text-xs mt-1">PDF, JPG, PNG — max 10MB</div>
          </div>
        )}
      </div>
      <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
    </label>
  );
}
