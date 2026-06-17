export default function Loading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[9999]"
      style={{ background: '#1A1F2E' }}
    >
      {/* Hexagon logo */}
      <div className="mb-8 animate-pulse">
        <svg viewBox="0 0 512 512" width="96" height="96">
          <rect width="512" height="512" rx="80" fill="#1A1F2E"/>
          <polygon points="416,256 336,394.9 176,394.9 96,256 176,117.1 336,117.1" fill="#C8972B"/>
          <polygon points="356,256 296,359.3 196,359.3 136,256 196,152.7 296,152.7" fill="#1A1F2E"/>
          <rect x="216" y="196" width="80" height="16" rx="4" fill="#C8972B"/>
          <rect x="248" y="212" width="16" height="100" rx="4" fill="#C8972B"/>
        </svg>
      </div>

      {/* Brand name */}
      <h1 className="text-white font-black text-2xl tracking-widest mb-1">
        TOKEN<span style={{ color: '#C8972B' }}>EQUITY</span>X
      </h1>
      <p className="text-gray-500 text-xs tracking-widest uppercase mb-10">
        Digital Capital Market
      </p>

      {/* Loading bar */}
      <div className="w-48 h-0.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            background: '#C8972B',
            animation: 'loadingBar 1.6s ease-in-out infinite',
            width: '40%',
          }}
        />
      </div>

      <style>{`
        @keyframes loadingBar {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
