'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';

function FinancialDataPageInner() {
  const { ready }        = useAuth();
  const searchParams     = useSearchParams();
  const [assets,   setAssets]   = useState([]);
  const [symbol,   setSymbol]   = useState('');
  const [schema,   setSchema]   = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!ready) return;
    api.get('/assets/my').then(r => {
      setAssets(r.data);
      const sym = searchParams.get('symbol') || r.data[0]?.token_symbol;
      if (sym) setSymbol(sym);
    });
  }, [ready]);

  useEffect(() => {
    if (!symbol) return;
    loadSchema();
    loadHistory();
  }, [symbol]);

  async function loadSchema() {
    const asset = assets.find(a => a.token_symbol === symbol);
    if (!asset) return;
    try {
      const { data } = await api.get('/pipeline/schema/' + asset.asset_type);
      setSchema(data);
      // Pre-fill form with empty values
      const initial = {};
      [...(data.schema.required || []), ...(data.schema.optional || [])].forEach(f => {
        initial[f] = '';
      });
      setFormData(initial);
    } catch {}
  }

  async function loadHistory() {
    try {
      const { data } = await api.get('/pipeline/history/' + symbol);
      setHistory(data);
    } catch {}
  }

  async function previewValuation() {
    try {
      const { data } = await api.post('/pipeline/preview', {
        tokenSymbol: symbol,
        financialData: formData
      });
      setPreview(data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Preview failed' });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/pipeline/submit', {
        tokenSymbol:   symbol,
        financialData: formData,
        periodLabel:   new Date().toISOString().slice(0, 7) // YYYY-MM
      });
      setMessage({ type: 'success', text: 'Financial data submitted for auditor review.' });
      setPreview(null);
      loadHistory();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Submission failed' });
    } finally { setLoading(false); }
  }

  if (!ready) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Submit Financial Data</h1>
      <p className="text-gray-400 text-sm mb-8">
        Submit your financial data for auditor review. Once approved, the valuation engine
        will automatically update your token reference price.
      </p>

      {/* Token selector */}
      <div className="card mb-6">
        <label className="text-xs text-gray-400">Select Asset</label>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className="select mt-1">
          {assets.map(a => (
            <option key={a.token_symbol} value={a.token_symbol}>
              {a.token_symbol} — {a.legal_name} ({a.asset_type})
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className={`rounded-xl p-4 mb-6 border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-red-900 border-red-700 text-red-300'
        }`}>{message.text}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Form */}
        <div>
          {schema && (
            <form onSubmit={submit} className="card space-y-4">
              <h3 className="font-semibold text-yellow-400">{schema.assetType} Financial Data</h3>
              <p className="text-gray-400 text-xs">{schema.schema?.description}</p>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 mb-3">Required Fields</p>
                {schema.schema?.required?.map(field => (
                  <div key={field} className="mb-3">
                    <label className="text-xs text-gray-400 capitalize">
                      {field.replace(/([A-Z])/g, ' $1').trim()} *
                    </label>
                    {schema.schema?.units?.[field] && (
                      <p className="text-xs text-gray-600">{schema.schema.units[field]}</p>
                    )}
                    <input
                      type="number" step="any"
                      value={formData[field] || ''}
                      onChange={e => setFormData(f => ({...f, [field]: e.target.value}))}
                      required className="input mt-1"
                    />
                  </div>
                ))}
              </div>

              {schema.schema?.optional?.length > 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Optional Fields</p>
                  {schema.schema.optional.map(field => (
                    <div key={field} className="mb-3">
                      <label className="text-xs text-gray-400 capitalize">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      {schema.schema?.units?.[field] && (
                        <p className="text-xs text-gray-600">{schema.schema.units[field]}</p>
                      )}
                      <input
                        type="number" step="any"
                        value={formData[field] || ''}
                        onChange={e => setFormData(f => ({...f, [field]: e.target.value}))}
                        className="input mt-1"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={previewValuation}
                  className="btn-secondary flex-1">
                  👁 Preview
                </button>
                <button type="submit" disabled={loading}
                  className="btn-primary flex-1">
                  {loading ? 'Submitting...' : '📤 Submit'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Preview + History */}
        <div className="space-y-4">
          {preview && (
            <div className="card border-yellow-700">
              <h3 className="font-semibold text-yellow-400 mb-4">📊 Valuation Preview</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Asset Type</span>
                  <span>{preview.assetType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Equity Value</span>
                  <span className="font-semibold">${Number(preview.equityValue).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-2">
                  <span className="text-gray-400">Reference Price</span>
                  <span className="text-2xl font-bold text-yellow-400">
                    ${Number(preview.pricePerToken).toFixed(6)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">{preview.note}</p>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold mb-4">Valuation History</h3>
            {history.length === 0 && (
              <p className="text-gray-500 text-sm">No valuations yet</p>
            )}
            {history.map(v => (
              <div key={v.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{v.method}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(v.calculated_at).toLocaleDateString()}
                    {v.auditor_approved ? ' ✅ Auditor Approved' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-yellow-400">
                    ${Number(v.price_per_token).toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-500">
                    ${Number(v.valuation_usd).toLocaleString()} equity
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinancialDataPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>}>
      <FinancialDataPageInner />
    </Suspense>
  );
}