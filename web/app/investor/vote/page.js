'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

export default function VotePage() {
  const { ready }               = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [voting,    setVoting]    = useState({});
  const [message,   setMessage]   = useState(null);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready]);

  async function load() {
    try {
      const { data } = await api.get('/governance/proposals');
      setProposals(data.filter(p => p.status === 'ACTIVE'));
    } catch {}
    finally { setLoading(false); }
  }

  async function vote(proposalId, choice) {
    setVoting(v => ({...v, [proposalId]: choice}));
    setMessage(null);
    try {
      await api.post('/governance/vote', { proposalId, choice });
      setMessage({ type: 'success', text: `Vote cast: ${choice}` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Vote failed' });
    } finally {
      setVoting(v => ({...v, [proposalId]: null}));
    }
  }

  if (!ready || loading) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Governance Voting</h1>
      <p className="text-gray-400 text-sm mb-8">Vote on company proposals proportional to your token holdings</p>

      {message && (
        <div className={`rounded-xl p-4 mb-6 border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-red-900 border-red-700 text-red-300'
        }`}>{message.text}</div>
      )}

      {proposals.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🗳️</div>
          <p className="text-gray-400">No active proposals at this time</p>
        </div>
      )}

      <div className="space-y-4">
        {proposals.map(p => {
          const total   = Number(p.votes_for) + Number(p.votes_against) + Number(p.votes_abstain);
          const forPct  = total > 0 ? (Number(p.votes_for)     / total * 100).toFixed(1) : 0;
          const agPct   = total > 0 ? (Number(p.votes_against) / total * 100).toFixed(1) : 0;
          const daysLeft = Math.max(0, Math.ceil((new Date(p.end_time) - new Date()) / (1000*60*60*24)));

          return (
            <div key={p.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{p.title}</span>
                    <span className={`badge ${p.resolution_type === 'SPECIAL' ? 'badge-purple' : 'badge-blue'}`}>
                      {p.resolution_type}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{p.token_symbol} — {p.company_name}</p>
                </div>
                <span className="text-yellow-400 text-sm">{daysLeft}d left</span>
              </div>

              {p.description && (
                <p className="text-gray-300 text-sm mb-4">{p.description}</p>
              )}

              {/* Vote bars */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>FOR: {p.votes_for} ({forPct}%)</span>
                  <span>AGAINST: {p.votes_against} ({agPct}%)</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: forPct + '%' }}
                  />
                </div>
              </div>

              {/* Vote buttons */}
              <div className="flex gap-2">
                {['FOR','AGAINST','ABSTAIN'].map(c => (
                  <button
                    key={c}
                    onClick={() => vote(p.id, c)}
                    disabled={!!voting[p.id]}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      c === 'FOR'     ? 'bg-green-800 hover:bg-green-700 text-green-300' :
                      c === 'AGAINST' ? 'bg-red-800 hover:bg-red-700 text-red-300' :
                      'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    {voting[p.id] === c ? 'Voting...' : c}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}