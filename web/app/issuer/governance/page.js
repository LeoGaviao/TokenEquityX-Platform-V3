'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

export default function IssuerGovernancePage() {
  const { ready }                 = useAuth();
  const [assets,    setAssets]    = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState(null);
  const [form, setForm] = useState({
    tokenSymbol: '', title: '', description: '',
    resolutionType: 'ORDINARY', votingDays: 7
  });

  useEffect(() => {
    if (!ready) return;
    api.get('/assets/my').then(r => {
      setAssets(r.data);
      if (r.data.length > 0) {
        setForm(f => ({...f, tokenSymbol: r.data[0].token_symbol}));
        loadProposals(r.data[0].token_symbol);
      }
    });
  }, [ready]);

  async function loadProposals(sym) {
    try {
      const { data } = await api.get('/governance/proposals/' + sym);
      setProposals(data);
    } catch {}
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/governance/proposals', form);
      setMessage({ type: 'success', text: 'Proposal created successfully!' });
      loadProposals(form.tokenSymbol);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    } finally { setLoading(false); }
  }

  if (!ready) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Governance</h1>

      {message && (
        <div className={`rounded-xl p-4 mb-6 border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-red-900 border-red-700 text-red-300'
        }`}>{message.text}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4 text-yellow-400">Create Proposal</h3>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Asset</label>
              <select value={form.tokenSymbol}
                onChange={e => { setForm(f => ({...f, tokenSymbol: e.target.value})); loadProposals(e.target.value); }}
                className="select mt-1">
                {assets.map(a => <option key={a.token_symbol} value={a.token_symbol}>{a.token_symbol}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                required className="input mt-1" placeholder="Q3 Dividend Approval" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                className="input mt-1" rows={4} placeholder="Describe the proposal..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Resolution Type</label>
                <select value={form.resolutionType} onChange={e => setForm(f => ({...f, resolutionType: e.target.value}))} className="select mt-1">
                  <option value="ORDINARY">Ordinary (50%+)</option>
                  <option value="SPECIAL">Special (75%+)</option>
                  <option value="BOARD">Board Resolution</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Voting Days</label>
                <input type="number" value={form.votingDays} onChange={e => setForm(f => ({...f, votingDays: e.target.value}))}
                  className="input mt-1" min={2} max={30} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating...' : 'Create Proposal'}
            </button>
          </form>
        </div>

        <div>
          <h3 className="font-semibold mb-4">Recent Proposals</h3>
          {proposals.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No proposals yet</p>
            </div>
          )}
          <div className="space-y-3">
            {proposals.map(p => (
              <div key={p.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-sm">{p.title}</p>
                  <span className={`badge ${
                    p.status === 'ACTIVE'   ? 'badge-blue'   :
                    p.status === 'PASSED'   ? 'badge-green'  :
                    p.status === 'REJECTED' ? 'badge-red'    :
                    'badge-gray'
                  }`}>{p.status}</span>
                </div>
                <div className="text-xs text-gray-500">
                  For: {p.votes_for} | Against: {p.votes_against} | Abstain: {p.votes_abstain}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Ends: {new Date(p.end_time).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}