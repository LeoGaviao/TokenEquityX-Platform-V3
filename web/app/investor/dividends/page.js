'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

export default function DividendsPage() {
  const { ready }             = useAuth();
  const [rounds,   setRounds]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [claiming, setClaiming] = useState({});
  const [message,  setMessage]  = useState(null);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready]);

  async function load() {
    try {
      const { data } = await api.get('/dividends/claimable');
      setRounds(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function claim(roundId) {
    setClaiming(c => ({...c, [roundId]: true}));
    setMessage(null);
    try {
      await api.post('/dividends/claim', { roundId });
      setMessage({ type: 'success', text: 'Dividend claimed successfully!' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Claim failed' });
    } finally {
      setClaiming(c => ({...c, [roundId]: false}));
    }
  }

  if (!ready || loading) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Dividends & Coupons</h1>
      <p className="text-gray-400 text-sm mb-8">Claim your dividend and coupon payments</p>

      {message && (
        <div className={`rounded-xl p-4 mb-6 border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-red-900 border-red-700 text-red-300'
        }`}>{message.text}</div>
      )}

      {rounds.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-gray-400">No claimable dividends at this time</p>
        </div>
      )}

      <div className="space-y-4">
        {rounds.map(r => (
          <div key={r.id} className="card flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold">{r.token_symbol}</span>
                <span className={`badge ${r.round_type === 'DIVIDEND' ? 'badge-green' : 'badge-blue'}`}>
                  {r.round_type}
                </span>
              </div>
              <p className="text-gray-400 text-sm">{r.company_name}</p>
              <p className="text-gray-400 text-xs mt-1">
                Deadline: {new Date(r.claim_deadline).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-green-400">
                ${Number(r.total_amount_usdc).toFixed(2)}
              </p>
              <p className="text-gray-400 text-xs mb-2">USDC</p>
              <button
                onClick={() => claim(r.id)}
                disabled={claiming[r.id]}
                className="btn-primary text-sm"
              >
                {claiming[r.id] ? 'Claiming...' : 'Claim'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}