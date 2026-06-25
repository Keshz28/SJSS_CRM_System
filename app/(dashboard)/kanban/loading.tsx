export default function Loading() {
  return (
    <div className="flex flex-col flex-1">
      <div className="sticky top-0 z-40 bg-dx-bg/95 border-b border-dx-line px-6 py-4">
        <div className="h-5 w-44 bg-dx-surface rounded-lg animate-pulse" />
        <div className="h-3 w-36 bg-dx-surface rounded-lg animate-pulse mt-2" />
      </div>
      <main className="flex-1 p-6 space-y-5">
        <div className="flex justify-end">
          <div className="h-10 w-36 bg-dx-surface rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, col) => (
            <div key={col} className="dx-card overflow-hidden">
              <div className="px-4 py-3 border-b border-dx-line flex items-center justify-between">
                <div className="h-4 w-20 bg-dx-surface-hover rounded animate-pulse" />
                <div className="h-5 w-6 rounded-full bg-dx-surface-hover animate-pulse" />
              </div>
              <div className="p-3 space-y-3">
                {[...Array(3)].map((_, card) => (
                  <div key={card} className="dx-card p-4 space-y-2.5">
                    <div className="h-3 w-24 bg-dx-surface-hover rounded animate-pulse" />
                    <div className="h-4 w-32 bg-dx-surface-hover rounded animate-pulse" />
                    <div className="flex justify-between pt-1">
                      <div className="h-4 w-20 bg-dx-surface-hover rounded animate-pulse" />
                      <div className="h-3 w-16 bg-dx-surface-hover rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
