import { Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, plural } from "@/lib/utils";

export interface StreakData {
  current: number;
  longest: number;
  activeDays: number;
  testedToday: boolean;
}

/** Habit signal, computed from real completed tests only — a day counts when
 *  a test was actually finished that day. */
export function StreakCard({ streak }: { streak: StreakData }) {
  const alive = streak.current > 0;
  return (
    <Card className={cn("p-4 sm:p-5", alive && "border-warn/30 bg-gradient-to-br from-warn-soft/50 to-surface")} data-testid="streak-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            Streak
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-4xl text-ink tabular-nums sm:text-5xl">
              {streak.current}
            </span>
            <span className="text-sm text-muted">{plural(streak.current, "day")}</span>
            {streak.testedToday && <span className="size-2.5 rounded-full bg-success" aria-label="Active today" />}
          </p>
        </div>
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl",
            alive ? "bg-warn-soft text-warn" : "bg-raised text-faint",
          )}
        >
          <Flame className="size-6" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {streak.testedToday ? (
          <>Today is counted — come back tomorrow to keep it going.</>
        ) : alive ? (
          <>Finish one test today to extend it.</>
        ) : streak.activeDays > 0 ? (
          <>Longest was {streak.longest} {plural(streak.longest, "day")}. Start a new one today.</>
        ) : (
          <>Finish your first test to start a streak.</>
        )}
      </p>
    </Card>
  );
}
