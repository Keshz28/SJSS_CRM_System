export default function Loading() {
  return (
    <div className="flex flex-col flex-1">
      <div className="sticky top-0 z-40 bg-dx-bg/95 border-b border-dx-line px-6 py-4">
        <div className="h-5 w-48 bg-dx-surface rounded-lg animate-pulse" />
        <div className="h-3 w-32 bg-dx-surface rounded-lg animate-pulse mt-2" />
      </div>
      <main className="flex-1 p-4 sm:p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="dx-card p-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-dx-surface-hover animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-dx-surface-hover rounded animate-pulse" />
                <div className="h-6 w-14 bg-dx-surface-hover rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="dx-card p-5 lg:col-span-2">
            <div className="h-4 w-40 bg-dx-surface-hover rounded animate-pulse mb-5" />
            <div className="h-[220px] bg-dx-surface-hover rounded-xl animate-pulse" />
          </div>
          <div className="dx-card p-5">
            <div className="h-4 w-36 bg-dx-surface-hover rounded animate-pulse mb-5" />
            <div className="h-[220px] bg-dx-surface-hover rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="dx-card p-5">
          <div className="h-4 w-40 bg-dx-surface-hover rounded animate-pulse mb-5" />
          <div className="h-[160px] bg-dx-surface-hover rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}
