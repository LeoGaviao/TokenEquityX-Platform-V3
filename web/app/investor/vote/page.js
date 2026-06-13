'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const dt  = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function VotePage() {
  const { ready }                       = useAuth();
  const [proposals,  setProposals]      = useState([]);
  const [myVotes,    setMyVotes]        = useState([]);
  const [holdings,   setHoldings]       = useState([]);
  const [loading,    setLoading]        = useState(true);
  const [voting,     setVoting]         = useState({});
  const [activeTab,  setActiveTab]      = useState('active');
  const [message,    setMessage]        = useState(null);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready]);

  async function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const u     = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const uid   = u?.id || 'me';
    const hdrs  = { Authorization: `Bearer ${token}` };
    try {
      const [propRes, voteRes, holdRes] = await Promise.allSettled([
        fetch(`${API}/governance/proposals`, { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/governance/my-votes`,  { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/kyc/holdings/${uid}`,  { headers: hdrs }).then(r => r.json()),
      ]);
      if (propRes.status === 'fulfilled' && Array.isArray(propRes.value)) setProposals(propRes.value);
      if (voteRes.status === 'fulfilled' && Array.isArray(voteRes.value)) setMyVotes(voteRes.value);
      if (holdRes.status === 'fulfilled' && Array.isArray(holdRes.value)) setHoldings(holdRes.value);
    } catch {}
    finally { setLoading(false); }
  }

  async function vote(proposalId, choice) {
    setVoting(v => ({ ...v, [proposalId]: choice }));
    setMessage(null);
    try {
      await api.post('/governance/vote', { proposalId, choice });
      setMessage({ type: 'success', text: `Vote cast: ${choice}` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Vote failed. You may have already voted on this proposal.' });
    } finally {
      setVoting(v => ({ ...v, [proposalId]: null }));
    }
  }

  if (!ready || loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading governance…</div>
    </div>
  );

  const alreadyVotedIds = new Set(myVotes.map(v => v.proposal_id || v.id));
  const active = proposals.filter(p => p.status === 'ACTIVE' && new Date(p.end_time) > new Date());
  const past   = proposals.filter(p => p.status !== 'ACTIVE' || new Date(p.end_time) <= new Date());

  // Voting power: tokens held for a given token_symbol
  const holdingBySymbol = holdings.reduce((acc, h) => {
    acc[h.symbol] = parseFloat(h.balance || 0);
    return acc;
  }, {});

  const choiceColor = (c) =>
    c === 'FOR' ? 'bg-green-900/50 text-green-300' :
    c === 'AGAINST' ? 'bg-red-900/50 text-red-300' :
    'bg-gray-700/50 text-gray-300';

  const outcomeColor = (status) =>
    status === 'PASSED' ? 'text-green-400' :
    status === 'REJECTED' ? 'text-red-400' :
    status === 'ACTIVE' ? 'text-yellow-400' : 'text-gray-400';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Governance Voting</h1>
          <p className="text-gray-400 text-sm mt-1">Vote on proposals for the tokens you hold</p>
        </div>

        {message && (
          <div className={`rounded-xl p-4 mb-6 border text-sm ${message.type === 'success'
            ? 'bg-green-900/40 border-green-700 text-green-300'
            : 'bg-red-900/40 border-red-700 text-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 bg-gray-900 rounded-xl p-1 w-fit">
          {[
            { key: 'active',  label: `🗳️ Active Proposals${active.length > 0 ? ` (${active.length})` : ''}` },
            { key: 'history', label: `📋 My Voting History${myVotes.length > 0 ? ` (${myVotes.length})` : ''}` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Active Proposals ── */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {active.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                <p className="text-3xl mb-3">🗳️</p>
                <p className="text-gray-300 font-semibold mb-1">No active governance proposals</p>
                <p className="text-gray-500 text-sm">Proposals are created by issuers for token holders to vote on. Check back when you receive a notification.</p>
              </div>
            ) : (
              active.map(p => {
                const total   = Number(p.votes_for) + Number(p.votes_against) + Number(p.votes_abstain);
                const forPct  = total > 0 ? (Number(p.votes_for)     / total * 100).toFixed(1) : 0;
                const agPct   = total > 0 ? (Number(p.votes_against) / total * 100).toFixed(1) : 0;
                const daysLeft = Math.max(0, Math.ceil((new Date(p.end_time) - new Date()) / (1000 * 60 * 60 * 24)));
                const votingPower = holdingBySymbol[p.token_symbol] || 0;
                const alreadyVoted = myVotes.some(v => v.proposal_title === p.title);
                return (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-lg">{p.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.resolution_type === 'SPECIAL' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
                            {p.resolution_type || 'ORDINARY'}
                          </span>
                          {alreadyVoted && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">✓ Voted</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{p.token_symbol} — {p.company_name || p.token_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-yellow-400 text-sm font-semibold">{daysLeft}d left</p>
                        <p className="text-xs text-gray-500">Closes {dt(p.end_time)}</p>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-gray-300 text-sm mb-4">{p.description}</p>
                    )}

                    {/* Voting power */}
                    {votingPower > 0 && (
                      <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2 mb-3 text-xs text-blue-300">
                        Your voting power: <strong>{votingPower.toLocaleString('en-US', { maximumFractionDigits: 4 })}</strong> {p.token_symbol} tokens
                      </div>
                    )}

                    {/* Vote bars */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>FOR: {p.votes_for} votes ({forPct}%)</span>
                        <span>AGAINST: {p.votes_against} votes ({agPct}%)</span>
                        <span className="text-gray-600">Total: {total}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500 transition-all" style={{ width: forPct + '%' }} />
                        <div className="h-full bg-red-500 transition-all"   style={{ width: agPct + '%' }} />
                      </div>
                    </div>

                    {/* Vote buttons */}
                    {!alreadyVoted ? (
                      <div className="flex gap-2">
                        {['FOR', 'AGAINST', 'ABSTAIN'].map(c => (
                          <button key={c} onClick={() => vote(p.id, c)} disabled={!!voting[p.id]}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                              c === 'FOR'     ? 'bg-green-800 hover:bg-green-700 text-green-300' :
                              c === 'AGAINST' ? 'bg-red-800 hover:bg-red-700 text-red-300' :
                                               'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            }`}>
                            {voting[p.id] === c ? 'Voting…' : c}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">You have already voted on this proposal.</p>
                    )}
                  </div>
                );
              })
            )}

            {/* Past proposals summary */}
            {past.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Closed Proposals</h3>
                <div className="space-y-2">
                  {past.map(p => {
                    const total  = Number(p.votes_for) + Number(p.votes_against) + Number(p.votes_abstain);
                    const forPct = total > 0 ? (Number(p.votes_for) / total * 100).toFixed(1) : 0;
                    return (
                      <div key={p.id} className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-semibold text-gray-300">{p.title}</span>
                          <span className="text-gray-600 text-xs ml-2">{p.token_symbol}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500">{total} votes · FOR {forPct}%</span>
                          <span className={`font-semibold ${outcomeColor(p.status)}`}>{p.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Voting History ── */}
        {activeTab === 'history' && (
          <>
            {myVotes.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <p className="text-3xl mb-2">🗳️</p>
                <p className="text-gray-400 text-sm">You have not cast any votes yet.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                        {['Date', 'Proposal', 'Token', 'My Vote', 'Outcome'].map(h => (
                          <th key={h} className="text-left py-3 px-4 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myVotes.map((v, i) => (
                        <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                          <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{dt(v.voted_at)}</td>
                          <td className="py-3 px-4 text-gray-300 max-w-xs truncate">{v.proposal_title}</td>
                          <td className="py-3 px-4 font-mono font-bold text-yellow-400">{v.token_symbol}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${choiceColor(v.choice)}`}>
                              {v.choice}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-xs font-semibold ${outcomeColor(v.proposal_status)}`}>
                            {v.proposal_status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
