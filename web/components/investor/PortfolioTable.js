'use client';

const fmt   = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${parseFloat(n||0).toFixed(2)}`;
const fmtP  = (n) => `${n >= 0 ? '+' : ''}${parseFloat(n||0).toFixed(2)}%`;

export default function PortfolioTable({ holdings = [] }) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        No holdings yet. Subscribe to a primary offering or trade on the secondary market to build your portfolio.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            {['Token', 'Qty', 'Avg Cost', 'Current Price', 'Value', 'Unr. P&L', 'P&L %', 'Yield p.a.'].map(h => (
              <th key={h} className={`py-2 px-3 font-medium ${h === 'Token' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const sym      = h.symbol || h.token_symbol || '—';
            const name     = h.name || h.token_name || sym;
            const qty      = parseFloat(h.balance || h.qty || 0);
            const avgCost  = parseFloat(h.average_cost_usd || h.avgCost || 0);
            const price    = parseFloat(h.current_price_usd || h.oracle_price || h.price || 0);
            const value    = parseFloat(h.current_value_usd || h.value || qty * price || 0);
            const cost     = parseFloat(h.cost || qty * avgCost || 0);
            const pnl      = parseFloat(h.unrealised_pnl ?? (value - cost));
            const pnlPct   = cost > 0 ? (pnl / cost) * 100 : 0;
            const yieldPa  = parseFloat(h.yield_pa || h.yield_pct || 0);

            return (
              <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {sym[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-xs">{sym}</p>
                      <p className="text-gray-500 text-[10px] truncate max-w-[100px]">{name}</p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right text-xs font-mono">{qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className="py-2.5 px-3 text-right text-xs font-mono text-gray-400">${avgCost.toFixed(4)}</td>
                <td className="py-2.5 px-3 text-right text-xs font-mono">${price.toFixed(4)}</td>
                <td className="py-2.5 px-3 text-right text-xs font-semibold text-yellow-400">{fmt(value)}</td>
                <td className={`py-2.5 px-3 text-right text-xs font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                </td>
                <td className={`py-2.5 px-3 text-right text-xs font-semibold ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtP(pnlPct)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs text-yellow-400">
                  {yieldPa > 0 ? `${yieldPa}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
