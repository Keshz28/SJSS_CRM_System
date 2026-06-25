export default function Loading() {
  return (
    <div className="flex flex-col flex-1">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 bg-dx-bg/95 border-b border-dx-line px-6 py-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-dx-surface rounded-lg animate-pulse" />
          <div className="h-3 w-24 bg-dx-surface rounded-lg animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-dx-surface animate-pulse" />
          <div className="w-9 h-9 rounded-lg bg-dx-surface animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-dx-surface animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <main className="flex-1 p-6 space-y-5">
        {/* Stat cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="dx-card p-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-dx-surface-hover animate-pulse flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-dx-surface-hover rounded animate-pulse" />
                <div className="h-6 w-12 bg-dx-surface-hover rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Main card skeleton */}
        <div className="dx-card overflow-hidden">
          <div className="px-5 py-4 border-b border-dx-line flex items-center justify-between">
            <div className="h-4 w-32 bg-dx-surface-hover rounded animate-pulse" />
            <div className="h-3 w-20 bg-dx-surface-hover rounded animate-pulse" />
          </div>
          <div className="divide-y divide-dx-line">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-dx-surface-hover animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 bg-dx-surface-hover rounded animate-pulse" />
                  <div className="h-3 w-24 bg-dx-surface-hover rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-full bg-dx-surface-hover animate-pulse" />
                <div className="h-4 w-20 bg-dx-surface-hover rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
