"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { setDailyTarget } from "@/lib/actions/study";
import { cn, plural } from "@/lib/utils";

const CHOICES = [10, 20, 30, 50, 100];

/** A daily question goal. Consistency beats intensity over a two-year exam
 *  cycle, so the target is a small number the learner sets themselves. */
export function DailyTargetCard({
  answeredToday,
  target,
}: {
  answeredToday: number;
  target: number;
}) {
  const [current, setCurrent] = useState(target);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const met = current > 0 && answeredToday >= current;

  async function choose(value: number) {
    const next = value === current ? 0 : value;
    setBusy(value);
    setError(null);
    const previous = current;
    setCurrent(next);
    const result = await setDailyTarget(next);
    setBusy(null);
    if (!result.ok) {
      setCurrent(previous);
      setError(result.error ?? "Couldn't save that target.");
    }
  }

  return (
    <Card className={cn("p-5", met && "border-success/30 bg-success-soft/30")} data-testid="daily-target">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink">
            <Flag className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-lg text-ink">Today&apos;s target</h2>
        </div>
        <span className={cn("font-display text-3xl tabular-nums sm:text-4xl", met ? "text-success" : "text-ink")}>
          {answeredToday}
          {current > 0 && <span className="text-lg text-faint">/{current}</span>}
        </span>
      </div>

      {current > 0 ? (
        <>
          <Progress
            value={Math.min(answeredToday, current)}
            max={current}
            className="mt-4"
            label="Daily target progress"
            tone={met ? "success" : "accent"}
          />
          <p className="mt-2 text-sm text-muted">
            {met
              ? "Target met for today. Anything more is a bonus."
              : `${current - answeredToday} ${plural(current - answeredToday, "question")} to go.`}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          No target set. Pick one you can hit on a bad day — a streak you keep beats a
          number you abandon.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {CHOICES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={busy !== null}
            onClick={() => void choose(value)}
            aria-pressed={current === value}
            className={cn(
              "rounded-full border px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-60",
              current === value
                ? "border-transparent bg-accent-fill text-on-accent shadow-sm ring-2 ring-accent-fill/30 ring-offset-2 ring-offset-surface"
                : "border-line bg-raised/60 text-ink hover:bg-raised hover:border-line-strong",
            )}
          >
            {value}/day
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}
