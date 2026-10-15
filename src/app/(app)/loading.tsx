import { Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

/** Shown the instant a navigation starts, for every route in this segment.
 *
 *  Next prefetches this fallback, so clicking a nav link paints immediately
 *  instead of sitting on the old page until the server answers. Every route
 *  here is dynamic — auth plus per-user queries — so without it there is a
 *  few hundred milliseconds where nothing visibly happens and the app reads
 *  as unresponsive.
 *
 *  Deliberately generic: one fallback covering the whole segment stays
 *  correct as routes come and go, where per-route skeletons drift out of
 *  step with the pages they stand in for. */
export default function AppLoading() {
  return (
    <div className="animate-fade-in">
      <SkeletonHeader />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-5 h-9 w-32" />
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-1.5 h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading
      </span>
    </div>
  );
}
