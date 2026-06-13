'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const fmt    = n => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = n => `${(parseFloat(n || 0) * 100).toFixed(0)}%`;
const dt     = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function DividendsPage() {
  const { ready }                       = useAuth();
  const [claimable,   setClaimable]     = useState([]);
  const [history,     setHistory]       = useState([]);
  const [kycData,     setKycData]       = useState(null);
  const [loading,     setLoading]       = useState(true);
  const [claiming,    setClaiming]      = useState({});
  const [activeTab,   setActiveTab]     = useState('summary');
  const [message,     setMessage]       = useState(null);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready]);

  async function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const hdrs  = { Authorization: `Bearer ${token}` };
    try {
      const [claimRes, histRes, kycRes] = await Promise.allSettled([
        fetch(`${API}/dividends/claimable`, { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/dividends/history`,   { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/kyc/status`,          { headers: hdrs }).then(r => r.json()),
      ]);
      if (claimRes.status === 'fulfilled' && Array.isArray(claimRes.value)) setClaimable(claimRes.value);
      if (histRes.status  === 'fulfilled' && Array.isArray(histRes.value))  setHistory(histRes.value);
      if (kycRes.status   === 'fulfilled' && kycRes.value?.risk_profile)    setKycData(kycRes.value);
    } catch {}
    finally { setLoading(false); }
  }

  async function claim(roundId) {
    setClaiming(c => ({ ...c, [roundId]: true }));
    setMessage(null);
    try {
      const res = await api.post('/dividends/claim', { roundId });
      setMessage({ type: 'success', text: res.data?.message || 'Distribution claimed successfully!' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Claim failed.' });
    } finally {
      setClaiming(c => ({ ...c, [roundId]: false }));
    }
  }

  if (!ready || loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading distributions…</div>
    </div>
  );

  // ── Computed metrics from history
  const now           = new Date();
  const quarterStart  = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const totalGross    = history.reduce((s, h) => s + parseFloat(h.gross_amount   || 0), 0);
  const totalWHT      = history.reduce((s, h) => s + parseFloat(h.withholding_tax || 0), 0);
  const totalNet      = history.reduce((s, h) => s + parseFloat(h.net_amount     || 0), 0);
  const quarterNet    = history.filter(h => new Date(h.claimed_at) >= quarterStart)
                               .reduce((s, h) => s + parseFloat(h.net_amount || 0), 0);

  // Infer WHT rate from most recent claim
  const applicableWHTRate = history.length > 0 ? parseFloat(history[0].withholding_rate) : null;

  const distPeriod = (h) => {
    if (h.description) return h.description;
    if (h.round_type)  return h.round_type;
    return '—';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Distributions</h1>
          <p className="text-gray-400 text-sm mt-1">Income distributions and withholding tax summary</p>
        </div>

        {message && (
          <div className={`rounded-xl p-4 mb-6 border text-sm ${message.type === 'success'
            ? 'bg-green-900/40 border-green-700 text-green-300'
            : 'bg-red-900/40 border-red-700 text-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Received (All Time)</p>
            <p className="text-xl font-bold text-green-400">{fmt(totalNet)}</p>
            <p className="text-xs text-gray-600 mt-0.5">Net after WHT</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">This Quarter</p>
            <p className="text-xl font-bold text-green-400">{fmt(quarterNet)}</p>
            <p className="text-xs text-gray-600 mt-0.5">Net after WHT</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">WHT Deducted (All Time)</p>
            <p className="text-xl font-bold text-purple-400">{fmt(totalWHT)}</p>
            <p className="text-xs text-gray-600 mt-0.5">Remitted to ZIMRA</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Gross (Before WHT)</p>
            <p className="text-xl font-bold">{fmt(totalGross)}</p>
            <p className="text-xs text-gray-600 mt-0.5">Total gross paid to you</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 bg-gray-900 rounded-xl p-1 w-fit">
          {[
            { key: 'summary',   label: '💰 Claimable' },
            { key: 'history',   label: '📋 History' },
            { key: 'wht',       label: '🏛 WHT Summary' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Claimable Tab ── */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {claimable.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                <p className="text-3xl mb-3">💰</p>
                <p className="text-gray-300 font-semibold mb-1">No distributions available to claim</p>
                <p className="text-gray-500 text-sm">Distributions are paid quarterly by issuers directly to your wallet.</p>
              </div>
            ) : (
              claimable.map(r => (
                <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold font-mono text-yellow-400">{r.token_symbol}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.round_type === 'DIVIDEND' ? 'bg-green-900/50 text-green-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {r.round_type || 'DISTRIBUTION'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Holding: {parseFloat(r.token_balance).toFixed(4)} tokens × ${parseFloat(r.amount_per_token).toFixed(6)}/token
                    </p>
                    <p className="text-xs text-gray-400">Claim deadline: {dt(r.claim_deadline)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Gross</p>
                    <p className="font-mono font-bold">{fmt(r.estimated_gross)}</p>
                    <p className="text-xs text-purple-400">WHT ({fmtPct(r.withholding_rate)}): -{fmt(r.estimated_withholding)}</p>
                    <p className="text-sm font-bold text-green-400 mb-2">Net: {fmt(r.estimated_net)}</p>
                    <button onClick={() => claim(r.id)} disabled={claiming[r.id]}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50">
                      {claiming[r.id] ? 'Claiming…' : 'Claim Distribution'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <>
            {history.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <p className="text-gray-500 text-sm">No distribution history yet.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                        {['Date', 'Token', 'Type / Period', 'Gross Amount', 'WHT Deducted', 'Net Received'].map(h => (
                          <th key={h} className="text-left py-3 px-4 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                          <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{dt(h.claimed_at)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-yellow-400">{h.token_symbol}</td>
                          <td className="py-3 px-4 text-xs text-gray-400">{distPeriod(h)}</td>
                          <td className="py-3 px-4 font-mono">{fmt(h.gross_amount)}</td>
                          <td className="py-3 px-4 font-mono text-purple-400">-{fmt(h.withholding_tax)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-green-400">{fmt(h.net_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-800/30 border-t border-gray-700">
                        <td colSpan={3} className="py-3 px-4 text-xs text-gray-500 font-semibold">TOTAL</td>
                        <td className="py-3 px-4 font-mono font-bold">{fmt(totalGross)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-400">-{fmt(totalWHT)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-green-400">{fmt(totalNet)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── WHT Summary Tab ── */}
        {activeTab === 'wht' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-3">🏛 Withholding Tax Explanation</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  Withholding tax (WHT) is automatically deducted from all distributions at source before the net amount
                  is credited to your wallet. WHT is remitted to ZIMRA on your behalf by the platform.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className={`rounded-xl p-4 border ${applicableWHTRate === 0.10 ? 'border-green-700 bg-green-900/20' : 'border-gray-700 bg-gray-800/30'}`}>
                    <p className="text-xs text-gray-500 mb-1">Zimbabwe Residents</p>
                    <p className="text-2xl font-bold text-green-400">10%</p>
                    <p className="text-xs text-gray-500 mt-1">Income Tax Act — Section 80</p>
                  </div>
                  <div className={`rounded-xl p-4 border ${applicableWHTRate === 0.15 ? 'border-purple-700 bg-purple-900/20' : 'border-gray-700 bg-gray-800/30'}`}>
                    <p className="text-xs text-gray-500 mb-1">Non-Residents</p>
                    <p className="text-2xl font-bold text-purple-400">15%</p>
                    <p className="text-xs text-gray-500 mt-1">Non-Resident Shareholders Tax</p>
                  </div>
                </div>
                {applicableWHTRate !== null && (
                  <div className="mt-3 p-3 rounded-xl bg-blue-900/20 border border-blue-800 text-blue-300 text-xs">
                    Your applicable WHT rate is <strong>{fmtPct(applicableWHTRate)}</strong> based on your nationality as recorded in your KYC profile.
                    If your nationality has changed, please update your KYC.
                  </div>
                )}
              </div>
            </div>

            {/* WHT breakdown by token */}
            {history.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h3 className="font-bold text-sm">WHT Deducted by Token</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                        {['Token', 'Distributions', 'Gross Total', 'WHT Total', 'Net Total', 'WHT Rate'].map(h => (
                          <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(
                        history.reduce((acc, h) => {
                          const k = h.token_symbol;
                          if (!acc[k]) acc[k] = { symbol: k, count: 0, gross: 0, wht: 0, net: 0, rate: h.withholding_rate };
                          acc[k].count++;
                          acc[k].gross += parseFloat(h.gross_amount || 0);
                          acc[k].wht   += parseFloat(h.withholding_tax || 0);
                          acc[k].net   += parseFloat(h.net_amount || 0);
                          return acc;
                        }, {})
                      ).map((row, i) => (
                        <tr key={i} className="border-b border-gray-800/40">
                          <td className="py-2 px-4 font-mono font-bold text-yellow-400">{row.symbol}</td>
                          <td className="py-2 px-4 text-gray-400">{row.count}</td>
                          <td className="py-2 px-4 font-mono">{fmt(row.gross)}</td>
                          <td className="py-2 px-4 font-mono text-purple-400">-{fmt(row.wht)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-green-400">{fmt(row.net)}</td>
                          <td className="py-2 px-4 text-xs text-gray-400">{fmtPct(row.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
