'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Suspense } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useWebSocket } from '../../../hooks/useWebSocket';
import api from '../../../lib/api';

function TradePageInner() {
  const { user, ready }       = useAuth();
  const searchParams          = useSearchParams();
  const [tokens,    setTokens]    = useState([]);
  const [symbol,    setSymbol]    = useState('');
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], spread: 0 });
  const [trades,    setTrades]    = useState([]);
  const [myOrders,  setMyOrders]  = useState([]);
  const [tab,       setTab]       = useState('book');
  const [form,      setForm]      = useState({ side: 'BUY', orderType: 'LIMIT', quantity: '', limitPrice: '' });
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState(null);

  // WebSocket real-time updates
  useWebSocket(symbol, {
    TRADE:      (msg) => setTrades(prev => [msg.data, ...prev].slice(0, 20)),
    ORDER_BOOK: (msg) => setOrderBook(msg.data),
  });

  useEffect(() => {
    if (!ready) return;
    loadTokens();
  }, [ready]);

  useEffect(() => {
    const sym = searchParams.get('symbol');
    if (sym) setSymbol(sym);
  }, [searchParams]);

  useEffect(() => {
    if (symbol) {
      loadOrderBook();
      loadMyOrders();
    }
  }, [symbol]);

  async function loadTokens() {
    try {
      const { data } = await api.get('/assets/all');
      setTokens(data);
      if (data.length > 0 && !symbol) {
        setSymbol(data[0].token_symbol);
      }
    } catch {}
  }

  async function loadOrderBook() {
    try {
      const { data } = await api.get('/trading/orderbook/' + symbol);
      setOrderBook(data);
      setTrades(data.recentTrades || []);
    } catch {}
  }

  async function loadMyOrders() {
    try {
      const { data } = await api.get('/trading/orders');
      setMyOrders(data);
    } catch {}
  }

  async function placeOrder(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/trading/order', { tokenSymbol: symbol, ...form });
      setMessage({ type: 'success', text: 'Order placed successfully!' });
      setForm(f => ({ ...f, quantity: '', limitPrice: '' }));
      loadOrderBook();
      loadMyOrders();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Order failed' });
    } finally { setLoading(false); }
  }

  async function cancelOrder(id) {
    try {
      await api.put('/trading/orders/' + id + '/cancel');
      setMessage({ type: 'success', text: 'Order cancelled' });
      loadMyOrders();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Cancel failed' });
    }
  }

  if (!ready) return null;

  const total = Number(form.quantity) * Number(form.limitPrice);
  const fee   = total * 0.005;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Exchange</h1>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className="select w-auto">
          {tokens.map(t => (
            <option key={t.token_symbol} value={t.token_symbol}>
              {t.token_symbol} — {t.legal_name}
            </option>
          ))}
        </select>
        <button onClick={loadOrderBook} className="btn-secondary text-sm">↻ Refresh</button>
      </div>

      {message && (
        <div className={`rounded-xl p-4 mb-6 border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-red-900 border-red-700 text-red-300'
        }`}>{message.text}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Order Form */}
        <div className="card">
          <h3 className="font-bold mb-4">Place Order</h3>
          <div className="flex gap-2 mb-4">
            {['BUY','SELL'].map(s => (
              <button key={s} onClick={() => setForm(f => ({...f, side: s}))}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  form.side === s
                    ? s === 'BUY' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>{s}</button>
            ))}
          </div>

          <form onSubmit={placeOrder} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Order Type</label>
              <select value={form.orderType} onChange={e => setForm(f => ({...f, orderType: e.target.value}))} className="select mt-1">
                <option value="LIMIT">Limit Order</option>
                <option value="MARKET">Market Order</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Quantity</label>
              <input type="number" value={form.quantity} min="1" required
                onChange={e => setForm(f => ({...f, quantity: e.target.value}))}
                className="input mt-1" placeholder="100" />
            </div>
            {form.orderType === 'LIMIT' && (
              <div>
                <label className="text-xs text-gray-400">Limit Price (USDC)</label>
                <input type="number" value={form.limitPrice} step="0.0001"
                  onChange={e => setForm(f => ({...f, limitPrice: e.target.value}))}
                  className="input mt-1" placeholder="0.0000" />
              </div>
            )}
            {total > 0 && (
              <div className="bg-gray-800 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total</span>
                  <span className="font-semibold">${total.toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fee (0.5%)</span>
                  <span>${fee.toFixed(2)} USDC</span>
                </div>
              </div>
            )}
            <button type="submit" disabled={loading}
              className={`w-full py-3 rounded-xl font-bold transition-colors ${
                form.side === 'BUY'
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}>
              {loading ? 'Placing...' : `Place ${form.side} Order`}
            </button>
          </form>
        </div>

        {/* Order Book / Trades / My Orders */}
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-4">
            {[
              { id: 'book',   label: '📖 Order Book' },
              { id: 'trades', label: '⚡ Recent Trades' },
              { id: 'mine',   label: '📋 My Orders' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>{t.label}</button>
            ))}
          </div>

          {tab === 'book' && (
            <div className="card p-0 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-800">
                <div>
                  <div className="px-4 py-2 bg-gray-800 text-xs font-bold text-green-400">BIDS (BUY)</div>
                  {orderBook.bids?.length === 0 && <p className="text-gray-500 text-xs p-4">No buy orders</p>}
                  {orderBook.bids?.map((b, i) => (
                    <div key={i} className="px-4 py-2 flex justify-between text-sm border-b border-gray-800">
                      <span className="text-green-400">${Number(b.price).toFixed(4)}</span>
                      <span className="text-gray-300">{Number(b.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="px-4 py-2 bg-gray-800 text-xs font-bold text-red-400">ASKS (SELL)</div>
                  {orderBook.asks?.length === 0 && <p className="text-gray-500 text-xs p-4">No sell orders</p>}
                  {orderBook.asks?.map((a, i) => (
                    <div key={i} className="px-4 py-2 flex justify-between text-sm border-b border-gray-800">
                      <span className="text-red-400">${Number(a.price).toFixed(4)}</span>
                      <span className="text-gray-300">{Number(a.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {Number(orderBook.spread) > 0 && (
                <div className="px-4 py-2 bg-gray-800 text-center text-xs text-gray-400">
                  Spread: ${Number(orderBook.spread).toFixed(4)}
                </div>
              )}
            </div>
          )}

          {tab === 'trades' && (
            <div className="card p-0 overflow-hidden">
              <div className="grid grid-cols-4 px-4 py-2 bg-gray-800 text-xs text-gray-400 font-bold">
                <span>Price</span><span>Qty</span><span>Total</span><span>Time</span>
              </div>
              {trades.length === 0 && <p className="text-gray-500 text-xs p-4">No trades yet</p>}
              {trades.map((t, i) => (
                <div key={i} className="grid grid-cols-4 px-4 py-2 text-sm border-b border-gray-800">
                  <span className="text-green-400">${Number(t.price).toFixed(4)}</span>
                  <span className="text-gray-300">{t.quantity}</span>
                  <span className="text-gray-300">${Number(t.total_usdc || t.totalUSDC).toFixed(2)}</span>
                  <span className="text-gray-500 text-xs">
                    {t.matched_at ? new Date(t.matched_at).toLocaleTimeString() : 'now'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'mine' && (
            <div className="card p-0 overflow-hidden">
              <div className="grid grid-cols-5 px-4 py-2 bg-gray-800 text-xs text-gray-400 font-bold">
                <span>Token</span><span>Side</span><span>Qty</span><span>Price</span><span>Status</span>
              </div>
              {myOrders.length === 0 && <p className="text-gray-500 text-xs p-4">No orders yet</p>}
              {myOrders.map(o => (
                <div key={o.id} className="grid grid-cols-5 px-4 py-3 text-sm border-b border-gray-800 items-center">
                  <span>{o.token_symbol}</span>
                  <span className={o.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{o.side}</span>
                  <span className="text-gray-300">{o.quantity}</span>
                  <span className="text-gray-300">${Number(o.limit_price).toFixed(4)}</span>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      o.status === 'OPEN'      ? 'badge-blue'   :
                      o.status === 'FILLED'    ? 'badge-green'  :
                      o.status === 'CANCELLED' ? 'badge-gray'   :
                      'badge-yellow'
                    }`}>{o.status}</span>
                    {o.status === 'OPEN' && (
                      <button onClick={() => cancelOrder(o.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>}>
      <TradePageInner />
    </Suspense>
  );
}