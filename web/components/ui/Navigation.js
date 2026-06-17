'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';

const NAV_LINKS = {
  INVESTOR: [
    { href: '/investor',           label: 'Dashboard', icon: '📊' },
    { href: '/investor/portfolio', label: 'Portfolio',  icon: '💼' },
    { href: '/investor/trade',     label: 'Trade',      icon: '📈' },
    { href: '/investor/dividends', label: 'Dividends',  icon: '💰' },
    { href: '/investor/vote',      label: 'Vote',       icon: '🗳️' },
  ],
  ISSUER: [
    { href: '/issuer',                      label: 'Dashboard',  icon: '🏢' },
    { href: '/issuer/governance',           label: 'Governance', icon: '⚖️' },
    { href: '/issuer/dividends',            label: 'Dividends',  icon: '💸' },
    { href: '/issuer?tab=reporting',        label: 'Reporting',  icon: '📋' },
    { href: '/issuer?tab=investors',        label: 'Investors',  icon: '👥' },
    { href: '/issuer?tab=resources',        label: 'Resources',  icon: '📚' },
  ],
  AUDITOR: [
    { href: '/auditor',            label: 'Queue',      icon: '📥' },
  ],
  COMPLIANCE_OFFICER: [
    { href: '/auditor',            label: 'Queue',      icon: '📥' },
  ],
  ADMIN: [
    { href: '/admin',              label: 'Dashboard',  icon: '⚙️' },
    { href: '/investor',           label: 'Investor',   icon: '👤' },
    { href: '/issuer',             label: 'Issuer',     icon: '🏢' },
    { href: '/auditor',            label: 'Auditor',    icon: '📥' },
    { href: '/partner',            label: 'Partner',    icon: '🤝' },
    { href: '/defi',               label: 'DeFi',       icon: '📡' },
  ],
  PARTNER: [
    { href: '/partner',            label: 'Analytics',  icon: '📊' },
    { href: '/defi',               label: 'DeFi Data',  icon: '📡' },
  ],
  DFI: [
    { href: '/defi',               label: 'DeFi Portal', icon: '📡' },
  ],
};

const ROLE_COLORS = {
  INVESTOR:           'bg-blue-900 text-blue-300',
  ISSUER:             'bg-green-900 text-green-300',
  AUDITOR:            'bg-purple-900 text-purple-300',
  COMPLIANCE_OFFICER: 'bg-orange-900 text-orange-300',
  ADMIN:              'bg-red-900 text-red-300',
  PARTNER:            'bg-yellow-900 text-yellow-300',
  DFI:                'bg-teal-900 text-teal-300',
};

export default function Navigation() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user: authUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const storedUser = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {};

  const user = authUser || (storedUser?.role ? {
    role:          storedUser.role,
    email:         storedUser.email,
    kycStatus:     storedUser.kycStatus || 'APPROVED',
    walletAddress: storedUser.wallet_address || null,
  } : null);

  if (!user || pathname === '/') return null;

  const links     = NAV_LINKS[user.role] || NAV_LINKS.INVESTOR;
  const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.INVESTOR;

  const handleLogout = () => {
    localStorage.clear();
    if (logout) logout();
    window.location.href = '/';
  };

  const isActive = (link) =>
    (link.href === '/issuer' && !link.href.includes('?') && pathname === '/issuer') ||
    (!link.href.includes('?') && link.href !== '/issuer' && (pathname === link.href || pathname.startsWith(link.href + '/')));

  const goTo = (link) => {
    if (link.href.includes('?tab=')) {
      const tabName = new URLSearchParams(link.href.split('?')[1]).get('tab');
      window.dispatchEvent(new CustomEvent('issuer-tab-change', { detail: { tab: tabName } }));
    } else {
      router.push(link.href);
    }
    setMenuOpen(false);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* Logo */}
        <div
          onClick={() => router.push('/' + (user.role?.toLowerCase() || 'investor'))}
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="text-2xl text-yellow-400">⬡</span>
          <span className="font-bold text-white text-lg">TokenEquityX</span>
          <span className={`text-xs px-2 py-0.5 rounded-full hidden sm:inline ${roleColor}`}>
            {user.role}
          </span>
        </div>

        {/* Links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <button
              key={link.href}
              onClick={() => goTo(link)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                isActive(link)
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>

        {/* User — desktop */}
        <div className="hidden md:flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-gray-500 text-xs">
              {storedUser?.email || user.email ||
                (user.walletAddress
                  ? `${user.walletAddress.slice(0,6)}…${user.walletAddress.slice(-4)}`
                  : '—')}
            </p>
            <p className={`text-xs ${user.kycStatus === 'APPROVED' ? 'text-green-400' : 'text-yellow-400'}`}>
              KYC: {user.kycStatus || 'APPROVED'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-white text-2xl hover:bg-gray-800"
        >
          ☰
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 max-w-[85%] flex flex-col" style={{ background: '#1A1F2E' }}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl" style={{ color: '#C8972B' }}>⬡</span>
                <span className="font-bold text-white">TokenEquityX</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="flex items-center justify-center w-11 h-11 rounded-lg text-white text-2xl hover:bg-white/10"
              >
                ×
              </button>
            </div>

            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-gray-400 text-xs truncate">
                {storedUser?.email || user.email ||
                  (user.walletAddress
                    ? `${user.walletAddress.slice(0,6)}…${user.walletAddress.slice(-4)}`
                    : '—')}
              </p>
              <p className={`text-xs mt-0.5 ${user.kycStatus === 'APPROVED' ? 'text-green-400' : 'text-yellow-400'}`}>
                KYC: {user.kycStatus || 'APPROVED'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {links.map(link => (
                <button
                  key={link.href}
                  onClick={() => goTo(link)}
                  className="w-full flex items-center gap-3 px-4 min-h-[48px] text-left text-sm transition-colors"
                  style={isActive(link) ? { color: '#C8972B', background: 'rgba(200,151,43,0.12)' } : { color: '#cbd5e1' }}
                >
                  <span className="text-lg">{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              ))}
              <button
                onClick={() => { setMenuOpen(false); router.push('/profile'); }}
                className="w-full flex items-center gap-3 px-4 min-h-[48px] text-left text-sm text-gray-300 transition-colors"
              >
                <span className="text-lg">👤</span>
                <span>Profile</span>
              </button>
            </div>

            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full min-h-[44px] rounded-lg text-sm font-medium text-gray-300 border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}