'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';

export default function Ticker() {
  const [tokens, setTokens] = useState([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/ticker');
      setTokens(data);
    } catch {}
  }

  if (tokens.length === 0) return null;

  const items = [...tokens, ...tokens, ...tokens];

  return (
    <div
        className="bg-gray-950 border-b border-gray-800 overflow-hidden relative"
        style={{ height: 36 }}
         onMouseEnter={() => setPaused(true)}
         onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex items-center gap-8 whitespace-nowrap px-4"
        style={{
         animation: paused ? 'none' : 'ticker 40s linear infinite',
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        whiteSpace: 'nowrap'
        }}
      >
        {items.map((t, i) => {
          const change = Number(t.change24h);
          const up     = change >= 0;
          return (
            <span key={i} className="flex items-center gap-2 text-xs">
              <span className="text-white font-bold">{t.symbol}</span>
              <span className="text-gray-400">{t.company}</span>
              <span className="text-white">${Number(t.price) > 0 ? Number(t.price).toFixed(4) : '—'}</span>
              <span className={up ? 'text-green-400' : 'text-red-400'}>
                {up ? '+' : ''}{change.toFixed(2)}%
              </span>
              <span className="text-gray-700">|</span>
            </span>
          );
        })}
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateY(-50%) translateX(0); }
          100% { transform: translateY(-50%) translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}