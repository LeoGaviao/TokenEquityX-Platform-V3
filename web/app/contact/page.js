'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const GOLD = '#C8972B';
const NAVY = '#1A3C5E';

const CONTACT_CARDS = [
  {
    icon: '💼',
    title: 'For Investors',
    desc: 'Open an account, complete KYC, or ask about our listed assets and investment process.',
    email: 'investor@tokenequityx.co.zw',
  },
  {
    icon: '🏢',
    title: 'For Issuers',
    desc: 'Explore listing your asset, request a tokenisation feasibility assessment, or ask about costs and timelines.',
    email: 'issuers@tokenequityx.co.zw',
  },
  {
    icon: '🤝',
    title: 'For Partners',
    desc: 'Banking partners, DeFi protocols, institutional investors, and technology partners — let\'s build together.',
    email: 'partnerships@tokenequityx.co.zw',
  },
  {
    icon: '📰',
    title: 'Media & Press',
    desc: 'Press enquiries, interview requests, data and statistics about Africa\'s digital capital market.',
    email: 'media@tokenequityx.co.zw',
  },
];

const SUBJECTS = [
  'General Enquiry',
  'I want to invest',
  'I want to list an asset',
  'Partnership opportunity',
  'Press / Media',
  'Technical support',
  'Compliance / regulatory',
];

export default function ContactPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', subject: 'General Enquiry', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError('Please fill in all required fields.');
      return;
    }
    setSending(true);
    setError('');
    // Simulate send — wire to API email endpoint when SMTP is configured
    await new Promise(r => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20">

      {/* HEADER */}
      <section className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Contact</span>
          <h1 className="text-5xl font-black mb-6">Let's <span style={{color:GOLD}}>Talk</span></h1>
          <p className="text-gray-400 text-xl leading-relaxed">
            Whether you're an investor, an issuer, a potential partner, or a member of the press — we'd love to hear from you.
          </p>
        </div>
      </section>

      {/* CONTACT CARDS */}
      <section className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {CONTACT_CARDS.map((c, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 transition-all">
              <span className="text-3xl mb-4 block">{c.icon}</span>
              <h3 className="font-bold text-lg mb-2">{c.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">{c.desc}</p>
              <a href={`mailto:${c.email}`}
                className="text-sm font-medium hover:opacity-80 transition-opacity"
                style={{color:GOLD}}>
                {c.email}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FORM + DETAILS */}
      <section className="py-16 px-6">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-12">

          {/* Form */}
          <div className="xl:col-span-2">
            <h2 className="text-2xl font-black mb-6">Send Us a Message</h2>

            {sent ? (
              <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8 text-center">
                <span className="text-5xl mb-4 block">✅</span>
                <h3 className="font-bold text-xl mb-2">Message Sent!</h3>
                <p className="text-gray-400">Thank you for reaching out. We'll respond within 2 business days.</p>
                <button onClick={()=>setSent(false)} className="mt-6 text-sm text-blue-400 hover:text-blue-300">Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-sm text-red-300">{error}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Tendai Moyo"
                      value={form.name}
                      onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email Address *</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Subject</label>
                  <select
                    value={form.subject}
                    onChange={e=>setForm(f=>({...f,subject:e.target.value}))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition">
                    {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Message *</label>
                  <textarea
                    rows={6}
                    placeholder="Tell us how we can help…"
                    value={form.message}
                    onChange={e=>setForm(f=>({...f,message:e.target.value}))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition resize-none"/>
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-8 py-3.5 rounded-xl font-bold text-gray-900 text-sm disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
                  style={{background:GOLD}}>
                  {sending ? '⏳ Sending…' : 'Send Message →'}
                </button>
                <p className="text-gray-600 text-xs">We respond to all enquiries within 2 business days. For urgent matters call +263 77 XXX XXXX.</p>
              </form>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black mb-6">Our Details</h2>
            {[
              { icon:'📍', label:'Registered Address', value:'TokenEquityX Ltd\nHarare, Zimbabwe' },
              { icon:'📧', label:'General Enquiries',  value:'hello@tokenequityx.co.zw', link:'mailto:hello@tokenequityx.co.zw' },
              { icon:'📧', label:'Compliance',         value:'compliance@tokenequityx.co.zw', link:'mailto:compliance@tokenequityx.co.zw' },
              { icon:'🕐', label:'Office Hours',       value:'Monday – Friday\n08:00 – 17:00 CAT (UTC+2)' },
              { icon:'🏛️', label:'Regulatory',        value:'SECZ Innovation Hub Sandbox\nApplication Reference: TEX-SECZ-2026' },
            ].map((d, i) => (
              <div key={i} className="flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
                <span className="text-xl flex-shrink-0 mt-0.5">{d.icon}</span>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{d.label}</p>
                  {d.link
                    ? <a href={d.link} className="text-sm font-medium hover:opacity-80" style={{color:GOLD}}>{d.value}</a>
                    : <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{d.value}</p>
                  }
                </div>
              </div>
            ))}

            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4">
              <p className="text-xs text-blue-300 leading-relaxed">
                🔒 TokenEquityX Ltd operates under the SECZ Innovation Hub Regulatory Sandbox. All communications are subject to our privacy policy and data protection obligations under Zimbabwean law.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-6 border-t border-gray-800 bg-gray-900/50 text-center">
        <p className="text-gray-400 mb-4">Ready to start investing or listing?</p>
        <button
          onClick={()=>router.push('/#login-section')}
          className="px-8 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90 text-sm"
          style={{background:GOLD}}>
          Access the Platform
        </button>
      </section>
    </div>
  );
}