'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import axios from 'axios';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const NAVY = '#1A3C5E';
const GOLD = '#C8972B';

const TICKER_ASSETS = [
  { symbol:'ZWIB', name:'ZimInfra Bond',     price:1.0240, change:+0.82, yield_pa:8.5 },
  { symbol:'HCPR', name:'Harare CBD REIT',   price:1.0050, change:-0.12, yield_pa:9.2 },
  { symbol:'ACME', name:'Acme Mining',        price:0.9820, change:+1.45, yield_pa:0   },
  { symbol:'GDMR', name:'Great Dyke Minerals',price:1.0150, change:+0.32, yield_pa:0   },
];

const FEATURES = [
  { icon:'⛓️', title:'Blockchain-Secured',  desc:'Every token, trade and distribution is settled on-chain via audited smart contracts on Polygon. Immutable, transparent, trustless.' },
  { icon:'🏛️', title:'SECZ Regulated',      desc:'Operating under the Securities and Exchange Commission of Zimbabwe Innovation Hub Sandbox. Full regulatory oversight.' },
  { icon:'💵', title:'USDC Settlement',     desc:'All transactions settle in USD Coin — a dollar-backed stablecoin — giving you USD exposure without currency risk.' },
  { icon:'🌍', title:'Pan-African Vision',  desc:'Starting in Zimbabwe and expanding across SADC. Bringing institutional-grade capital markets infrastructure to Africa.' },
  { icon:'📊', title:'Real-Time Pricing',   desc:'Independent oracle-based pricing updated by certified auditors. No manipulation. No black boxes.' },
  { icon:'🔒', title:'Audited Security',    desc:'Smart contracts audited by leading blockchain security firms. KYC/AML compliant. Your assets are protected.' },
];

const ASSET_CLASSES = [
  { icon:'🏢', label:'Real Estate',     desc:'Commercial property REITs and SPVs. Earn rental income as token distributions.' },
  { icon:'⛏️', label:'Mining & PGMs',  desc:'Platinum group metals, gold, and base metals. Exposure to Zimbabwe\'s vast mineral wealth.' },
  { icon:'📜', label:'Bonds',           desc:'Fixed-income infrastructure and corporate bonds. Predictable coupon payments.' },
  { icon:'🔌', label:'Infrastructure',  desc:'Toll roads, energy, telecoms. Long-term concession revenue.' },
  { icon:'📈', label:'Equity',          desc:'Tokenised shares in private companies. Participate in growth from day one.' },
  { icon:'🌱', label:'Agriculture',     desc:'Farmland and agri-processing. Zimbabwe\'s productive sector, tokenised.' },
];

const STATS = [
  { value:'$1.28M', label:'Assets Under Management' },
  { value:'4',      label:'Live Listed Assets'       },
  { value:'342',    label:'Registered Investors'     },
  { value:'9.2%',   label:'Highest Current Yield'    },
];

// ── MetaMask connect button ──────────────────────────────────────
function ConnectButton({ label = 'Access Platform', size = 'lg' }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [status,  setStatus]  = useState('');

  async function connect() {
    setError(''); setLoading(true);
    try {
      if (!window.ethereum) { setError('MetaMask not found. Please install MetaMask.'); setLoading(false); return; }
      setStatus('Connecting…');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const wallet   = accounts[0];
      const signer   = await provider.getSigner();
      setStatus('Requesting sign-in message…');
      const { data: nonceData } = await axios.get(`${API}/auth/nonce`, { params: { wallet } });
      setStatus('Sign in MetaMask…');
      const signature = await signer.signMessage(nonceData.message);
      setStatus('Verifying…');
      const { data: authData } = await axios.post(`${API}/auth/login`, { walletAddress: wallet, signature, nonce: nonceData.nonce });
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user',  JSON.stringify(authData.user));
      const role = authData.user.role;
      if      (role === 'ADMIN')              window.location.href = '/admin';
      else if (role === 'AUDITOR')            window.location.href = '/auditor';
      else if (role === 'COMPLIANCE_OFFICER') window.location.href = '/auditor';
      else if (role === 'ISSUER')             window.location.href = '/issuer';
      else if (role === 'PARTNER')            window.location.href = '/partner';
      else                                    window.location.href = '/investor';
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Please make sure MySQL and the API (node app.js) are running on port 3001.');
      } else {
        setError(err.response?.data?.error || err.message || 'Login failed.');
      }
      setStatus('');
    } finally { setLoading(false); }
  }

  const py = size === 'sm' ? 'py-2 px-5 text-sm' : 'py-3.5 px-8 text-base';

  return (
    <div className="flex flex-col items-center gap-2">
      {error  && <p className="text-red-400 text-xs text-center max-w-xs">{error}</p>}
      {status && <p className="text-blue-400 text-xs text-center">{status}</p>}
      <button onClick={connect} disabled={loading}
        className={`${py} rounded-xl font-black text-gray-900 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg`}
        style={{ background: GOLD }}>
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Connecting…
          </>
        ) : (
          <>🦊 {label}</>
        )}
      </button>
    </div>
  );
}

// ── Bottom login/signup panel ────────────────────────────────────
function AccessPanel() {
  const router = useRouter();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', full_name: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectByRole = (role) => {
    const map = { ADMIN:'/admin', AUDITOR:'/auditor', COMPLIANCE_OFFICER:'/auditor', ISSUER:'/issuer', PARTNER:'/partner' };
    window.location.href = map[role] || '/investor';
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  setError(''); setLoading(true);
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password }),
    });
    const data = await res.json();
    console.log('Login response:', data);
    if (!res.ok) return setError(data.error || 'Login failed');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    console.log('onboarding_complete:', data.user.onboarding_complete);
    console.log('role:', data.user.role);
    // Only send to onboarding if not complete AND no KYC already submitted
    const needsOnboarding = !data.user.onboarding_complete &&
      (!data.user.kyc_status || data.user.kyc_status === 'NONE');
    if (needsOnboarding) return router.push('/onboarding');
    redirectByRole(data.user.role);
  } catch(err) { 
    console.error('Login error:', err);
    setError('Cannot reach server. Is the API running?'); 
  }
  finally { setLoading(false); }
};

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Signup failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/role-select');
    } catch { setError('Cannot reach server. Is the API running?'); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700 mb-6">
        {['login','signup'].map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold transition-all ${tab === t ? 'text-gray-900' : 'text-gray-400 hover:text-white'}`}
            style={tab === t ? { background: GOLD } : {}}>
            {t === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs text-center mb-4 bg-red-900/20 border border-red-800 rounded-lg p-2">{error}</p>}

      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-3">
          <input type="email" required placeholder="Email address" value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 focus:border-yellow-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition"/>
          <input type="password" required placeholder="Password" value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 focus:border-yellow-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition"/>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-black text-gray-900 text-sm disabled:opacity-50 transition hover:opacity-90"
            style={{ background: GOLD }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-3">
          <input type="text" required placeholder="Full name" value={form.full_name}
            onChange={e => setForm({...form, full_name: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 focus:border-yellow-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition"/>
          <input type="email" required placeholder="Email address" value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 focus:border-yellow-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition"/>
          <input type="password" required placeholder="Password (min 8 characters)" value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 focus:border-yellow-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition"/>
          <input type="password" required placeholder="Confirm password" value={form.confirm}
            onChange={e => setForm({...form, confirm: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 focus:border-yellow-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition"/>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-black text-gray-900 text-sm disabled:opacity-50 transition hover:opacity-90"
            style={{ background: GOLD }}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      )}

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 border-t border-gray-700"/>
        <span className="text-gray-600 text-xs">OR</span>
        <div className="flex-1 border-t border-gray-700"/>
      </div>

      <ConnectButton label="Connect MetaMask" size="lg"/>

      <div className="grid grid-cols-3 gap-3 mt-6">
        {[{icon:'🔒',label:'Secure'},{icon:'✅',label:'Regulated'},{icon:'⚡',label:'Instant'}].map(item => (
          <div key={item.label} className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">{item.icon}</div>
            <p className="text-gray-400 text-xs">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function HomePage() {
  const router  = useRouter();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">

        {/* Background grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage:`linear-gradient(${NAVY} 1px, transparent 1px), linear-gradient(90deg, ${NAVY} 1px, transparent 1px)`, backgroundSize:'60px 60px' }}/>

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background:NAVY, transform:`translateY(${scrollY*0.1}px)` }}/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background:GOLD, transform:`translateY(${-scrollY*0.08}px)` }}/>

        <div className="relative z-10 max-w-5xl mx-auto text-center">

          {/* ── Top auth buttons ─────────────────────────────── */}
          <div className="mb-8 flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior:'smooth' })}
              className="py-2 px-5 rounded-xl font-black text-sm text-gray-900 transition hover:opacity-90"
              style={{ background: GOLD }}>
              Sign In
            </button>
            <button onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior:'smooth' })}
              className="py-2 px-5 rounded-xl font-black text-sm text-white border border-gray-600 hover:border-gray-400 transition">
              Create Account
            </button>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gray-900/80 border border-gray-700 rounded-full px-4 py-2 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-gray-300">SECZ Innovation Hub Sandbox · Live</span>
          </div>

          {/* Brand name */}
          <p className="font-black text-white text-xl tracking-tight mb-4">TokenEquityX</p>

          <h1 className="text-5xl md:text-7xl font-black leading-none mb-6">
            <span className="text-white">Africa's Digital</span><br/>
            <span style={{ color:GOLD }}>Capital Market</span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
            Invest in tokenised real estate, mining, bonds and infrastructure across Zimbabwe and beyond.
            Blockchain-secured. USDC-settled. Regulated by SECZ.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
            {STATS.map((s,i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-black" style={{ color:GOLD }}>{s.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── CTA buttons ──────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <button
              onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior:'smooth' })}
              className="px-8 py-3.5 rounded-xl font-black text-base text-gray-900 transition hover:opacity-90 shadow-lg"
              style={{ background: GOLD }}>
              Start Investing Now
            </button>
            <button onClick={() => document.getElementById('asset-classes')?.scrollIntoView({ behavior:'smooth' })}
              className="px-8 py-3.5 rounded-xl font-black text-base text-white border border-gray-700 hover:border-gray-500 hover:bg-white/5 transition-all">
              Explore Asset Classes ↓
            </button>
          </div>

          {/* Live ticker */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-gray-600 text-xs uppercase tracking-wider">Live Prices</p>
              <div className="flex flex-wrap gap-6">
                {TICKER_ASSETS.map(a => (
                  <div key={a.symbol} className="flex items-center gap-3">
                    <div>
                      <span className="font-bold text-sm">{a.symbol}</span>
                      {a.yield_pa > 0 && <span className="ml-1 text-xs text-green-400">{a.yield_pa}%</span>}
                    </div>
                    <span className="font-mono text-sm">${a.price.toFixed(4)}</span>
                    <span className={`text-xs font-bold ${a.change>=0?'text-green-400':'text-red-400'}`}>
                      {a.change>=0?'▲':'▼'}{Math.abs(a.change).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push('/market-watch')}
                className="text-xs text-blue-400 hover:text-blue-300">Pricesheet →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── ASSET CLASSES ─────────────────────────────────────── */}
      <section id="asset-classes" className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Invest Across Asset Classes</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Every asset class that drives Africa's economy — now accessible through a single regulated platform.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ASSET_CLASSES.map((a,i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 transition-all cursor-pointer group"
                onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior:'smooth' })}>
                <span className="text-4xl mb-4 block">{a.icon}</span>
                <h3 className="font-bold text-lg mb-2 group-hover:text-yellow-400 transition-colors">{a.label}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-gray-800"
        style={{ background:'linear-gradient(to bottom, transparent, #0d111a, transparent)' }}>
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Built for the Future of African Finance</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Enterprise-grade infrastructure that democratises access to capital markets across the continent.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {FEATURES.map((f,i) => (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">How It Works</h2>
            <p className="text-gray-400">Three steps to start investing in Africa's tokenised economy.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step:'01', title:'Create Your Account', desc:'Sign up with email or connect MetaMask. Complete KYC verification in minutes.' },
              { step:'02', title:'Browse Listed Assets', desc:'Explore bonds, REITs, mining equity and more. Read management statements and financials.' },
              { step:'03', title:'Invest & Earn',        desc:'Buy tokens with USDC. Receive distributions directly to your wallet. Trade anytime.' },
            ].map((s,i) => (
              <div key={i} className="relative text-center">
                <div className="text-7xl font-black mb-4 opacity-10" style={{ color:GOLD }}>{s.step}</div>
                <h3 className="font-bold text-xl mb-3 -mt-6">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACCESS PANEL ──────────────────────────────────────── */}
      <section id="login-section" className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black"
                style={{ background:`linear-gradient(135deg, ${NAVY}, #2563eb)` }}>
                <span className="text-white">TX</span>
              </div>
              <span className="font-black text-white text-lg">TokenEquityX</span>
            </div>
            <h2 className="text-3xl font-black mb-3">Access the Platform</h2>
            <p className="text-gray-400 text-sm">Sign in with email or connect your MetaMask wallet.</p>
          </div>
          <AccessPanel />
        </div>
      </section>

      {/* ── DISCLAIMER ────────────────────────────────────────── */}
      <section className="py-8 px-6 border-t border-gray-900">
        <div className="max-w-screen-xl mx-auto">
          <p className="text-center text-gray-700 text-xs leading-relaxed max-w-4xl mx-auto">
            TokenEquityX Ltd is registered in Zimbabwe and operates under the SECZ Innovation Hub Regulatory Sandbox.
            Digital token investment carries risk including loss of capital. Past performance is not indicative of future results.
            This platform is available to KYC-verified investors only. Please read all relevant disclosure documents before investing.
          </p>
        </div>
      </section>
    </div>
  );
}
