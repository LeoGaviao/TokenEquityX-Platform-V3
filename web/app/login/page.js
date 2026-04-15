'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading]  = useState(false);
  const [mmLoading, setMmLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('user');
    if (token && user) {
      const u = JSON.parse(user);
      window.location.href = `/${u.role.toLowerCase()}`;
    }
  }, []);

  const redirectByRole = (role) => {
    window.location.href = `/${role.toLowerCase()}`;
 };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // If onboarding not complete, go there
      const exemptRoles = ['ADMIN','AUDITOR','PARTNER','DFI','COMPLIANCE_OFFICER'];
if (!data.user.onboarding_complete && !exemptRoles.includes(data.user.role)) {
  return window.location.href = '/onboarding';
}
      redirectByRole(data.user.role);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMask = async () => {
    if (!window.ethereum) return setError('MetaMask not detected. Please install the MetaMask browser extension.');
    setMmLoading(true);
    setError('');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const wallet   = accounts[0];
      const res  = await fetch(`${API}/auth/connect-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'MetaMask login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      const exemptRoles = ['ADMIN','AUDITOR','PARTNER','DFI','COMPLIANCE_OFFICER'];
if (!data.user.onboarding_complete && !exemptRoles.includes(data.user.role)) {
  window.location.href = '/role-select';
  return;
}
      redirectByRole(data.user.role);
    } catch (err) {
      setError('MetaMask connection was declined or failed.');
    } finally {
      setMmLoading(false);
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
          <h2 className="text-2xl font-bold text-white mb-3">Welcome back</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sign in to your dashboard — investor, issuer, auditor, or admin — to access Africa's first regulated digital capital market.
          </p>
          <div className="mt-6 space-y-2">
            {[
              ['🔐', 'Regulated under SECZ Innovation Hub Sandbox'],
              ['⛓️', 'Polygon blockchain — immutable, transparent'],
              ['💵', 'USDC settlement — no FX risk'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-gray-400 text-sm">
                <span>{icon}</span> <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-gray-600 text-xs">www.tokenequityx.com</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Sign in</h2>
            <p className="text-gray-400 text-sm mt-1">
              New to TokenEquityX?{' '}
              <Link href="/signup" className="text-[#C8972B] hover:underline">Create an account</Link>
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-500/30 text-red-300 text-sm rounded p-3">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Email Address</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full bg-[#1A3C5E] border border-[#1A3C5E] focus:border-[#C8972B] text-white rounded px-4 py-2.5 text-sm outline-none transition"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-gray-300 text-sm">Password</label>
                <Link href="/forgot-password" className="text-gray-500 text-xs hover:text-[#C8972B]">Forgot password?</Link>
              </div>
              <input
                type="password" required value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full bg-[#1A3C5E] border border-[#1A3C5E] focus:border-[#C8972B] text-white rounded px-4 py-2.5 text-sm outline-none transition"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-[#C8972B] hover:bg-[#b8872b] text-white font-semibold py-2.5 rounded text-sm transition disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="my-6 relative flex items-center">
            <div className="flex-1 border-t border-gray-700" />
            <span className="mx-4 text-gray-500 text-xs">OR</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          <button
            onClick={handleMetaMask} disabled={mmLoading}
            className="w-full bg-[#1A3C5E] border border-[#C8972B]/30 hover:border-[#C8972B] text-white py-2.5 rounded text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>🦊</span> {mmLoading ? 'Connecting…' : 'Sign in with MetaMask'}
          </button>

          <p className="text-gray-600 text-xs text-center mt-6">
            Regulated under SECZ Innovation Hub Regulatory Sandbox. Harare, Zimbabwe.
          </p>
        </div>
      </div>
    </div>
  );
}
