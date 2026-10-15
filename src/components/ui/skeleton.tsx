import { cn } from "@/lib/utils";

/** Placeholder block for loading UI.
 *
 *  Shapes here should echo the real content's layout — a skeleton that sits
 *  in different places from what replaces it makes the swap feel like a jump
 *  rather than a load. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

/** The page heading every app route opens with. */
export function SkeletonHeader() {
  return (
    <div className="mb-6 sm:mb-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-64 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-6 w-32" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}
