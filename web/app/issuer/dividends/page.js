'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

export default function IssuerDividendsPage() {
  const { ready }             = useAuth();
  const [assets,  setAssets]  = useState([]);
  const [rounds,  setRounds]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    tokenSymbol: '', roundType: 'DIVIDEND',
    totalAmountUSDC: '', description: '', claimWindowDays: 30
  });

  useEffect(() => {
    if (!ready) return;
    api.get('/assets/my').then(r => {
      setAssets(r.data);
      if (r.data.length > 0) {
        setForm(f => ({...f, tokenSymbol: r.data[0].token_symbol}));
        loadRounds(r.data[0].token_symbol);
      }
    });
  }, [ready]);

  async function loadRounds(sym) {
    try {
      const { data } = await api.get('/dividends/rounds/' + sym);
      setRounds(data);
    } catch {}
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/dividends/create', form);
      setMessage({ type: 'success', text: 'Distribution round created!' });
      loadRounds(form.tokenSymbol);
      setForm(f => ({...f, totalAmountUSDC: '', description: ''}));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    } finally { setLoading(false); }
  }

  if (!ready) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Dividend Distribution</h1>

      {message && (
        <div className={`rounded-xl p-4 mb-6 border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-red-900 border-red-700 text-red-300'
        }`}>{message.text}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4 text-yellow-400">Create Distribution Round</h3>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Asset</label>
              <select value={form.tokenSymbol}
                onChange={e => { setForm(f => ({...f, tokenSymbol: e.target.value})); loadRounds(e.target.value); }}
                className="select mt-1">
                {assets.map(a => <option key={a.token_symbol} value={a.token_symbol}>{a.token_symbol}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Distribution Type</label>
              <select value={form.roundType} onChange={e => setForm(f => ({...f, roundType: e.target.value}))} className="select mt-1">
                <option value="DIVIDEND">Dividend</option>
                <option value="COUPON">Bond Coupon</option>
                <option value="SPECIAL">Special Distribution</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Total Amount (USDC) *</label>
              <input type="number" value={form.totalAmountUSDC}
                onChange={e => setForm(f => ({...f, totalAmountUSDC: e.target.value}))}
                required className="input mt-1" placeholder="10000.00" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                className="input mt-1" placeholder="Q3 2025 Dividend" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Claim Window (days)</label>
              <input type="number" value={form.claimWindowDays}
                onChange={e => setForm(f => ({...f, claimWindowDays: e.target.value}))}
                className="input mt-1" min={7} max={90} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating...' : 'Create Distribution'}
            </button>
          </form>
        </div>

        <div>
          <h3 className="font-semibold mb-4">Distribution History</h3>
          {rounds.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No distributions yet</p>
            </div>
          )}
          <div className="space-y-3">
            {rounds.map(r => (
              <div key={r.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{r.description || r.round_type}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Deadline: {new Date(r.claim_deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">
                      ${Number(r.total_amount_usdc).toFixed(2)}
                    </p>
                    <span className={`badge ${r.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}