/**
 * Global loading skeleton for the (app) layout.
 * Shows a shimmer layout that roughly matches the dashboard structure
 * so users see structure instead of a blank void during SSR loads.
 */
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div>
        <div className="h-7 w-48 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-64 rounded-lg bg-white/[0.04] mt-2" />
      </div>

      {/* Status cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08]" />
              <div className="h-3 w-16 rounded bg-white/[0.06]" />
            </div>
            <div className="h-7 w-20 rounded-lg bg-white/[0.06]" />
            <div className="h-3 w-28 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="h-5 w-28 rounded bg-white/[0.06]" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-white/[0.06]" />
            <div className="h-20 w-full rounded-lg bg-white/[0.04]" />
          </div>
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="h-4 w-20 rounded bg-white/[0.06]" />
            <div className="h-16 w-full rounded-lg bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  )
}
