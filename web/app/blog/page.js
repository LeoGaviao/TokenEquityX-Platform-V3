'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const GOLD = '#C8972B';

const CATS = ['All', 'Featured', 'Market Intelligence', 'Education', 'Research', 'Case Study'];
const CAT_COLORS = {
  'Market Intelligence': 'bg-blue-900/50 text-blue-300',
  'Education':           'bg-green-900/50 text-green-300',
  'Research':            'bg-purple-900/50 text-purple-300',
  'Case Study':          'bg-amber-900/50 text-amber-300',
  'General':             'bg-gray-700 text-gray-300',
};

export default function BlogPage() {
  const [posts,       setPosts]       = useState([]);
  const [cat,         setCat]         = useState('All');
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(null); // preview accordion id

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

  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // schema.org BlogPosting list for the index page
  const jsonLd = posts.length > 0 ? {
    '@context':      'https://schema.org',
    '@type':         'Blog',
    name:            'TokenEquityX Blog',
    url:             'https://tokenequityx.co.zw/blog',
    description:     "Market intelligence, education and research on Africa's digital capital markets.",
    blogPost: posts.slice(0, 10).map(p => ({
      '@type':       'BlogPosting',
      headline:      p.title,
      description:   p.summary,
      url:           `https://tokenequityx.co.zw/blog/${p.slug}`,
      datePublished: p.published_at || p.created_at,
      author:        { '@type': 'Person', name: p.author },
    })),
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="min-h-screen bg-gray-950 text-white pt-20">

        {/* HEADER */}
        <section className="py-24 px-6 border-b border-gray-800">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">
              Insights
            </span>
            <h1 className="text-5xl font-black mb-6">
              The TokenEquityX <span style={{ color: GOLD }}>Blog</span>
            </h1>
            <p className="text-gray-400 text-xl">
              Market intelligence, education, and research on Africa&apos;s digital capital markets.
            </p>
          </div>
        </section>

        {/* CATEGORY FILTER */}
        <section className="py-8 px-6 border-b border-gray-800 bg-gray-900/50">
          <div className="max-w-screen-xl mx-auto flex flex-wrap gap-2 justify-center">
            {CATS.map(c => (
              <button key={c}
                onClick={() => { setCat(c); setExpanded(null); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${cat === c ? 'text-gray-900 font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                style={cat === c ? { background: GOLD } : {}}>
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
                {featured.map(p => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-8 grid grid-cols-1 xl:grid-cols-2 gap-8 items-center transition-all">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[p.category] || 'bg-gray-700 text-gray-300'}`}>{p.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">★ Featured</span>
                      </div>
                      <h2 className="text-3xl font-black mb-4 leading-tight">{p.title}</h2>
                      <p className="text-gray-400 leading-relaxed mb-4">{p.summary}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-5">
                        <span>By {p.author}</span><span>·</span>
                        <span>{fmt(p.published_at || p.created_at)}</span><span>·</span>
                        <span>{p.read_time}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href={`/blog/${p.slug}`}
                          className="px-4 py-2 rounded-lg text-sm font-bold text-gray-900 hover:opacity-90 transition-opacity"
                          style={{ background: GOLD }}>
                          Read article →
                        </Link>
                        <button
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
                          {expanded === p.id ? '▲ Hide summary' : '▼ Quick summary'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-2xl h-48 flex items-center justify-center">
                      <span className="text-6xl opacity-30">📰</span>
                    </div>
                    {/* Progressive enhancement: inline summary preview */}
                    {expanded === p.id && (
                      <div className="xl:col-span-2 bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 text-sm text-gray-300 leading-relaxed">
                        <p className="mb-3">{p.summary}</p>
                        <Link href={`/blog/${p.slug}`} className="text-blue-400 hover:text-blue-300 text-xs font-semibold">
                          Continue reading on the full article page →
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Grid of remaining posts */}
            {!loading && nonFeatured.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {nonFeatured.map(p => (
                  <article key={p.id}
                    className={`bg-gray-900 border rounded-2xl p-6 flex flex-col transition-all ${expanded === p.id ? 'border-blue-700' : 'border-gray-800 hover:border-gray-600'}`}>
                    <span className={`text-xs px-2 py-0.5 rounded-full self-start mb-4 ${CAT_COLORS[p.category] || 'bg-gray-700 text-gray-300'}`}>
                      {p.category}
                    </span>
                    <h3 className="font-black text-lg mb-3 leading-tight flex-1">{p.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">{p.summary}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4 mt-auto">
                      <span>{p.author} · {fmt(p.published_at || p.created_at)}</span>
                      <span>{p.read_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/blog/${p.slug}`}
                        className="flex-1 text-center py-2 rounded-lg text-xs font-bold text-gray-900 hover:opacity-90 transition-opacity"
                        style={{ background: GOLD }}>
                        Read article →
                      </Link>
                      <button
                        onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                        title="Quick summary">
                        {expanded === p.id ? '▲' : '▼'}
                      </button>
                    </div>
                    {/* Progressive enhancement: inline summary preview */}
                    {expanded === p.id && (
                      <div className="mt-3 bg-gray-800/40 rounded-xl p-4 text-xs text-gray-300 leading-relaxed">
                        <p className="mb-2">{p.summary}</p>
                        <Link href={`/blog/${p.slug}`} className="text-blue-400 hover:text-blue-300 font-semibold">
                          Read full article →
                        </Link>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SUBSCRIBE */}
        <section className="py-16 px-6 border-t border-gray-800 bg-gray-900/50">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-2xl font-black mb-3">Subscribe to Market Updates</h3>
            <p className="text-gray-400 text-sm mb-6">
              Weekly market intelligence, new listing announcements, and regulatory updates delivered to your inbox.
            </p>
            <div className="flex gap-3 max-w-md mx-auto">
              <input type="email" placeholder="your@email.com"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600"/>
              <button className="px-6 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90 text-sm" style={{ background: GOLD }}>
                Subscribe
              </button>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
