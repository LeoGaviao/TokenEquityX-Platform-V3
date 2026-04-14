'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TokenChartModal from '../../../components/TokenChartModal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function TokenPage() {
  const { symbol } = useParams();
  const router     = useRouter();
  const [token,    setToken]   = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');

  useEffect(() => {
    if (!symbol) return;
    fetch(`${API}/assets`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const found = data.find(t =>
            (t.symbol || t.token_symbol || '').toUpperCase() === symbol.toUpperCase()
          );
          if (found) {
            setToken({
              ...found,
              symbol: found.symbol || found.token_symbol,
              name:   found.name || found.company_name,
              price:  parseFloat(found.oracle_price || found.current_price_usd || 1),
              change24h: found.change_24h || 0,
            });
          } else {
            setError(`Token ${symbol} not found.`);
          }
        }
      })
      .catch(() => setError('Could not load token data.'))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-3xl mb-3">⏳</p>
        <p className="text-gray-400">Loading {symbol}…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-3xl mb-3">⚠️</p>
        <p className="text-gray-400 mb-4">{error}</p>
        <button onClick={() => router.push('/market-watch')} className="text-blue-400 hover:text-blue-300 text-sm">← Back to Market Watch</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">← Back</button>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Market Watch</span>
        <span className="text-gray-600">/</span>
        <span className="font-bold">{symbol}</span>
      </div>
      {token && (
        <TokenChartModal
          token={token}
          onClose={() => router.back()}
        />
      )}
    </div>
  );
}
