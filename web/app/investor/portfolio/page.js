'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const TXN_LABEL = {
  DEPOSIT:              'Deposit',
  WITHDRAWAL:           'Withdrawal',
  SUBSCRIPTION:         'Offering Subscription',
  SUBSCRIPTION_RESERVE: 'Offering Subscription',
  SUBSCRIPTION_DEBIT:   'Offering Subscription',
  DISTRIBUTION:         'Income Distribution',
  DIVIDEND:             'Income Distribution',
  TRADE:                'Secondary Market Trade',
  TRADE_BUY:            'Secondary Market Trade (Buy)',
  TRADE_SELL:           'Secondary Market Trade (Sell)',
  P2P_BUY:              'P2P Trade (Buy)',
  P2P_SELL:             'P2P Trade (Sell)',
  IPL_FEE:              'Investor Protection Levy',
  CGT:                  'Capital Gains Tax',
  IMTT:                 'Transfer Tax',
  WHT:                  'Withholding Tax',
  FEE:                  'Platform Fee',
  ADJUSTMENT:           'Adjustment',
  REFUND:               'Refund',
};

const fmt  = n => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt   = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const dtTs = d => d ? new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

const PAGE_SIZE = 20;

export default function PortfolioPage() {
  const { user, ready } = useAuth();

  const [holdings,   setHoldings]   = useState([]);
  const [txns,       setTxns]       = useState([]);
  const [wallet,     setWallet]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [txnPage,    setTxnPage]    = useState(0);
  const [activeTab,  setActiveTab]  = useState('holdings');

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
      const [holdRes, txnRes, walRes] = await Promise.allSettled([
        fetch(`${API}/kyc/holdings/${uid}`,    { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/wallet/transactions`,    { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/wallet/balance`,         { headers: hdrs }).then(r => r.json()),
      ]);
      if (holdRes.status === 'fulfilled' && Array.isArray(holdRes.value)) setHoldings(holdRes.value);
      if (txnRes.status  === 'fulfilled' && Array.isArray(txnRes.value))  setTxns(txnRes.value);
      if (walRes.status  === 'fulfilled' && walRes.value?.balance_usd !== undefined) setWallet(walRes.value);
    } catch {}
    finally { setLoading(false); }
  }

  if (!ready || loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading portfolio…</div>
    </div>
  );

  // ── Computed portfolio metrics
  const totalValue       = holdings.reduce((s, h) => s + parseFloat(h.current_value_usd || 0), 0);
  const totalTokensHeld  = holdings.reduce((s, h) => s + parseFloat(h.balance || 0), 0);
  const unrealisedPnL    = holdings.reduce((s, h) => s + parseFloat(h.unrealised_pnl || 0), 0);
  const totalDistribs    = txns.filter(t => t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION').reduce((s, t) => s + parseFloat(t.amount_usd || 0), 0);

  // ── Transaction pagination
  const sortedTxns   = [...txns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const totalPages   = Math.ceil(sortedTxns.length / PAGE_SIZE);
  const pageTxns     = sortedTxns.slice(txnPage * PAGE_SIZE, (txnPage + 1) * PAGE_SIZE);

  const pnlColor = unrealisedPnL >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Portfolio</h1>
          <p className="text-gray-400 text-sm mt-1">Holdings, distributions and transaction history</p>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-yellow-400">{fmt(totalValue)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tokens Held (All Assets)</p>
            <p className="text-2xl font-bold">{totalTokensHeld.toLocaleString('en-US', { maximumFractionDigits: 4 })}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Distributions Received</p>
            <p className="text-2xl font-bold text-green-400">{fmt(totalDistribs)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Unrealised Gain / Loss</p>
            <p className={`text-2xl font-bold ${pnlColor}`}>
              {unrealisedPnL >= 0 ? '+' : ''}{fmt(unrealisedPnL)}
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 bg-gray-900 rounded-xl p-1 w-fit">
          {[{ key: 'holdings', label: '📊 Holdings' }, { key: 'transactions', label: '📋 Transactions' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Holdings Table ── */}
        {activeTab === 'holdings' && (
          <>
            {holdings.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                <p className="text-3xl mb-3">📂</p>
                <p className="text-gray-300 font-semibold mb-2">You have no token holdings yet.</p>
                <p className="text-gray-500 text-sm mb-4">Browse the marketplace to get started.</p>
                <Link href="/markets" className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 text-white">
                  Browse Markets
                </Link>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                        {['Token', 'Asset Name', 'Tokens Held', 'Avg Entry Price', 'Current Price', 'Current Value', '% of Portfolio', 'Total Distributions'].map(h => (
                          <th key={h} className="text-left py-3 px-4 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h, i) => {
                        const pct = totalValue > 0 ? ((parseFloat(h.current_value_usd) / totalValue) * 100).toFixed(1) : '0.0';
                        const holdDistribs = txns
                          .filter(t => (t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION') && t.description?.includes(h.symbol))
                          .reduce((s, t) => s + parseFloat(t.amount_usd || 0), 0);
                        const currentPrice = parseFloat(h.oracle_price || h.current_price_usd || 0);
                        const avgCost = parseFloat(h.average_cost_usd || 0);
                        const pnl = currentPrice - avgCost;
                        return (
                          <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                            <td className="py-3 px-4">
                              <Link href={`/investor/asset/${h.symbol}`}
                                className="font-bold text-yellow-400 hover:text-yellow-300 font-mono">
                                {h.symbol}
                              </Link>
                            </td>
                            <td className="py-3 px-4 text-gray-300">{h.name || '—'}</td>
                            <td className="py-3 px-4 font-mono">{parseFloat(h.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                            <td className="py-3 px-4 font-mono text-gray-400">{fmt(avgCost)}</td>
                            <td className="py-3 px-4">
                              <span className="font-mono">{fmt(currentPrice)}</span>
                              {pnl !== 0 && (
                                <span className={`text-xs ml-1 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pnl >= 0 ? '▲' : '▼'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold">{fmt(h.current_value_usd)}</td>
                            <td className="py-3 px-4 text-gray-400">{pct}%</td>
                            <td className="py-3 px-4 font-mono text-green-400">{fmt(holdDistribs)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Transaction History ── */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {txns.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <p className="text-gray-400 text-sm">No transactions yet.</p>
              </div>
            ) : (
              <>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/40">
                          {['Date', 'Type', 'Description', 'Amount', 'Balance After'].map(h => (
                            <th key={h} className="text-left py-3 px-4 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageTxns.map((t, i) => {
                          const isCredit = parseFloat(t.amount_usd) > 0;
                          return (
                            <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                              <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{dtTs(t.created_at)}</td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isCredit ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                                  {TXN_LABEL[t.type] || t.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-400 text-xs max-w-xs truncate">{t.description || '—'}</td>
                              <td className={`py-3 px-4 font-mono font-semibold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                                {isCredit ? '+' : ''}{fmt(t.amount_usd)}
                              </td>
                              <td className="py-3 px-4 font-mono text-gray-300">{fmt(t.balance_after)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Showing {txnPage * PAGE_SIZE + 1}–{Math.min((txnPage + 1) * PAGE_SIZE, txns.length)} of {txns.length} transactions</span>
                    <div className="flex gap-2">
                      <button onClick={() => setTxnPage(p => Math.max(0, p - 1))} disabled={txnPage === 0}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">
                        ← Prev
                      </button>
                      <span className="px-3 py-1.5 text-gray-400">{txnPage + 1} / {totalPages}</span>
                      <button onClick={() => setTxnPage(p => Math.min(totalPages - 1, p + 1))} disabled={txnPage >= totalPages - 1}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
