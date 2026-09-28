"use client";

import { Clock3, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaletteStatus = "answered" | "marked" | "answered-marked" | "unanswered";

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function paletteStatus(answered: boolean, marked: boolean): PaletteStatus {
  if (answered && marked) return "answered-marked";
  if (answered) return "answered";
  if (marked) return "marked";
  return "unanswered";
}

const statusStyles: Record<PaletteStatus, string> = {
  answered: "bg-success text-white border-success",
  "answered-marked": "bg-success text-white border-warn ring-2 ring-warn/60",
  marked: "bg-warn text-white border-warn",
  unanswered: "bg-surface text-muted border-line-strong",
};

const legend: { status: PaletteStatus; label: string }[] = [
  { status: "answered", label: "Answered" },
  { status: "marked", label: "Marked for review" },
  { status: "answered-marked", label: "Answered & marked" },
  { status: "unanswered", label: "Not answered" },
];

export function ExamClock({
  secondsLeft,
  className,
}: {
  secondsLeft: number;
  className?: string;
}) {
  const critical = secondsLeft <= 60;
  const low = secondsLeft <= 300;
  return (
    <div
      role="timer"
      aria-live={critical ? "assertive" : "off"}
      aria-label="Time remaining"
      data-testid="exam-clock"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium tabular-nums transition-colors",
        critical
          ? "bg-danger text-on-danger animate-pulse"
          : low
            ? "bg-warn-soft text-warn shadow-md"
            : "bg-navy text-on-navy shadow-md",
        className,
      )}
    >
      <Clock3 className="size-4" aria-hidden />
      {formatClock(secondsLeft)}
    </div>
  );
}

interface QuestionPaletteProps {
  total: number;
  current: number;
  answeredIds: boolean[];
  markedIds: boolean[];
  onJump: (index: number) => void;
}

export function QuestionPalette({
  total,
  current,
  answeredIds,
  markedIds,
  onJump,
}: QuestionPaletteProps) {
  const answeredCount = answeredIds.filter(Boolean).length;
  const markedCount = markedIds.filter(Boolean).length;

  const remainingCount = total - answeredCount;

  return (
    <div data-testid="question-palette">
      {/* On phones the collapsible toggle already carries this heading. */}
      <div className="hidden items-baseline justify-between gap-2 lg:flex">
        <h2 className="font-display text-lg text-ink">Questions</h2>
        <span className="text-xs text-muted tabular-nums">
          {answeredCount}/{total}
        </span>
      </div>

      <div className="mt-3 mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-success-soft p-2.5">
          <p className="font-display text-xl text-success tabular-nums">{answeredCount}</p>
          <p className="text-[10px] font-medium tracking-wide text-success/70 uppercase">Done</p>
        </div>
        <div className="rounded-xl bg-warn-soft p-2.5">
          <p className="font-display text-xl text-warn tabular-nums">{markedCount}</p>
          <p className="text-[10px] font-medium tracking-wide text-warn/70 uppercase">Review</p>
        </div>
        <div className="rounded-xl bg-raised p-2.5">
          <p className="font-display text-xl text-muted tabular-nums">{remainingCount}</p>
          <p className="text-[10px] font-medium tracking-wide text-faint uppercase">Left</p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {Array.from({ length: total }, (_, index) => {
          const status = paletteStatus(answeredIds[index] ?? false, markedIds[index] ?? false);
          const isCurrent = index === current;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-label={`Question ${index + 1}, ${status.replace("-", " and ")}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex size-10 items-center justify-center rounded-xl border text-sm font-medium transition-transform hover:scale-105",
                statusStyles[status],
                isCurrent && "ring-2 ring-accent-fill ring-offset-2 ring-offset-surface scale-110",
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
        {legend.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2 text-xs text-muted">
            <span className={cn("size-4 rounded-md border", statusStyles[entry.status])} />
            {entry.label}
          </li>
        ))}
      </ul>

      {markedCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-warn">
          <Flag className="size-3.5" aria-hidden />
          {markedCount} marked to revisit
        </p>
      )}
    </div>
  );
}
