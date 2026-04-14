'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

const ASSET_TYPES = ['EQUITY','REAL_ESTATE','MINING','INFRASTRUCTURE','REIT','BOND','OTHER'];
const SECTORS     = ['TECH','FINTECH','AGRICULTURE','MANUFACTURING','RETAIL','MINING','REAL_ESTATE','INFRASTRUCTURE','HEALTHCARE','EDUCATION','LOGISTICS','OTHER'];

export default function RegisterAssetPage() {
  const { ready }   = useAuth();
  const router      = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    legalName: '', registrationNumber: '', jurisdiction: 'ZW',
    sector: 'TECH', assetType: 'EQUITY', description: '',
    tokenName: '', tokenSymbol: '', ticker: '',
    authorisedShares: '', nominalValueCents: '100'
  });

  function set(field, value) {
    setForm(f => ({...f, [field]: value}));
    if (field === 'tokenSymbol') {
      setForm(f => ({...f, tokenSymbol: value.toUpperCase(), ticker: value.toUpperCase()}));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/assets/register', form);
      setSuccess(`Asset registered! Token symbol: ${data.tokenSymbol}`);
      setTimeout(() => router.push('/issuer'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  }

  if (!ready) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
        <div>
          <h1 className="text-2xl font-bold">Register Asset</h1>
          <p className="text-gray-400 text-sm">Tokenize your company or asset on the blockchain</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-xl p-4 mb-6">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-900 border border-green-700 rounded-xl p-4 mb-6">
          <p className="text-green-300 text-sm">✅ {success}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">

        {/* SPV Details */}
        <div className="card">
          <h3 className="font-semibold mb-4 text-yellow-400">Legal Entity (SPV)</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Legal Name *</label>
              <input value={form.legalName} onChange={e => set('legalName', e.target.value)}
                required className="input mt-1" placeholder="Acme Corporation Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Registration Number *</label>
                <input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)}
                  required className="input mt-1" placeholder="ZW-2024-001" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Jurisdiction</label>
                <input value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)}
                  className="input mt-1" placeholder="ZW" maxLength={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Asset Type</label>
                <select value={form.assetType} onChange={e => set('assetType', e.target.value)} className="select mt-1">
                  {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Sector</label>
                <select value={form.sector} onChange={e => set('sector', e.target.value)} className="select mt-1">
                  {SECTORS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                className="input mt-1" rows={3} placeholder="Brief description of the business or asset..." />
            </div>
          </div>
        </div>

        {/* Token Details */}
        <div className="card">
          <h3 className="font-semibold mb-4 text-yellow-400">Token Parameters</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Token Name *</label>
              <input value={form.tokenName} onChange={e => set('tokenName', e.target.value)}
                required className="input mt-1" placeholder="Acme Corporation Equity" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Token Symbol *</label>
                <input value={form.tokenSymbol} onChange={e => set('tokenSymbol', e.target.value.toUpperCase())}
                  required className="input mt-1" placeholder="ACME" maxLength={10} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Nominal Value (USD cents)</label>
                <input type="number" value={form.nominalValueCents} onChange={e => set('nominalValueCents', e.target.value)}
                  className="input mt-1" placeholder="100" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Authorised Shares *</label>
              <input type="number" value={form.authorisedShares} onChange={e => set('authorisedShares', e.target.value)}
                required className="input mt-1" placeholder="1000000" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-lg">
          {loading ? 'Registering...' : '🚀 Register Asset'}
        </button>
      </form>
    </div>
  );
}