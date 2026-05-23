'use client';

export default function PremiumBadge({ premiumAccess }) {
  if (!premiumAccess) return null;

  if (premiumAccess.hasPremium && premiumAccess.reason === 'GLOBAL_TRIAL') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-yellow-700/40 bg-yellow-900/20 text-yellow-300 text-sm mb-4">
        <span>🌟</span>
        <span className="font-semibold">Premium Access</span>
        <span className="text-yellow-500/80">·</span>
        <span className="text-yellow-400/80">Sandbox Trial Period</span>
      </div>
    );
  }

  if (premiumAccess.hasPremium && premiumAccess.reason === 'INDIVIDUAL_TRIAL') {
    const total     = 30;
    const remaining = premiumAccess.daysRemaining || 0;
    const usedPct   = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
    return (
      <div className="px-4 py-3 rounded-xl border border-yellow-700/40 bg-yellow-900/20 text-yellow-300 text-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span>🌟</span>
          <span className="font-semibold">Premium Trial</span>
          <span className="text-yellow-500/80">·</span>
          <span className="text-yellow-400/80">{remaining} day{remaining !== 1 ? 's' : ''} remaining</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-yellow-900/50 overflow-hidden">
          <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${usedPct}%` }} />
        </div>
      </div>
    );
  }

  if (premiumAccess.hasPremium && premiumAccess.reason === 'PAID_SUBSCRIPTION') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-yellow-600/50 bg-yellow-900/30 text-yellow-300 text-sm mb-4">
        <span>⭐</span>
        <span className="font-semibold">Premium Member</span>
      </div>
    );
  }

  // EXPIRED — informational amber banner
  return (
    <div className="px-4 py-3 rounded-xl border border-amber-700/50 bg-amber-900/20 text-amber-300 text-sm mb-4 flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold mb-0.5">Your premium trial has ended.</p>
        <p className="text-amber-400/80 text-xs">Upgrade to Premium to access advanced analytics, compliance exports, and priority support.</p>
      </div>
      <button
        onClick={() => window.location.href = '/profile'}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors">
        Upgrade
      </button>
    </div>
  );
}
