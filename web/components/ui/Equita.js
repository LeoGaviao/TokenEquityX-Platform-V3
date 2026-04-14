'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const GOLD = '#C8972B';
const NAVY = '#1A3C5E';

const SYSTEM_PROMPT = `You are Equita, the intelligent AI assistant for TokenEquityX — Africa's premier digital capital market platform based in Harare, Zimbabwe.

You are knowledgeable, professional, and helpful. You speak with confidence about the platform and African capital markets, but are always honest when you don't know something.

Key facts about TokenEquityX:
- A blockchain-based digital capital markets platform built on Polygon
- Regulated under the SECZ (Securities and Exchange Commission of Zimbabwe) Innovation Hub Sandbox
- Enables tokenisation of real-world assets: real estate, mining, bonds, infrastructure, equity
- Current listed assets: ZWIB (ZimInfra Bond 2027, 8.5% yield), HCPR (Harare CBD REIT, 9.2% yield), ACME (Acme Mining Ltd - PGMs), GDMR (Great Dyke Minerals - PGMs)
- Trading fee: 0.50% per matched trade
- Issuance fee: 0.25% of token offer value
- Annual platform fee: USD 5,000 per asset
- KYC onboarding fee: USD 50 per investor
- Settlement in USDC on Polygon blockchain
- Leadership: Richard Chimuka (CEO), Leo Gaviao (Director, Technology & Innovation)

Your role:
- Help investors understand the platform, assets, and how to get started
- Explain tokenisation and blockchain concepts in simple terms
- Help issuers understand the listing process
- Provide information about the regulatory framework
- Guide users to the right section of the platform
- Do NOT provide specific financial or investment advice
- Do NOT make up specific prices or returns — refer users to the live market data

Always be warm, professional, and concise. Use plain English. If asked something outside your knowledge, say so honestly and suggest the user contact the team directly.`;

const SUGGESTIONS = [
  'What is TokenEquityX?',
  'How do I invest?',
  'What assets are listed?',
  'How does tokenisation work?',
  'What are the fees?',
  'How do I list my asset?',
  'Is it regulated?',
  'What is USDC settlement?',
];

export default function Equita() {
  const pathname = usePathname();
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showSugg, setShowSugg] = useState(true);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // hide on authenticated pages
  const authPaths = ['/setup'];
  if (authPaths.some(p => pathname.startsWith(p))) return null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');
    setShowSugg(false);
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newMessages,
        }),
      });
      const data = await response.json();
      const reply = data.content?.find(b => b.type === 'text')?.text || 'I apologise, I could not generate a response. Please try again.';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'I\'m having trouble connecting right now. Please try again in a moment, or contact our team directly at support@tokenequityx.com.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const reset = () => { setMessages([]); setShowSugg(true); setInput(''); };

  return (
    <>
      {/* ── FLOATING BUTTON ──────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${NAVY}, #2563eb)` }}
        title="Chat with Equita">
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        ) : (
          <div className="relative">
            <span className="text-2xl">✦</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-blue-900"/>
          </div>
        )}
      </button>

      {/* ── CHAT PANEL ───────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] flex flex-col rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
          style={{ height: '520px', background: '#0f1117' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800"
            style={{ background: `linear-gradient(135deg, ${NAVY}cc, #1e3a5fcc)` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow"
                style={{ background: GOLD }}>
                <span className="text-gray-900">E</span>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Equita</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                  <p className="text-green-400 text-xs">AI Assistant · TokenEquityX</p>
                </div>
              </div>
            </div>
            <button onClick={reset} className="text-gray-500 hover:text-gray-300 text-xs">
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Welcome */}
            {messages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ background: GOLD }}>E</div>
                <div className="bg-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed">
                  Hello! I'm <strong style={{ color: GOLD }}>Equita</strong>, your TokenEquityX AI assistant. I can help you understand the platform, our listed assets, how tokenisation works, and how to get started. What would you like to know?
                </div>
              </div>
            )}

            {/* Suggestions */}
            {showSugg && messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pl-10">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Conversation */}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  m.role === 'user' ? 'bg-blue-700 text-white' : ''
                }`} style={m.role === 'assistant' ? { background: GOLD, color: '#111' } : {}}>
                  {m.role === 'user' ? '👤' : 'E'}
                </div>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-700 text-white rounded-tr-sm'
                    : 'bg-gray-800/80 text-gray-200 rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ background: GOLD, color: '#111' }}>E</div>
                <div className="bg-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}/>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 px-3 py-3">
            <div className="flex gap-2 bg-gray-800/60 rounded-xl border border-gray-700 px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask Equita anything…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
                style={{ maxHeight: '80px' }}
              />
              <button onClick={() => send()}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: input.trim() && !loading ? GOLD : 'transparent' }}>
                <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                </svg>
              </button>
            </div>
            <p className="text-center text-gray-700 text-xs mt-2">Equita · Powered by Claude · TokenEquityX</p>
          </div>
        </div>
      )}
    </>
  );
}
