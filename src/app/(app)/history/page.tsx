import { ChevronRight, History as HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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
        <ul className="space-y-3" data-testid="history-list">
          {sessions.map((session) => {
            const finished = session.completed_at !== null;
            const percent = scorePercent(session.correct_count, session.question_count);
            const answered = answeredBySession.get(session.id) ?? 0;

            return (
              <li key={session.id}>
                <Link
                  href={finished ? `/history/${session.id}` : `/test/${session.id}`}
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
                    {finished ? (
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
      )}
    </>
  );
}
