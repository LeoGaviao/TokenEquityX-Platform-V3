'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm]   = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Signup failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/role-select');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-[#1A3C5E] border-r border-[#C8972B]/20">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-widest">TOKEN<br/>EQUITY<br/>X</h1>
          <div className="mt-2 h-1 w-16 bg-[#C8972B]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Africa's Digital Capital Market</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Invest in tokenised real-world assets — real estate, mining, infrastructure bonds —
            regulated by the Securities and Exchange Commission of Zimbabwe.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[['4', 'Live Assets'],['USD 10M+', 'Total AUM'],['11', 'Smart Contracts'],['SECZ', 'Regulated']].map(([v,l]) => (
              <div key={l} className="bg-[#0D2137] rounded p-3">
                <div className="text-[#C8972B] font-bold text-lg">{v}</div>
                <div className="text-gray-400 text-xs">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-gray-600 text-xs">www.tokenequityx.com</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Create your account</h2>
            <p className="text-gray-400 text-sm mt-1">Already have an account? <Link href="/login" className="text-[#C8972B] hover:underline">Sign in</Link></p>
          </div>

          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-500/30 text-red-300 text-sm rounded p-3">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Full Name</label>
              <input
                type="text" required value={form.full_name}
                onChange={e => setForm({...form, full_name: e.target.value})}
                placeholder="As it appears on your ID"
                className="w-full bg-[#1A3C5E] border border-[#1A3C5E] focus:border-[#C8972B] text-white rounded px-4 py-2.5 text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Email Address</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="you@example.com"
                className="w-full bg-[#1A3C5E] border border-[#1A3C5E] focus:border-[#C8972B] text-white rounded px-4 py-2.5 text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Password</label>
              <input
                type="password" required value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                placeholder="Minimum 8 characters"
                className="w-full bg-[#1A3C5E] border border-[#1A3C5E] focus:border-[#C8972B] text-white rounded px-4 py-2.5 text-sm outline-none transition"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Confirm Password</label>
              <input
                type="password" required value={form.confirm}
                onChange={e => setForm({...form, confirm: e.target.value})}
                placeholder="Repeat your password"
                className="w-full bg-[#1A3C5E] border border-[#1A3C5E] focus:border-[#C8972B] text-white rounded px-4 py-2.5 text-sm outline-none transition"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-[#C8972B] hover:bg-[#b8872b] text-white font-semibold py-2.5 rounded text-sm transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-gray-700" />
              <span className="mx-4 text-gray-500 text-xs">OR</span>
              <div className="flex-1 border-t border-gray-700" />
            </div>
            <button
              onClick={async () => {
                if (!window.ethereum) return alert('MetaMask not detected. Please install MetaMask.');
                try {
                  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                  const wallet   = accounts[0];
                  const res = await fetch('/api/auth/connect-wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet })
                  });
                  const data = await res.json();
                  if (!res.ok) return setError(data.error);
                  localStorage.setItem('token', data.token);
                  localStorage.setItem('user', JSON.stringify(data.user));
                  router.push('/role-select');
                } catch(err) {
                  setError('MetaMask connection failed');
                }
              }}
              className="mt-4 w-full bg-[#1A3C5E] border border-[#C8972B]/30 hover:border-[#C8972B] text-white py-2.5 rounded text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <span>🦊</span> Connect with MetaMask
            </button>
          </div>

          <p className="text-gray-600 text-xs text-center mt-6">
            By creating an account you agree to our Terms of Service and Privacy Policy.
            All investments are subject to risk. Regulated under SECZ Innovation Hub Sandbox.
          </p>
        </div>
      </div>
    </div>
  );
}
