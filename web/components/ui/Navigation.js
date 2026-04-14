'use client';
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
    { href: '/issuer',             label: 'Dashboard',  icon: '🏢' },
    { href: '/issuer/register',    label: 'Register',   icon: '➕' },
    { href: '/issuer/data',        label: 'Financials', icon: '📋' },
    { href: '/issuer/governance',  label: 'Governance', icon: '⚖️' },
    { href: '/issuer/dividends',   label: 'Dividends',  icon: '💸' },
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
          <span className={`text-xs px-2 py-0.5 rounded-full ${roleColor}`}>
            {user.role}
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-1">
          {links.map(link => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
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
      </div>
    </nav>
  );
}
