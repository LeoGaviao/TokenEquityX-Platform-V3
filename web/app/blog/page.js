'use client';
import { useState, useEffect } from 'react';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const GOLD = '#C8972B';
const NAVY = '#1A3C5E';

const CATS = ['All','Featured','Market Intelligence','Education','Research','Case Study'];
const CAT_COLORS = {
  'Market Intelligence':'bg-blue-900/50 text-blue-300',
  'Education':          'bg-green-900/50 text-green-300',
  'Research':           'bg-purple-900/50 text-purple-300',
  'Case Study':         'bg-amber-900/50 text-amber-300',
  'General':            'bg-gray-700 text-gray-300',
};

export default function BlogPage() {
  const [posts,   setPosts]   = useState([]);
  const [cat,     setCat]     = useState('All');
  const [loading, setLoading] = useState(true);
  const [active,  setActive]  = useState(null); // expanded post id
  const [fullPost, setFullPost] = useState(null); // full post body loaded on demand
  const [postLoading, setPostLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/blog`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPosts(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter(p => {
    if (cat === 'All')      return true;
    if (cat === 'Featured') return p.featured;
    return p.category === cat;
  });

  const featured    = filtered.filter(p => p.featured);
  const nonFeatured = filtered.filter(p => !p.featured || cat !== 'All');

  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  const openPost = async (p) => {
    if (active === p.id) { setActive(null); setFullPost(null); return; }
    setActive(p.id);
    setFullPost(null);
    setPostLoading(true);
    try {
      const res = await fetch(`${API}/blog/${p.slug}`);
      const data = await res.json();
      if (data && data.body) setFullPost(data);
      else setFullPost(p);
    } catch {
      setFullPost(p);
    } finally {
      setPostLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20">

      {/* HEADER */}
      <section className="py-24 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Insights</span>
          <h1 className="text-5xl font-black mb-6">The TokenEquityX <span style={{color:GOLD}}>Blog</span></h1>
          <p className="text-gray-400 text-xl">Market intelligence, education, and research on Africa's digital capital markets.</p>
        </div>
      </section>

      {/* CATEGORY FILTER */}
      <section className="py-8 px-6 border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-screen-xl mx-auto flex flex-wrap gap-2 justify-center">
          {CATS.map(c=>(
            <button key={c} onClick={()=>{ setCat(c); setActive(null); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${cat===c?'text-gray-900 font-bold':'bg-gray-800 text-gray-400 hover:text-white'}`}
              style={cat===c?{background:GOLD}:{}}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* POSTS */}
      <section className="py-16 px-6">
        <div className="max-w-screen-xl mx-auto">

          {loading && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-2xl mb-2">⏳</p>
              <p className="text-sm">Loading articles…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-3xl mb-3">📝</p>
              <p className="font-semibold mb-1">No articles in this category yet</p>
              <p className="text-sm">Check back soon.</p>
            </div>
          )}

          {/* Featured post */}
          {!loading && featured.length > 0 && cat === 'All' && (
            <div className="mb-12">
              {featured.map(p=>(
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 grid grid-cols-1 xl:grid-cols-2 gap-8 items-center cursor-pointer hover:border-gray-600 transition-all"
                  onClick={()=>openPost(p)}>
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[p.category]||'bg-gray-700 text-gray-300'}`}>{p.category}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">★ Featured</span>
                    </div>
                    <h2 className="text-3xl font-black mb-4 leading-tight">{p.title}</h2>
                    <p className="text-gray-400 leading-relaxed mb-6">{p.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>By {p.author}</span><span>·</span><span>{fmt(p.published_at||p.created_at)}</span><span>·</span><span>{p.read_time}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-3">{active===p.id?'▲ Click to collapse':'▼ Click to read'}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl h-48 flex items-center justify-center">
                    <span className="text-6xl opacity-30">📰</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expanded article body */}
          {active && (() => {
            const p = fullPost || posts.find(x => x.id === active);
            if (!p) return null;
            if (postLoading) return (
              <div className="mb-12 text-center py-8 text-gray-500">
                <p className="text-2xl mb-2">⏳</p>
                <p className="text-sm">Loading article…</p>
              </div>
            );
            if (!p.body) return null;
            return (
              <div className="mb-12 bg-gray-900 border border-blue-800/40 rounded-2xl p-8 max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[p.category]||'bg-gray-700 text-gray-300'}`}>{p.category}</span>
                  <button onClick={()=>setActive(null)} className="text-gray-500 hover:text-white text-sm">✕ Close</button>
                </div>
                <h2 className="text-2xl font-black mb-2">{p.title}</h2>
                <p className="text-gray-500 text-xs mb-6">By {p.author}{p.author_role ? ` — ${p.author_role}` : ''} · {fmt(p.published_at||p.created_at)} · {p.read_time}</p>
                <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                  {p.body}
                </div>
              </div>
            );
          })()}

          {/* Grid of non-featured posts */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {nonFeatured.map(p=>(
                <div key={p.id}
                  className={`bg-gray-900 border rounded-2xl p-6 cursor-pointer transition-all flex flex-col ${active===p.id?'border-blue-700':'border-gray-800 hover:border-gray-600'}`}
                  onClick={()=>openPost(p)}>
                  <span className={`text-xs px-2 py-0.5 rounded-full self-start mb-4 ${CAT_COLORS[p.category]||'bg-gray-700 text-gray-300'}`}>{p.category}</span>
                  <h3 className="font-black text-lg mb-3 leading-tight flex-1">{p.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{p.summary}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-auto">
                    <span>{p.author} · {fmt(p.published_at||p.created_at)}</span>
                    <span>{p.read_time}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{active===p.id?'▲ Collapse':'▼ Read article'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SUBSCRIBE */}
      <section className="py-16 px-6 border-t border-gray-800 bg-gray-900/50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-black mb-3">Subscribe to Market Updates</h3>
          <p className="text-gray-400 text-sm mb-6">Weekly market intelligence, new listing announcements, and regulatory updates delivered to your inbox.</p>
          <div className="flex gap-3 max-w-md mx-auto">
            <input type="email" placeholder="your@email.com"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600"/>
            <button className="px-6 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90 text-sm" style={{background:GOLD}}>Subscribe</button>
          </div>
        </div>
      </section>
    </div>
  );
}
