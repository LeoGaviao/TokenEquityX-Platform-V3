'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const fmt  = n => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(4)}`;
const pct  = n => `${parseFloat(n||0) >= 0 ? '+' : ''}${parseFloat(n||0).toFixed(2)}%`;

const SECTIONS = [
  { key: 'all',       label: 'All Securities' },
  { key: 'secondary', label: '📈 Secondary Market' },
  { key: 'p2p',       label: '🔄 P2P Market' },
  { key: 'prelisting',label: '⏳ Pre-Listing' },
];

export default function MarketPriceSheet() {
  const router  = useRouter();
  const [tokens,  setTokens]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('all');
  const [sortBy,  setSortBy]  = useState('market_cap');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/ticker`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setTokens(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = tokens
    .filter(t => {
      if (search) {
        const q = search.toLowerCase();
        return (t.symbol||t.token_symbol||'').toLowerCase().includes(q) ||
               (t.name||t.company||'').toLowerCase().includes(q);
      }
      if (section === 'secondary') return t.marketState === 'FULL_TRADING';
      if (section === 'p2p')       return t.marketState === 'P2P_ONLY';
      if (section === 'prelisting') return t.marketState === 'PRE_LAUNCH';
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price')      return parseFloat(b.price||0) - parseFloat(a.price||0);
      if (sortBy === 'change')     return parseFloat(b.change24h||0) - parseFloat(a.change24h||0);
      if (sortBy === 'volume')     return parseFloat(b.volume24h||0) - parseFloat(a.volume24h||0);
      if (sortBy === 'market_cap') return parseFloat(b.marketCap||0) - parseFloat(a.marketCap||0);
      return 0;
    });

  const NAVY = '#1A3C5E';
  const GOLD = '#C8972B';

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-lg">Market Price Sheet</h1>
            <p className="text-gray-500 text-xs">All listed securities — live prices</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol or name..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-48"/>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Section filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                section === s.key ? 'text-white' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
              style={section === s.key ? { background: NAVY } : {}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Sort by:</span>
          {[
            { key: 'market_cap', label: 'Mkt Cap' },
            { key: 'volume',     label: 'Volume' },
            { key: 'price',      label: 'Price' },
            { key: 'change',     label: '24h Change' },
          ].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                sortBy === s.key
                  ? 'border-yellow-600 text-yellow-400'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}>
              {s.label}
            </button>
          ))}
          <span className="text-xs text-gray-600 ml-auto">{filtered.length} securities</span>
        </div>

        {/* Price sheet table */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading market data...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-900/80">
                  <th className="text-left py-3 px-4 font-medium">#</th>
                  <th className="text-left py-3 px-4 font-medium">Asset</th>
                  <th className="text-right py-3 px-4 font-medium">Price</th>
                  <th className="text-right py-3 px-4 font-medium">24h</th>
                  <th className="text-right py-3 px-4 font-medium">Mkt Cap</th>
                  <th className="text-right py-3 px-4 font-medium">Volume 24h</th>
                  <th className="text-right py-3 px-4 font-medium">Yield</th>
                  <th className="text-center py-3 px-4 font-medium">Type</th>
                  <th className="text-right py-3 px-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-600 text-sm">
                      No securities found.
                    </td>
                  </tr>
                ) : filtered.map((t, i) => {
                  const sym     = t.symbol || t.token_symbol || '?';
                  const name    = t.name || t.company || sym;
                  const price   = parseFloat(t.price || t.current_price_usd || 0);
                  const change  = parseFloat(t.change24h || t.change_24h || 0);
                  const vol     = parseFloat(t.volume24h || t.volume_24h || 0);
                  const mktCap  = parseFloat(t.marketCap || t.market_cap || 0);
                  const isP2P   = t.marketState === 'P2P_ONLY' || t.market_state === 'P2P_ONLY';
                  const isFull  = t.marketState === 'FULL_TRADING' || t.market_state === 'FULL_TRADING';
                  const isPre   = t.marketState === 'PRE_LAUNCH' || t.market_state === 'PRE_LAUNCH';
                  return (
                    <tr key={sym}
                      onClick={() => router.push(`/investor/asset/${sym}`)}
                      className="border-b border-gray-800/40 hover:bg-gray-800/40 cursor-pointer transition-colors">
                      <td className="py-3 px-4 text-gray-600 text-xs">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: isFull ? '#1A3C5E' : isP2P ? '#4B1D8E' : '#374151' }}>
                            {sym[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{sym}</p>
                            <p className="text-gray-500 text-xs truncate max-w-[160px]">{name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">${price.toFixed(4)}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        {mktCap >= 1e6 ? `$${(mktCap/1e6).toFixed(2)}M` : mktCap >= 1e3 ? `$${(mktCap/1e3).toFixed(1)}K` : '$0'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        {vol >= 1e6 ? `$${(vol/1e6).toFixed(2)}M` : vol >= 1e3 ? `$${(vol/1e3).toFixed(1)}K` : '$0'}
                      </td>
                      <td className="py-3 px-4 text-right text-yellow-400">
                        {t.yield_pct ? `${t.yield_pct}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          isFull ? 'border-blue-700/50 text-blue-300 bg-blue-900/20' :
                          isP2P  ? 'border-purple-700/50 text-purple-300 bg-purple-900/20' :
                          'border-gray-700 text-gray-400'
                        }`}>
                          {isFull ? 'Bourse' : isP2P ? 'P2P' : 'Pre-listing'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs text-blue-400 hover:text-blue-300">View →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
