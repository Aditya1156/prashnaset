"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EvaluationView {
  total: number;
  maxMarks: number;
  percent: number;
  band: string;
  evaluationId: string;
}

const BAND_LABEL: Record<string, string> = {
  POOR: "Poor",
  BELOW_AVG: "Below average",
  AVERAGE: "Average",
  GOOD: "Good",
  EXCELLENT: "Excellent",
};

function bandClasses(band: string) {
  if (band === "EXCELLENT" || band === "GOOD") return "border-success/40 bg-success-soft";
  if (band === "AVERAGE") return "border-warn/40 bg-warn-soft";
  return "border-danger/40 bg-danger-soft";
}

export function EvaluationReport({
  evaluation,
  mode,
  onRetry,
}: {
  evaluation: EvaluationView;
  mode: "study" | "test";
  onRetry: () => void;
}) {
  return (
    <Card className={cn("border p-5", bandClasses(evaluation.band))}>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
        Marked
      </p>
      <p className="mt-1 font-display text-4xl text-ink tabular-nums">
        {evaluation.total}
        <span className="text-xl text-muted">/{evaluation.maxMarks}</span>
      </p>
      <p className="mt-1 text-sm text-muted tabular-nums">
        {evaluation.percent}% · {BAND_LABEL[evaluation.band] ?? evaluation.band}
      </p>

      {mode === "study" && (
        <p className="mt-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          Study attempt — kept out of your tracked scores, because you read the model answer
          before writing.
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        An AI estimate at BPSC-style strictness. BPSC does not publish a rubric, so treat this as
        a direction of travel rather than a result. A serious answer typically lands between 40%
        and 55%.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/writing/report/${evaluation.evaluationId}`}>
          See the full report
        </ButtonLink>
        <Button variant="secondary" onClick={onRetry}>
          <RotateCcw className="size-4" aria-hidden /> Attempt again
        </Button>
        <Link
          href="/writing"
          className="inline-flex items-center px-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Back to questions
        </Link>
      </div>
    </Card>
  );
}
