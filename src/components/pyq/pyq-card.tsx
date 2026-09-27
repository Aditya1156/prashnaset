"use client";

import { Calendar, Clock3, Play } from "lucide-react";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createPyqSession } from "@/lib/actions/pyq";
import { BPSC_NEGATIVE_MARKING } from "@/lib/scoring";
import { plural } from "@/lib/utils";

interface PyqCardProps {
  examYear: number;
  examName: string;
  questionCount: number;
  topics: string[];
}

const MINUTES_PER_QUESTION = 0.8;

export function PyqCard({ examYear, examName, questionCount, topics }: PyqCardProps) {
  const [starting, setStarting] = useState(false);
  const [timed, setTimed] = useState(true);
  const [negative, setNegative] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const estimatedMinutes = Math.max(1, Math.ceil(questionCount * MINUTES_PER_QUESTION));

  async function onStart() {
    setError(null);
    setStarting(true);
    const result = await createPyqSession({
      examYear,
      examName,
      durationMinutes: timed ? estimatedMinutes : null,
      negativeMarking: negative ? BPSC_NEGATIVE_MARKING : 0,
    });
    setStarting(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-on-navy">
          <Calendar className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg text-ink">{examName}</h3>
          <p className="text-sm font-medium text-accent tabular-nums">{examYear}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="tabular-nums font-medium text-ink">
          {questionCount} {plural(questionCount, "question")}
        </span>
        <span aria-hidden>·</span>
        <span className="flex items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden />
          ≈ {estimatedMinutes} min
        </span>
      </div>

      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {topics.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-muted"
            >
              {t}
            </span>
          ))}
          {topics.length > 5 && (
            <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-faint">
              +{topics.length - 5} more
            </span>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-line pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
            className="size-3.5 accent-[#4f46e5]"
          />
          <span className="text-muted">
            Timed (<span className="tabular-nums">{estimatedMinutes} min</span>)
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={negative}
            onChange={(e) => setNegative(e.target.checked)}
            className="size-3.5 accent-[#4f46e5]"
          />
          <span className="text-muted">Negative marking (1/3)</span>
        </label>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <Button
        className="mt-4 w-full"
        loading={starting}
        onClick={() => void onStart()}
      >
        <Play className="size-4" aria-hidden />
        Start mock
      </Button>
    </Card>
  );
}
