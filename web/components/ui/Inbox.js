'use client';
import { useState, useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const CATEGORY_COLORS = {
  APPLICATION: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  TRADING:     'bg-green-900/40 text-green-300 border-green-700/50',
  WALLET:      'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  KYC:         'bg-purple-900/40 text-purple-300 border-purple-700/50',
  DIVIDEND:    'bg-pink-900/40 text-pink-300 border-pink-700/50',
  OFFERING:    'bg-orange-900/40 text-orange-300 border-orange-700/50',
  DIRECT:      'bg-gray-800 text-gray-300 border-gray-700',
  GENERAL:     'bg-gray-800 text-gray-300 border-gray-700',
  SYSTEM:      'bg-gray-800 text-gray-400 border-gray-700',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Inbox({ token }) {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState('inbox');
  const panelRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function fetchUnread() {
    try {
      const res = await fetch(`${API}/messages/unread-count`, { headers });
      const data = await res.json();
      setUnread(data.count || 0);
    } catch {}
  }

  async function fetchMessages() {
    setLoading(true);
    try {
      const url = tab === 'sent' ? `${API}/messages/sent` : `${API}/messages`;
      const res  = await fetch(url, { headers });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }

  async function openInbox() {
    setOpen(o => !o);
    if (!open) await fetchMessages();
  }

  async function openMessage(msg) {
    setSelected(msg);
    if (!msg.is_read) {
      try {
        await fetch(`${API}/messages/${msg.id}/read`, { method: 'PUT', headers });
        setMessages(ms => ms.map(m => m.id === msg.id ? {...m, is_read: true} : m));
        setUnread(u => Math.max(0, u - 1));
      } catch {}
    }
  }

  async function deleteMessage(id, e) {
    e.stopPropagation();
    try {
      await fetch(`${API}/messages/${id}`, { method: 'DELETE', headers });
      setMessages(ms => ms.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {}
  }

  async function markAllRead() {
    try {
      await fetch(`${API}/messages/read-all`, { method: 'PUT', headers });
      setMessages(ms => ms.map(m => ({...m, is_read: true})));
      setUnread(0);
    } catch {}
  }

  useEffect(() => {
    if (open) fetchMessages();
  }, [tab, open]);

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={openInbox}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Messages">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col"
          style={{maxHeight: '80vh'}}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white text-sm">Messages</span>
              {unread > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unread} unread</span>}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && tab === 'inbox' && (
                <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">Mark all read</button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex border-b border-gray-800 flex-shrink-0">
            {['inbox','sent'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${tab===t?'text-white border-b-2 border-blue-500':'text-gray-500 hover:text-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <div className="p-4">
                <button onClick={() => setSelected(null)} className="text-xs text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-1">
                  ← Back to inbox
                </button>
                <div className={`text-xs px-2 py-0.5 rounded-full inline-block mb-2 border ${CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.GENERAL}`}>
                  {selected.category || 'MESSAGE'}
                </div>
                <h3 className="font-bold text-white text-sm mb-1">{selected.subject}</h3>
                <p className="text-xs text-gray-500 mb-4">
                  {selected.sender_name ? `From: ${selected.sender_name}` : 'From: TokenEquityX'} · {timeAgo(selected.created_at)}
                </p>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.body}</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-gray-500 text-sm">{tab === 'sent' ? 'No sent messages' : 'Your inbox is empty'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {messages.map(msg => (
                  <div key={msg.id} onClick={() => openMessage(msg)}
                    className={`px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors flex items-start gap-3 ${!msg.is_read ? 'bg-blue-950/20' : ''}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${!msg.is_read ? 'bg-blue-400' : 'bg-transparent'}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-white' : 'text-gray-300'}`}>{msg.subject}</p>
                        <span className="text-xs text-gray-600 flex-shrink-0">{timeAgo(msg.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{msg.body?.substring(0, 80)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[msg.category] || CATEGORY_COLORS.GENERAL}`}>
                          {msg.category || 'MESSAGE'}
                        </span>
                        <button onClick={(e) => deleteMessage(msg.id, e)} className="text-gray-700 hover:text-red-400 transition-colors text-xs">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
