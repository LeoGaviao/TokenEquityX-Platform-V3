'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STEPS = [
  { id: 1, label: 'Welcome',    icon: '👋' },
  { id: 2, label: 'Check',      icon: '🔍' },
  { id: 3, label: 'Database',   icon: '🗄️' },
  { id: 4, label: 'Platform',   icon: '⚙️' },
  { id: 5, label: 'Demo Data',  icon: '🌱' },
  { id: 6, label: 'Complete',   icon: '🚀' },
];

export default function SetupWizard() {
  const router  = useRouter();
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [checks,  setChecks]  = useState([]);
  const [config,  setConfig]  = useState({
    adminWallet:      '',
    platformName:     'TokenEquityX',
    platformTagline:  "Africa's Digital Capital Market",
    platformUrl:      'http://localhost:3000',
    feeBps:           50,
    kycExpiryDays:    365,
    setupSecret:      '',
    loadDemoData:     true
  });

  useEffect(() => {
  // Check if setup already complete
  fetch(API + '/setup/status')
    .then(r => r.json())
    .then(data => {
      if (data.setupComplete) router.replace('/');
    })
    .catch(() => {});
}, []);

  async function post(endpoint, body) {
    const res  = await fetch(API + endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    return res.json();
  }

  async function runChecks() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API + '/setup/check');
      const data = await res.json();
      setChecks(data.checks || []);
      if (data.canProceed) {
        setStep(3);
      } else {
        setError('Some checks failed. Please fix them before continuing.');
      }
    } catch (err) {
      setError('Could not connect to API. Make sure the server is running.');
    } finally { setLoading(false); }
  }

  async function setupDatabase() {
    setLoading(true);
    setError('');
    try {
      const data = await post('/setup/database', {
        adminWallet: config.adminWallet
      });
      if (data.success) setStep(4);
      else setError(data.error || 'Database setup failed');
    } catch (err) {
      setError('Database setup failed');
    } finally { setLoading(false); }
  }

  async function setupPlatform() {
    setLoading(true);
    setError('');
    try {
      const data = await post('/setup/platform', config);
      if (data.success) setStep(5);
      else setError(data.error || 'Platform setup failed');
    } catch (err) {
      setError('Platform setup failed');
    } finally { setLoading(false); }
  }

  async function setupSeed() {
    setLoading(true);
    try {
      await post('/setup/seed', { loadDemoData: config.loadDemoData });
      setStep(6);
    } catch {}
    finally { setLoading(false); }
  }

  async function completeSetup() {
    setLoading(true);
    setError('');
    try {
      const data = await post('/setup/complete', {
        setupSecret: config.setupSecret
      });
      if (data.success) {
        setTimeout(() => router.replace('/'), 2000);
      } else {
        setError(data.error || 'Could not complete setup');
      }
    } catch (err) {
      setError('Setup completion failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">⬡</div>
          <h1 className="text-3xl font-bold text-white">TokenEquityX</h1>
          <p className="text-yellow-400 mt-1">Platform Setup Wizard</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex flex-col items-center ${step >= s.id ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  step > s.id  ? 'bg-green-600 border-green-600 text-white' :
                  step === s.id ? 'bg-yellow-500 border-yellow-500 text-black' :
                  'bg-gray-800 border-gray-700 text-gray-400'
                }`}>
                  {step > s.id ? '✓' : s.icon}
                </div>
                <span className="text-xs mt-1 text-gray-400 hidden md:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.id ? 'bg-green-600' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-xl p-4 mb-6">
              <p className="text-red-300 text-sm">❌ {error}</p>
            </div>
          )}

          {/* Step 1 — Welcome */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome to TokenEquityX</h2>
              <p className="text-gray-400 mb-6">
                This wizard will guide you through setting up your TokenEquityX platform.
                The process takes about 5 minutes.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: '🗄️', label: 'Database',  desc: 'Configure MySQL connection' },
                  { icon: '⚙️', label: 'Platform',  desc: 'Set your platform name and admin wallet' },
                  { icon: '🌱', label: 'Demo Data', desc: 'Optionally load sample assets and users' },
                  { icon: '🚀', label: 'Launch',    desc: 'Start trading on your platform' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-gray-400 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="btn-primary w-full py-3 text-lg">
                Begin Setup →
              </button>
            </div>
          )}

          {/* Step 2 — System Check */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">System Requirements</h2>
              <p className="text-gray-400 mb-6">
                Checking your system is ready for TokenEquityX.
              </p>
              {checks.length === 0 && (
                <button onClick={runChecks} disabled={loading}
                  className="btn-primary w-full py-3 mb-4">
                  {loading ? 'Checking...' : '🔍 Run System Check'}
                </button>
              )}
              {checks.length > 0 && (
                <div className="space-y-3 mb-6">
                  {checks.map(c => (
                    <div key={c.name} className={`flex items-center justify-between p-3 rounded-xl border ${
                      c.status === 'pass' ? 'bg-green-900 border-green-700' :
                      c.status === 'warn' ? 'bg-yellow-900 border-yellow-700' :
                      'bg-red-900 border-red-700'
                    }`}>
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs opacity-75">{c.message}</p>
                      </div>
                      <span className="text-xl">
                        {c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {checks.length > 0 && checks.every(c => c.status !== 'fail') && (
                <button onClick={() => setStep(3)} className="btn-primary w-full py-3">
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* Step 3 — Database */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Database Setup</h2>
              <p className="text-gray-400 mb-6">
                Your database schema has been detected. Enter your admin wallet address to create the platform administrator account.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-gray-400">Admin Wallet Address *</label>
                  <input
                    value={config.adminWallet}
                    onChange={e => setConfig(c => ({...c, adminWallet: e.target.value}))}
                    className="input mt-1"
                    placeholder="0x..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This MetaMask wallet will have full admin access to the platform.
                  </p>
                </div>
              </div>
              <button
                onClick={setupDatabase}
                disabled={loading || !config.adminWallet}
                className="btn-primary w-full py-3"
              >
                {loading ? 'Setting up...' : 'Setup Database →'}
              </button>
            </div>
          )}

          {/* Step 4 — Platform Config */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Platform Configuration</h2>
              <p className="text-gray-400 mb-6">
                Customise your platform identity and settings.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-gray-400">Platform Name</label>
                  <input value={config.platformName}
                    onChange={e => setConfig(c => ({...c, platformName: e.target.value}))}
                    className="input mt-1" placeholder="TokenEquityX" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Tagline</label>
                  <input value={config.platformTagline}
                    onChange={e => setConfig(c => ({...c, platformTagline: e.target.value}))}
                    className="input mt-1" placeholder="Africa's Digital Capital Market" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Platform URL</label>
                  <input value={config.platformUrl}
                    onChange={e => setConfig(c => ({...c, platformUrl: e.target.value}))}
                    className="input mt-1" placeholder="http://localhost:3000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Trading Fee (basis points)</label>
                    <input type="number" value={config.feeBps}
                      onChange={e => setConfig(c => ({...c, feeBps: e.target.value}))}
                      className="input mt-1" />
                    <p className="text-xs text-gray-600 mt-1">50 = 0.50%</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">KYC Expiry (days)</label>
                    <input type="number" value={config.kycExpiryDays}
                      onChange={e => setConfig(c => ({...c, kycExpiryDays: e.target.value}))}
                      className="input mt-1" />
                  </div>
                </div>
              </div>
              <button onClick={setupPlatform} disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Saving...' : 'Save Configuration →'}
              </button>
            </div>
          )}

          {/* Step 5 — Demo Data */}
          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Demo Data</h2>
              <p className="text-gray-400 mb-6">
                Would you like to load sample data to explore the platform?
                This includes 4 tokenized assets, 8 test users, live orders, proposals and dividends.
              </p>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => { setConfig(c => ({...c, loadDemoData: true})); }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    config.loadDemoData
                      ? 'border-yellow-500 bg-yellow-900/20'
                      : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <p className="font-semibold">🌱 Load Demo Data</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Recommended for evaluation. Includes ACME, HCPR, GDMR and ZWIB tokens.
                  </p>
                </button>
                <button
                  onClick={() => { setConfig(c => ({...c, loadDemoData: false})); }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    !config.loadDemoData
                      ? 'border-yellow-500 bg-yellow-900/20'
                      : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <p className="font-semibold">🏦 Clean Installation</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Empty platform ready for real companies and investors.
                  </p>
                </button>
              </div>
              <button onClick={setupSeed} disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Preparing...' : 'Continue →'}
              </button>
            </div>
          )}

          {/* Step 6 — Complete */}
          {step === 6 && (
            <div className="text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
              <p className="text-gray-400 mb-8">
                TokenEquityX is configured and ready to launch.
                {config.loadDemoData && ' Run the seed script to load demo data:'}
              </p>

              {config.loadDemoData && (
                <div className="bg-gray-800 rounded-xl p-4 mb-6 text-left">
                  <p className="text-xs text-gray-400 mb-2">Run in terminal:</p>
                  <code className="text-yellow-400 text-sm">node api/src/db/seed.js</code>
                </div>
              )}

              <div className="space-y-3 mb-8">
                {[
                  { label: 'Admin Wallet',  value: config.adminWallet?.slice(0,10) + '...' },
                  { label: 'Platform Name', value: config.platformName },
                  { label: 'Trading Fee',   value: config.feeBps / 100 + '%' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-xs text-gray-400">Setup Secret (from your .env file)</label>
                <input
                  type="password"
                  value={config.setupSecret}
                  onChange={e => setConfig(c => ({...c, setupSecret: e.target.value}))}
                  className="input mt-1"
                  placeholder="Enter your SETUP_SECRET value"
                />
              </div>

              <button
                onClick={completeSetup}
                disabled={loading || !config.setupSecret}
                className="btn-primary w-full py-4 text-lg"
              >
                {loading ? 'Finalising...' : '🚀 Launch Platform'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          TokenEquityX V3  |  Setup Wizard  |  Harare, Zimbabwe
        </p>
      </div>
    </div>
  );
}