'use client';
import { useRouter, usePathname } from 'next/navigation';

const NAVY = '#1A3C5E';
const GOLD = '#C8972B';

const FOOTER_COLS = {
  'About Us': [
    { label:'Who We Are',         href:'/about#who-we-are' },
    { label:'Our Mission',         href:'/about#mission' },
    { label:'Leadership Team',     href:'/about#team' },
    { label:'Regulatory Status',  href:'/about#regulatory' },
    { label:'Partnerships',        href:'/about#partnerships' },
  ],
  'Services': [
    { label:'Issuance Services',   href:'/markets#issuance' },
    { label:'Secondary Trading',   href:'/markets#trading' },
    { label:'Dividend Services',   href:'/markets#dividends' },
    { label:'KYC & Compliance',    href:'/markets#kyc' },
    { label:'White-Label Platform',href:'/technology#whitelabel' },
  ],
  'Pricesheet': [
    { label:'Live Prices',         href:'/market-watch#prices' },
    { label:'Trading Activity',    href:'/market-watch#activity' },
    { label:'Market News',         href:'/market-watch#news' },
    { label:'Economic Calendar',   href:'/market-watch#calendar' },
  ],
  'Companies': [
    { label:'ZimInfra Bond 2027',  href:'/#login' },
    { label:'Harare CBD REIT',     href:'/#login' },
    { label:'Acme Mining Ltd',     href:'/#login' },
    { label:'Great Dyke Minerals', href:'/#login' },
    { label:'View All Listings',   href:'/#login' },
  ],
  'Research': [
    { label:'Market Reports',      href:'/resources#reports' },
    { label:'Investor Guide',      href:'/resources#investor' },
    { label:'Issuer Guide',        href:'/resources#issuer' },
    { label:'Whitepaper',          href:'/resources#whitepaper' },
    { label:'FAQs',               href:'/resources#faq' },
  ],
  'Blog & Contact': [
    { label:'Blog',                href:'/blog' },
    { label:'Contact Us',          href:'/contact' },
    { label:'Become a Partner',    href:'/contact#partner' },
    { label:'List Your Asset',     href:'/contact#issuer' },
    { label:'Support',             href:'/contact#support' },
  ],
};

// Top-level nav links repeated in footer
const TOP_NAV = ['Home','About Us','Services','Pricesheet','Companies','Research','Blog','Contact'];
const TOP_NAV_HREFS = {
  'Home':'/','About Us':'/about','Services':'/markets',
  'Pricesheet':'/market-watch','Companies':'/markets#listed',
  'Research':'/resources','Blog':'/blog','Contact':'/contact',
};

export default function PublicFooter() {
  const pathname = usePathname();
  const router   = useRouter();

  const authPaths = ['/admin','/investor','/issuer','/auditor','/partner','/setup'];
  if (authPaths.some(p => pathname.startsWith(p))) return null;

  const go = (href) => {
    if (href === '/') { router.push('/'); return; }
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      if (path && path !== pathname) { router.push(href); return; }
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior:'smooth' }), 100);
    } else {
      router.push(href);
    }
  };

  return (
    <footer className="bg-gray-950 border-t border-gray-800 mt-20">

      {/* ── CTA BAND ──────────────────────────────────────────── */}
      <div className="border-b border-gray-800" style={{ background:`linear-gradient(135deg, ${NAVY}22, transparent)` }}>
        <div className="max-w-screen-xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-black text-white mb-1">Ready to invest in Africa's future?</h3>
            <p className="text-gray-400 text-sm">Open your account in minutes. Fully regulated. Blockchain-secured.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={() => go('/contact#issuer')}
              className="px-6 py-3 rounded-xl text-sm font-bold border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-all">
              List an Asset
            </button>
            <button onClick={() => go('/#login')}
              className="px-6 py-3 rounded-xl text-sm font-bold text-gray-900 hover:opacity-90 transition-all"
              style={{ background:GOLD }}>
              Open Account
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP NAV ROW (repeated in footer) ──────────────────── */}
      <div className="border-b border-gray-800/60">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-6">
          {TOP_NAV.map(label => (
            <button key={label} onClick={() => go(TOP_NAV_HREFS[label])}
              className={`text-sm font-semibold transition-colors ${
                label==='Contact' ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LINKS GRID ────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-8">
          {Object.entries(FOOTER_COLS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-white font-bold text-sm mb-4 uppercase tracking-wider"
                style={{ color: section==='Blog & Contact' ? GOLD : undefined }}>
                {section}
              </h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <button onClick={() => go(link.href)}
                      className="text-gray-500 hover:text-gray-200 text-sm transition-colors text-left">
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM BAR ────────────────────────────────────────── */}
      <div className="border-t border-gray-800">
        <div className="max-w-screen-xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ background:NAVY }}>
              <span className="text-white">TX</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">TokenEquityX Ltd</p>
              <p className="text-gray-600 text-xs">Harare, Zimbabwe · Regulated by SECZ Innovation Sandbox</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            {['Privacy Policy','Terms of Use','Risk Disclosure','Cookie Policy'].map(l => (
              <button key={l} className="hover:text-gray-400 transition-colors">{l}</button>
            ))}
          </div>
          <p className="text-gray-700 text-xs text-center">
            © {new Date().getFullYear()} TokenEquityX Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
