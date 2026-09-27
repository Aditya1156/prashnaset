import { ChevronRight, History as HistoryIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { TestSessionRow } from "@/lib/types";
import { formatDateTime, plural, scorePercent, scoreTone } from "@/lib/utils";

export const metadata: Metadata = { title: "History" };

const toneMap = { success: "success", warn: "warn", danger: "danger" } as const;

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: sessionData } = await supabase
    .from("test_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  const sessions = (sessionData ?? []) as TestSessionRow[];

  const unfinishedIds = sessions.filter((s) => !s.completed_at).map((s) => s.id);
  const answeredBySession = new Map<string, number>();
  if (unfinishedIds.length > 0) {
    const { data: attemptRows } = await supabase
      .from("attempts")
      .select("session_id")
      .in("session_id", unfinishedIds);
    for (const row of attemptRows ?? []) {
      const key = row.session_id as string;
      answeredBySession.set(key, (answeredBySession.get(key) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeader
        overline="Your progress"
        title="History"
        description="Every test you've taken — resume unfinished ones, review finished ones."
        actions={<ButtonLink href="/test/new">New test</ButtonLink>}
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No tests yet"
          body="Your scores land here after your first test — including unfinished ones you can resume."
          action={<ButtonLink href="/test/new">Build a test</ButtonLink>}
        />
      ) : (
        <>
        {(() => {
          const finished = sessions.filter((s) => s.completed_at !== null);
          if (finished.length < 2) return null;
          const scores = finished.map((s) => scorePercent(s.correct_count, s.question_count));
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          const best = Math.max(...scores);
          const latest = scores[0];
          const prev = scores[1];
          const delta = latest - prev;
          const totalQs = finished.reduce((sum, s) => sum + s.question_count, 0);
          const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
          const trendColor = delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted";
          return (
            <Card className="mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5">
              <div className="text-center">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Tests taken
                </p>
                <p className="mt-1 font-display text-2xl text-ink tabular-nums">{finished.length}</p>
                <p className="text-[11px] text-muted">{totalQs} {plural(totalQs, "question")} total</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Avg. score
                </p>
                <p className="mt-1 font-display text-2xl text-ink tabular-nums">{avg}%</p>
                <p className="text-[11px] text-muted">across all tests</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Best score
                </p>
                <p className="mt-1 font-display text-2xl text-success tabular-nums">{best}%</p>
                <p className="text-[11px] text-muted">personal record</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Trend
                </p>
                <p className={`mt-1 flex items-center justify-center gap-1 font-display text-2xl tabular-nums ${trendColor}`}>
                  <TrendIcon className="size-5" aria-hidden />
                  {delta > 0 ? "+" : ""}{delta}%
                </p>
                <p className="text-[11px] text-muted">vs. previous test</p>
              </div>
            </Card>
          );
        })()}
        <ul className="space-y-3" data-testid="history-list">
          {sessions.map((session) => {
            const isFinished = session.completed_at !== null;
            const percent = scorePercent(session.correct_count, session.question_count);
            const answered = answeredBySession.get(session.id) ?? 0;

            return (
              <li key={session.id}>
                <Link
                  href={isFinished ? `/history/${session.id}` : `/test/${session.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-4 transition-colors hover:border-accent-fill/50 sm:px-5"
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg text-ink">
                      {session.label ?? "Practice test"}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(session.started_at)} · {session.question_count}{" "}
                      {plural(session.question_count, "question")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isFinished ? (
                      <div className="text-right">
                        <Badge tone={toneMap[scoreTone(percent)]} className="text-sm">
                          {percent}%
                        </Badge>
                        <p className="mt-1 text-xs text-muted tabular-nums">
                          {session.correct_count}/{session.question_count} correct
                        </p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <Badge tone="accent">Resume</Badge>
                        <p className="mt-1 text-xs text-muted tabular-nums">
                          {answered}/{session.question_count} answered
                        </p>
                      </div>
                    )}
                    <ChevronRight className="size-5 text-faint" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </>
  );
}
