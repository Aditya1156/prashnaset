"use client";

import { BarChart3, ChevronDown, Target, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Difficulty, QuestionType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export interface TopicStat {
  topic: string;
  total: number;
  correct: number;
}

export interface DifficultyStat {
  difficulty: Difficulty;
  total: number;
  correct: number;
}

export interface TypeStat {
  type: QuestionType;
  total: number;
  correct: number;
}

interface SessionAnalyticsProps {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  topicStats: TopicStat[];
  difficultyStats: DifficultyStat[];
  typeStats: TypeStat[];
  durationSeconds: number | null;
  negativeMarking: number;
}

function toneFor(pct: number): BadgeTone {
  if (pct >= 75) return "success";
  if (pct >= 50) return "warn";
  return "danger";
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const DIFFICULTY_DOTS: Record<Difficulty, string> = {
  easy: "bg-success",
  medium: "bg-warn",
  hard: "bg-danger",
};

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "MCQ",
  msq: "MSQ",
  match: "Match",
};

function pct(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function BreakdownBar({
  label,
  correct,
  total,
  dot,
}: {
  label: string;
  correct: number;
  total: number;
  dot?: string;
}) {
  const accuracy = pct(correct, total);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-ink">
          {dot && <span className={cn("size-2 rounded-full", dot)} aria-hidden />}
          {label}
        </span>
        <span className="text-xs text-muted tabular-nums">
          {correct}/{total} · <Badge tone={toneFor(accuracy)}>{accuracy}%</Badge>
        </span>
      </div>
      <Progress value={correct} max={total} label={`${label} accuracy`} />
    </div>
  );
}

export function SessionAnalytics({
  totalQuestions,
  correctCount,
  wrongCount,
  skippedCount,
  topicStats,
  difficultyStats,
  typeStats,
  durationSeconds,
  negativeMarking,
}: SessionAnalyticsProps) {
  const [showTopics, setShowTopics] = useState(topicStats.length <= 6);
  const overallPct = pct(correctCount, totalQuestions);
  const sortedTopics = [...topicStats].sort(
    (a, b) => pct(a.correct, a.total) - pct(b.correct, b.total),
  );
  const visibleTopics = showTopics ? sortedTopics : sortedTopics.slice(0, 5);
  const weakTopics = sortedTopics.filter((t) => pct(t.correct, t.total) < 50);
  const strongTopics = sortedTopics.filter((t) => pct(t.correct, t.total) >= 75);

  const penalty =
    negativeMarking > 0 ? Math.round(wrongCount * negativeMarking * 100) / 100 : 0;
  const netScore = Math.max(0, Math.round((correctCount - penalty) * 100) / 100);

  const avgTimePerQuestion =
    durationSeconds && durationSeconds > 0
      ? Math.round(durationSeconds / totalQuestions)
      : null;

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 text-center hover:shadow-sm transition-shadow">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-accent-soft">
            <Target className="size-5 text-accent" aria-hidden />
          </div>
          <p className="mt-2 font-display text-2xl text-ink tabular-nums">{overallPct}%</p>
          <p className="text-[11px] text-muted">Accuracy</p>
        </Card>
        <Card className="p-4 text-center hover:shadow-sm transition-shadow">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-success-soft">
            <Zap className="size-5 text-success" aria-hidden />
          </div>
          <p className="mt-2 font-display text-2xl text-ink tabular-nums">{correctCount}</p>
          <p className="text-[11px] text-muted">Correct</p>
        </Card>
        <Card className="p-4 text-center hover:shadow-sm transition-shadow">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-danger-soft">
            <BarChart3 className="size-5 text-danger" aria-hidden />
          </div>
          <p className="mt-2 font-display text-2xl text-ink tabular-nums">{wrongCount}</p>
          <p className="text-[11px] text-muted">Wrong</p>
        </Card>
        <Card className="p-4 text-center hover:shadow-sm transition-shadow">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-raised">
            <TrendingUp className="size-5 text-muted" aria-hidden />
          </div>
          <p className="mt-2 font-display text-2xl text-ink tabular-nums">
            {avgTimePerQuestion ? `${avgTimePerQuestion}s` : `${skippedCount}`}
          </p>
          <p className="text-[11px] text-muted">
            {avgTimePerQuestion ? "Avg. per Q" : "Skipped"}
          </p>
        </Card>
      </div>

      {negativeMarking > 0 && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-muted">
            Negative marking ({Math.round(negativeMarking * 100)}% per wrong answer)
          </span>
          <span className="text-sm font-medium text-ink tabular-nums">
            <span className="text-danger">−{penalty}</span> penalty → Net{" "}
            <span className={cn(toneFor(pct(Math.round(netScore), totalQuestions)) === "danger" ? "text-danger" : toneFor(pct(Math.round(netScore), totalQuestions)) === "success" ? "text-success" : "text-warn")}>
              {netScore}/{totalQuestions}
            </span>
          </span>
        </Card>
      )}

      {(weakTopics.length > 0 || strongTopics.length > 0) && (
        <Card className="px-4 py-3">
          {weakTopics.length > 0 && (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block size-2 rounded-full bg-danger align-middle" aria-hidden />
              <span className="font-medium">Needs work:</span>{" "}
              {weakTopics.map((t) => t.topic).join(", ")}
            </p>
          )}
          {strongTopics.length > 0 && (
            <p className={cn("text-sm text-ink", weakTopics.length > 0 && "mt-2")}>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-success align-middle" aria-hidden />
              <span className="font-medium">Strong:</span>{" "}
              {strongTopics.map((t) => t.topic).join(", ")}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {topicStats.length > 0 && (
          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 font-display text-base text-ink">Topic breakdown</h3>
            <div className="space-y-3">
              {visibleTopics.map((t) => (
                <BreakdownBar key={t.topic} label={t.topic} correct={t.correct} total={t.total} />
              ))}
            </div>
            {!showTopics && sortedTopics.length > 5 && (
              <button
                type="button"
                onClick={() => setShowTopics(true)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <ChevronDown className="size-3.5" aria-hidden />
                Show all {sortedTopics.length} {plural(sortedTopics.length, "topic")}
              </button>
            )}
          </Card>
        )}

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 font-display text-base text-ink">By difficulty</h3>
            <div className="space-y-3">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                const stat = difficultyStats.find((s) => s.difficulty === d);
                if (!stat || stat.total === 0) return null;
                return (
                  <BreakdownBar
                    key={d}
                    label={DIFFICULTY_LABELS[d]}
                    correct={stat.correct}
                    total={stat.total}
                    dot={DIFFICULTY_DOTS[d]}
                  />
                );
              })}
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 font-display text-base text-ink">By type</h3>
            <div className="space-y-3">
              {(["mcq", "msq", "match"] as QuestionType[]).map((t) => {
                const stat = typeStats.find((s) => s.type === t);
                if (!stat || stat.total === 0) return null;
                return (
                  <BreakdownBar
                    key={t}
                    label={TYPE_LABELS[t]}
                    correct={stat.correct}
                    total={stat.total}
                  />
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
