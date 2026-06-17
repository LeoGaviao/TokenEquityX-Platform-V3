export default function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse ${className}`}>
      <div className="h-3 bg-gray-700 rounded-full w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 bg-gray-800 rounded-full mb-2.5"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonStat({ className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse ${className}`}>
      <div className="h-2.5 bg-gray-700 rounded-full w-1/2 mb-3" />
      <div className="h-7 bg-gray-700 rounded-full w-3/4 mb-2" />
      <div className="h-2 bg-gray-800 rounded-full w-1/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 4, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse ${className}`}>
      <div className="flex gap-4 px-4 py-3 border-b border-gray-800">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-2.5 bg-gray-700 rounded-full flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-gray-800/50">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-2 bg-gray-800 rounded-full flex-1"
              style={{ opacity: 1 - r * 0.15 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
