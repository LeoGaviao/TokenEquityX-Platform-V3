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
      { label: 'Who We Are',        href: '/about#who-we-are',    icon: '🏢' },
      { label: 'Our Mission',        href: '/about#mission',        icon: '🎯' },
      { label: 'Leadership Team',    href: '/about#team',           icon: '👥' },
      { label: 'Regulatory Status', href: '/about#regulatory',     icon: '📋' },
      { label: 'Partnerships',       href: '/about#partnerships',   icon: '🤝' },
    ],
  },
  {
    label: 'Services', href: '/markets',
    children: [
      { label: 'Issuance Services',  href: '/markets#issuance',    icon: '🏛' },
      { label: 'Secondary Trading',  href: '/markets#trading',     icon: '📈' },
      { label: 'Dividend Services',  href: '/markets#dividends',   icon: '💰' },
      { label: 'KYC & Compliance',   href: '/markets#kyc',         icon: '🔒' },
      { label: 'White-Label',        href: '/technology#whitelabel',icon: '🏷️' },
      { label: 'API Access',         href: '/technology#api',      icon: '🔌' },
    ],
  },
  { label: 'Pricesheet',  href: '/market-watch' },
  {
    label: 'Companies', href: '/markets#listed',
    children: [
      { label: 'ZimInfra Bond 2027', href: '/#login-section', icon: '📄' },
      { label: 'Harare CBD REIT',    href: '/#login-section', icon: '🏛' },
      { label: 'Acme Mining Ltd',    href: '/#login-section', icon: '⛏️' },
      { label: 'Great Dyke Minerals',href: '/#login-section', icon: '💎' },
      { label: 'View All Listings',  href: '/#login-section', icon: '📊' },
    ],
  },
  {
    label: 'Research', href: '/resources',
    children: [
      { label: 'Market Reports',     href: '/resources#reports',   icon: '📊' },
      { label: 'Investor Guide',     href: '/resources#investor',  icon: '📗' },
      { label: 'Issuer Guide',       href: '/resources#issuer',    icon: '📘' },
      { label: 'Whitepaper',         href: '/resources#whitepaper',icon: '📃' },
      { label: 'FAQs',              href: '/resources#faq',       icon: '❔' },
    ],
  },
  { label: 'Blog',    href: '/blog' },
  { label: 'Contact', href: '/contact', highlight: true },
];

export default function PublicNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]         = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);

  const go = (href) => {
    setOpen(null);
    setMobileOpen(false);
    setMobileExpanded(null);
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
    <div className="w-full bg-gray-900 border-b border-gray-800 z-40">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <button onClick={() => go('/')} className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg transition-transform group-hover:scale-105"
              style={{ background:`linear-gradient(135deg, ${NAVY}, #2563eb)` }}>
              <span className="text-white text-base">TX</span>
            </div>
            <div className="hidden sm:block leading-none">
              <p className="font-black text-white text-base leading-none">TokenEquityX</p>
              <p className="leading-none mt-0.5" style={{ color:GOLD, fontSize:'11px' }}>Africa's Digital Capital Market</p>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-auto mr-3">
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

          {/* Desktop Sign In */}
          <button onClick={() => go('/login')}
            className="hidden lg:block text-sm font-bold px-4 py-1.5 rounded-lg transition-all hover:opacity-90 text-gray-900 whitespace-nowrap"
            style={{ background: GOLD }}>
            Sign In
          </button>

          {/* Mobile: Sign In + Hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <button onClick={() => go('/login')}
              className="text-sm font-bold px-3 py-1.5 rounded-lg text-gray-900 whitespace-nowrap"
              style={{ background: GOLD }}>
              Sign In
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle menu">
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-800 bg-gray-900 max-h-screen overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map(item => (
              <div key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === item.label ? null : item.label)}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <span>{item.label}</span>
                      <svg className={`w-4 h-4 transition-transform ${mobileExpanded === item.label ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {mobileExpanded === item.label && (
                      <div className="ml-3 mt-1 space-y-1 border-l-2 border-gray-700 pl-3">
                        {item.children.map(child => (
                          <button key={child.label} onClick={() => go(child.href)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-left">
                            <span className="text-base">{child.icon}</span>
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => go(item.href)}
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      item.highlight
                        ? 'text-gray-900 font-bold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                    style={item.highlight ? { background: GOLD } : {}}>
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
