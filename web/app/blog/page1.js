'use client';
import { useState } from 'react';
const GOLD='#C8972B', NAVY='#1A3C5E';
const POSTS=[
  {id:1,title:'Why Zimbabwe is Becoming Africa\'s Tokenisation Hub',cat:'Market Intelligence',date:'15 Mar 2026',author:'Richard Chimuka',readTime:'6 min',summary:'Zimbabwe\'s unique combination of USD economy, SECZ regulatory innovation, and mineral wealth positions it as the natural home for Africa\'s first regulated tokenised asset exchange.',tag:'featured'},
  {id:2,title:'What is Asset Tokenisation? A Practical Guide for African Investors',cat:'Education',date:'10 Mar 2026',author:'Leo Gaviao',readTime:'8 min',summary:'Tokenisation converts real-world asset ownership into digital tokens on a blockchain. Here\'s what that means in practice — and why it matters for everyday African investors.'},
  {id:3,title:'The USD 42 Billion Problem: Africa\'s SME Financing Gap',cat:'Research',date:'05 Mar 2026',author:'Richard Chimuka',readTime:'5 min',summary:'African SMEs need USD 42 billion more capital than they can access. Tokenisation won\'t solve everything — but it can unlock a significant slice of that gap.'},
  {id:4,title:'How PGM Royalty Tokens Could Revolutionise Zimbabwe\'s Mining Finance',cat:'Market Intelligence',date:'28 Feb 2026',author:'Leo Gaviao',readTime:'7 min',summary:'Zimbabwe holds the world\'s second largest platinum group metal reserves. We explore how tokenisation could transform how mining companies raise capital and how investors access PGM exposure.'},
  {id:5,title:'USDC Settlement: Why Stablecoins Matter for African Capital Markets',cat:'Education',date:'22 Feb 2026',author:'Leo Gaviao',readTime:'5 min',summary:'Settlement in USDC eliminates currency risk, enables instant cross-border investment, and reduces transaction costs by 90% compared to traditional correspondent banking.'},
  {id:6,title:'Understanding REIT Tokenisation: The Harare CBD Example',cat:'Case Study',date:'15 Feb 2026',author:'Richard Chimuka',readTime:'9 min',summary:'A deep dive into how commercial property in the Harare Central Business District was structured as a tokenised REIT — from SPV registration to first distribution.'},
];
const CATS=['All','Featured','Market Intelligence','Education','Research','Case Study'];
const CAT_COLORS={'Market Intelligence':'bg-blue-900/50 text-blue-300','Education':'bg-green-900/50 text-green-300','Research':'bg-purple-900/50 text-purple-300','Case Study':'bg-amber-900/50 text-amber-300'};

export default function BlogPage() {
  const [cat,setCat]=useState('All');
  const filtered=cat==='All'?POSTS:POSTS.filter(p=>p.cat===cat||p.tag===cat.toLowerCase());
  return(
    <div className="min-h-screen bg-gray-950 text-white pt-20">
      <section className="py-24 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Insights</span>
          <h1 className="text-5xl font-black mb-6">The TokenEquityX <span style={{color:GOLD}}>Blog</span></h1>
          <p className="text-gray-400 text-xl">Market intelligence, education, and research on Africa\'s digital capital markets.</p>
        </div>
      </section>
      <section className="py-8 px-6 border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-screen-xl mx-auto flex flex-wrap gap-2 justify-center">
          {CATS.map(c=>(
            <button key={c} onClick={()=>setCat(c)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${cat===c?'text-gray-900 font-bold':'bg-gray-800 text-gray-400 hover:text-white'}`} style={cat===c?{background:GOLD}:{}}>
              {c}
            </button>
          ))}
        </div>
      </section>
      <section className="py-16 px-6">
        <div className="max-w-screen-xl mx-auto">
          {filtered.filter(p=>p.tag==='featured').length>0&&cat==='All'&&(
            <div className="mb-12">
              {filtered.filter(p=>p.tag==='featured').map(p=>(
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 grid grid-cols-1 xl:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[p.cat]||'bg-gray-700 text-gray-300'}`}>{p.cat}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">⭐ Featured</span>
                    </div>
                    <h2 className="text-3xl font-black mb-4 leading-tight">{p.title}</h2>
                    <p className="text-gray-400 leading-relaxed mb-6">{p.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>By {p.author}</span><span>·</span><span>{p.date}</span><span>·</span><span>{p.readTime}</span>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl h-48 flex items-center justify-center">
                    <span className="text-6xl opacity-30">📰</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.filter(p=>p.tag!=='featured'||cat!=='All').map(p=>(
              <div key={p.id} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 cursor-pointer transition-all flex flex-col">
                <span className={`text-xs px-2 py-0.5 rounded-full self-start mb-4 ${CAT_COLORS[p.cat]||'bg-gray-700 text-gray-300'}`}>{p.cat}</span>
                <h3 className="font-black text-lg mb-3 leading-tight flex-1">{p.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{p.summary}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto">
                  <span>{p.author} · {p.date}</span>
                  <span>{p.readTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-16 px-6 border-t border-gray-800 bg-gray-900/50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-black mb-3">Subscribe to Market Updates</h3>
          <p className="text-gray-400 text-sm mb-6">Weekly market intelligence, new listing announcements, and regulatory updates delivered to your inbox.</p>
          <div className="flex gap-3 max-w-md mx-auto">
            <input type="email" placeholder="your@email.com" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600"/>
            <button className="px-6 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90 text-sm" style={{background:GOLD}}>Subscribe</button>
          </div>
        </div>
      </section>
    </div>
  );
}
