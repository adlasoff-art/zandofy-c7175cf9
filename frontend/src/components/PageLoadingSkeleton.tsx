export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="h-14 bg-muted/40 animate-pulse" />
      {/* Content skeleton */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[3/4] bg-muted/40 rounded-lg animate-pulse" />
              <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-muted/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
