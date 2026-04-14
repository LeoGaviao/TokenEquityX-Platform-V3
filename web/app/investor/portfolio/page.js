'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

export default function PortfolioPage() {
  const { user, ready }       = useAuth();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready]);

  async function load() {
    try {
      const { data } = await api.get('/trading/orders');
      setOrders(data);
    } catch {}
    finally { setLoading(false); }
  }

  if (!ready || loading) return null;

  const filled   = orders.filter(o => o.status === 'FILLED');
  const open     = orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIAL');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">My Portfolio</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="stat-label">Total Orders</p>
          <p className="stat-value">{orders.length}</p>
        </div>
        <div className="card">
          <p className="stat-label">Open Orders</p>
          <p className="stat-value">{open.length}</p>
        </div>
        <div className="card">
          <p className="stat-label">Filled Orders</p>
          <p className="stat-value">{filled.length}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">Order History</h2>
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="table-header px-4 py-3 text-left">Token</th>
              <th className="table-header px-4 py-3 text-left">Side</th>
              <th className="table-header px-4 py-3 text-right">Qty</th>
              <th className="table-header px-4 py-3 text-right">Price</th>
              <th className="table-header px-4 py-3 text-right">Status</th>
              <th className="table-header px-4 py-3 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No orders yet</td></tr>
            )}
            {orders.map(o => (
              <tr key={o.id} className="table-row">
                <td className="px-4 py-3 font-semibold">{o.token_symbol}</td>
                <td className="px-4 py-3">
                  <span className={o.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{o.side}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{o.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-300">${Number(o.limit_price).toFixed(4)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`badge ${
                    o.status === 'FILLED'    ? 'badge-green'  :
                    o.status === 'OPEN'      ? 'badge-blue'   :
                    o.status === 'PARTIAL'   ? 'badge-yellow' :
                    'badge-gray'
                  }`}>{o.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}