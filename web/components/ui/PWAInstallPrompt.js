'use client';
import { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroid,    setShowAndroid]    = useState(false);
  const [showIOS,        setShowIOS]        = useState(false);
  const [dismissed,      setDismissed]      = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;

    if (isInStandalone) return;

    if (isIOS) {
      const timer = setTimeout(() => setShowIOS(true), 30000);
      return () => clearTimeout(timer);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const timer = setTimeout(() => setShowAndroid(true), 30000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
    setShowAndroid(false);
    setShowIOS(false);
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    dismiss();
  };

  if (dismissed || (!showAndroid && !showIOS)) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[200]
                    bg-[#1A1F2E] border border-[#C8972B]/60 rounded-2xl shadow-2xl p-4
                    animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden">
          <svg viewBox="0 0 512 512" width="48" height="48">
            <rect width="512" height="512" rx="80" fill="#1A1F2E"/>
            <polygon points="416,256 336,394.9 176,394.9 96,256 176,117.1 336,117.1" fill="#C8972B"/>
            <polygon points="356,256 296,359.3 196,359.3 136,256 196,152.7 296,152.7" fill="#1A1F2E"/>
            <rect x="216" y="196" width="80" height="16" rx="4" fill="#C8972B"/>
            <rect x="248" y="212" width="16" height="100" rx="4" fill="#C8972B"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">Add TokenEquityX to Home Screen</p>
          {showAndroid && (
            <p className="text-gray-400 text-xs mt-0.5">Install for faster access to your portfolio — works offline too.</p>
          )}
          {showIOS && (
            <p className="text-gray-400 text-xs mt-0.5">
              Tap <span className="text-[#C8972B] font-semibold">Share</span> → <span className="text-[#C8972B] font-semibold">Add to Home Screen</span>
            </p>
          )}
        </div>
        <button onClick={dismiss} className="text-gray-500 hover:text-white text-lg leading-none flex-shrink-0" aria-label="Dismiss">✕</button>
      </div>

      {showAndroid && (
        <div className="flex gap-2 mt-3">
          <button onClick={dismiss}
            className="flex-1 py-2 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-500 transition">
            Not now
          </button>
          <button onClick={install}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition"
            style={{ background: '#C8972B' }}>
            Install
          </button>
        </div>
      )}

      {showIOS && (
        <div className="mt-3 bg-gray-800/60 rounded-xl p-3 text-xs text-gray-300 space-y-1.5">
          <div className="flex items-center gap-2"><span className="text-[#C8972B]">1.</span> Tap the Share button (⬆) in Safari</div>
          <div className="flex items-center gap-2"><span className="text-[#C8972B]">2.</span> Scroll down and tap "Add to Home Screen"</div>
          <div className="flex items-center gap-2"><span className="text-[#C8972B]">3.</span> Tap "Add" to confirm</div>
        </div>
      )}
    </div>
  );
}
