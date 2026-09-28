"use client";

import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createReviewSession } from "@/lib/actions/sessions";
import { cn, plural } from "@/lib/utils";

/** Spaced repetition entry point. Every graded answer moves the question up or
 *  down a Leitner box; this card surfaces the ones the schedule says are due
 *  today, which is the whole point of the schedule. */
export function ReviewDueCard({
  dueCount,
  trackedCount,
  className,
}: {
  dueCount: number;
  trackedCount: number;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const none = dueCount === 0;
  const batch = Math.min(dueCount, 25);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await createReviewSession(batch);
    // Success redirects into the runner and never returns.
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <Card className={cn("flex flex-col justify-between p-5", !none && "border-accent/20 bg-accent-soft/20", className)} data-testid="review-due">
      <div>
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            none ? "bg-raised text-muted" : "bg-accent-fill text-on-accent",
          )}
        >
          <CalendarClock className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-lg text-ink">Due for review</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {trackedCount === 0 ? (
            <>
              Answer some questions and they enter a spaced schedule — you will be shown
              each one again just before you would have forgotten it.
            </>
          ) : none ? (
            <>
              Nothing due today. {trackedCount} {plural(trackedCount, "question")} are in
              your schedule and will resurface on their own.
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">{dueCount}</span>{" "}
              {plural(dueCount, "question")} scheduled for today, out of {trackedCount}{" "}
              you are tracking.
            </>
          )}
        </p>
      </div>
      {!none && (
        <div className="mt-4">
          <Button onClick={() => void start()} loading={busy}>
            Review {batch} {plural(batch, "question")}
          </Button>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </Card>
  );
}
