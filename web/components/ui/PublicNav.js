'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NAVY = '#1A3C5E';
const GOLD  = '#C8972B';

const NAV_ITEMS = [
  { label: 'Home',       href: '/' },
  {
    label: 'About Us', href: '/about',
    children: [
      { label: 'Who We Are',         href: '/about#who-we-are',     icon: '🏛️' },
      { label: 'Our Mission',         href: '/about#mission',         icon: '🎯' },
      { label: 'Leadership Team',     href: '/about#team',            icon: '👥' },
      { label: 'Regulatory Status',  href: '/about#regulatory',      icon: '📋' },
      { label: 'Partnerships',        href: '/about#partnerships',    icon: '🤝' },
    ],
  },
  {
    label: 'Services', href: '/markets',
    children: [
      { label: 'Issuance Services',   href: '/markets#issuance',     icon: '🏢' },
      { label: 'Secondary Trading',   href: '/markets#trading',      icon: '🔄' },
      { label: 'Dividend Services',   href: '/markets#dividends',    icon: '💰' },
      { label: 'KYC & Compliance',    href: '/markets#kyc',          icon: '🔍' },
      { label: 'White-Label',         href: '/technology#whitelabel',icon: '🏷️' },
      { label: 'API Access',          href: '/technology#api',       icon: '🔌' },
    ],
  },
  { label: 'Pricesheet',  href: '/market-watch' },
  {
    label: 'Companies', href: '/markets#listed',
    children: [
      { label: 'ZimInfra Bond 2027',  href: '/#login-section', icon: '📜' },
      { label: 'Harare CBD REIT',     href: '/#login-section', icon: '🏢' },
      { label: 'Acme Mining Ltd',     href: '/#login-section', icon: '⛏️' },
      { label: 'Great Dyke Minerals', href: '/#login-section', icon: '💎' },
      { label: 'View All Listings',   href: '/#login-section', icon: '📊' },
    ],
  },
  {
    label: 'Research', href: '/resources',
    children: [
      { label: 'Market Reports',      href: '/resources#reports',    icon: '📈' },
      { label: 'Investor Guide',      href: '/resources#investor',   icon: '📗' },
      { label: 'Issuer Guide',        href: '/resources#issuer',     icon: '📘' },
      { label: 'Whitepaper',          href: '/resources#whitepaper', icon: '📃' },
      { label: 'FAQs',               href: '/resources#faq',        icon: '❓' },
    ],
  },
  { label: 'Blog',    href: '/blog' },
  { label: 'Contact', href: '/contact', highlight: true },
];

export default function PublicNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(null);


  const go = (href) => {
    setOpen(null);
    if (href === '/') { router.push('/'); return; }
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      if (path && path !== pathname) { router.push(href); return; }
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      router.push(href);
    }
  };

  return (
    // Inline bar — sits below the Ticker in the page flow, NOT fixed
    <div className="w-full bg-gray-900 border-b border-gray-800 z-40">
      <div className="max-w-screen-xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <button onClick={() => go('/')} className="flex items-center gap-3 mr-6 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg transition-transform group-hover:scale-105"
              style={{ background:`linear-gradient(135deg, ${NAVY}, #2563eb)` }}>
              <span className="text-white text-base">TX</span>
            </div>
            <div className="hidden sm:block leading-none">
              <p className="font-black text-white text-base leading-none">TokenEquityX</p>
              <p className="leading-none mt-0.5" style={{ color:GOLD, fontSize:'11px' }}>Africa's Digital Capital Market</p>
            </div>
          </button>

          {/* Nav links — pushed to the right */}
          <nav className="flex items-center gap-0.5 ml-auto">
            {NAV_ITEMS.map(item => (
              <div key={item.label} className="relative"
                onMouseEnter={() => item.children && setOpen(item.label)}
                onMouseLeave={() => setOpen(null)}>

                <button
                  onClick={() => !item.children && go(item.href)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    item.highlight
                      ? 'font-bold px-4 text-gray-900'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  style={item.highlight ? { background: GOLD } : {}}>
                  {item.label}
                  {item.children && (
                    <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${open === item.label ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  )}
                </button>

                {/* Dropdown */}
                {item.children && open === item.label && (
                  <div className="absolute top-full left-0 pt-1 w-56 z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                      {item.children.map(child => (
                        <button key={child.label} onClick={() => go(child.href)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left">
                          <span className="text-base flex-shrink-0">{child.icon}</span>
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Sign In */}
          <button onClick={() => go('/#login-section')}
            className="text-sm font-bold px-4 py-1.5 rounded-lg transition-all hover:opacity-90 text-gray-900 whitespace-nowrap"
            style={{ background: GOLD }}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
