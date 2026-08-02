import {
  ArrowRight,
  BookOpenCheck,
  BookOpenText,
  Calendar,
  ClipboardCheck,
  FileJson2,
  Library,
  NotebookPen,
  Play,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StreakCard, type StreakData } from "@/components/dashboard/streak-card";
import { MistakeDrillCard } from "@/components/test/mistake-drill-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getSessionProfile } from "@/lib/auth";
import { MISTAKE_WINDOW_DAYS } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import type { QuestionSetRow, TestSessionRow } from "@/lib/types";
import { formatDate, formatDateTime, plural, scorePercent, scoreTone } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const toneMap = { success: "success", warn: "warn", danger: "danger" } as const;

const adminOnboarding = [
  {
    icon: FileJson2,
    title: "Convert your material",
    body: "Turn notes into the JSON format with any tool — the format guide and a working example are on the import page.",
  },
  {
    icon: Upload,
    title: "Import into folders",
    body: "Each file becomes a set. File sets into colour-coded subject folders as you go.",
  },
  {
    icon: ClipboardCheck,
    title: "Learners practice instantly",
    body: "Everything you publish is immediately testable by every account.",
  },
];

function DateTile({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-navy leading-none text-on-navy"
    >
      <span className="text-[9px] font-semibold tracking-[0.12em] text-on-navy-muted uppercase">
        {date.toLocaleString("en", { month: "short" })}
      </span>
      <span className="mt-0.5 font-display text-base tabular-nums">{date.getDate()}</span>
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");
  const { isAdmin, displayName } = session;

  const [questionCountRes, setCountRes, recentSetsRes, completedRes, inProgressRes, recentSessionsRes] =
    await Promise.all([
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase.from("question_sets").select("id", { count: "exact", head: true }),
      supabase
        .from("question_sets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("test_sessions")
        .select("question_count, correct_count")
        .not("completed_at", "is", null),
      supabase
        .from("test_sessions")
        .select("id, label, question_count, started_at")
        .is("completed_at", null)
        .order("started_at", { ascending: false })
        .limit(1),
      supabase
        .from("test_sessions")
        .select("*")
        .not("completed_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(3),
    ]);

  const questionCount = questionCountRes.count ?? 0;
  const setCount = setCountRes.count ?? 0;
  const recentSets = (recentSetsRes.data ?? []) as QuestionSetRow[];
  const completed = completedRes.data ?? [];
  const testsTaken = completed.length;
  const averageScore =
    testsTaken > 0
      ? Math.round(
          completed.reduce(
            (sum, s) => sum + scorePercent(s.correct_count, s.question_count),
            0,
          ) / testsTaken,
        )
      : null;
  const inProgress = (inProgressRes.data?.[0] ?? null) as Pick<
    TestSessionRow,
    "id" | "label" | "question_count" | "started_at"
  > | null;
  const recentSessions = (recentSessionsRes.data ?? []) as TestSessionRow[];

  const [{ data: streakRows }, { data: mistakeRows }] = await Promise.all([
    supabase.rpc("my_streak"),
    supabase.rpc("my_mistake_questions", { days: MISTAKE_WINDOW_DAYS, max_count: 200 }),
  ]);
  const streakRow = (Array.isArray(streakRows) ? streakRows[0] : streakRows) as
    | { current_streak: number; longest_streak: number; active_days: number; tested_today: boolean }
    | undefined;
  const streak: StreakData = {
    current: streakRow?.current_streak ?? 0,
    longest: streakRow?.longest_streak ?? 0,
    activeDays: streakRow?.active_days ?? 0,
    testedToday: streakRow?.tested_today ?? false,
  };
  const mistakeCount = Array.isArray(mistakeRows) ? mistakeRows.length : 0;

  let remaining = 0;
  if (inProgress) {
    const { count: answered } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("session_id", inProgress.id);
    remaining = Math.max(0, inProgress.question_count - (answered ?? 0));
  }

  const bankEmpty = questionCount === 0;

  return (
    <>
      <PageHeader
        title={`Namaste, ${displayName}`}
        description={
          isAdmin
            ? "You curate the library — every learner tests on what you publish."
            : "Practice from the shared library. Every number below is computed from your own attempts."
        }
        actions={
          !bankEmpty ? (
            <>
              <ButtonLink href="/test/new">
                <Play className="size-4" aria-hidden /> Take a test
              </ButtonLink>
              {isAdmin && (
                <ButtonLink href="/import" variant="secondary">
                  <Upload className="size-4" aria-hidden /> Import
                </ButtonLink>
              )}
            </>
          ) : undefined
        }
      />

      {bankEmpty ? (
        isAdmin ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {adminOnboarding.map((step, index) => (
                <Card key={step.title} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink">
                      <step.icon className="size-5" aria-hidden />
                    </div>
                    <span className="font-display text-sm text-faint">0{index + 1}</span>
                  </div>
                  <h2 className="mt-4 font-display text-lg text-ink">{step.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/import" size="lg">
                <Upload className="size-4" aria-hidden /> Import your first file
              </ButtonLink>
              <ButtonLink
                href="/question-import-example.json"
                variant="secondary"
                size="lg"
                download
              >
                Download the example JSON
              </ButtonLink>
            </div>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <BookOpenCheck className="mx-auto size-8 text-accent" aria-hidden />
            <h2 className="mt-4 font-display text-xl text-ink">The library is being prepared</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              No question sets have been published yet. As soon as the admin imports them,
              you can start testing here.
            </p>
          </Card>
        )
      ) : (
        <div className="space-y-6">
          {inProgress && (
            <Link
              href={`/test/${inProgress.id}`}
              className="group flex items-center gap-4 rounded-3xl bg-navy px-5 py-5 shadow-md transition-colors hover:bg-navy-raised sm:px-6"
            >
              <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-navy-raised text-on-navy-muted transition-colors group-hover:bg-navy sm:flex">
                <NotebookPen className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold tracking-[0.2em] text-on-navy-muted uppercase">
                  Continue where you left off
                </span>
                <span className="mt-1 block truncate text-base font-medium text-on-navy sm:text-lg">
                  {inProgress.label ?? "Practice test"}
                </span>
                <span className="mt-0.5 block text-xs text-on-navy-muted">
                  Started {formatDate(inProgress.started_at)} · {remaining}{" "}
                  {plural(remaining, "question")} remaining
                </span>
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-on-navy-muted/40 text-on-navy transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="stats">
            <StatCard
              label={isAdmin ? "Questions in bank" : "Questions available"}
              value={String(questionCount)}
            />
            <StatCard label="Tests taken" value={String(testsTaken)} />
            <StreakCard streak={streak} />
            <StatCard
              inverted
              label="Average score"
              value={averageScore === null ? "—%" : `${averageScore}%`}
              hint={averageScore === null ? "Take your first test to see analytics" : undefined}
            />
          </div>

          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <MistakeDrillCard mistakeCount={mistakeCount} days={MISTAKE_WINDOW_DAYS} />
            <Card className="flex flex-col justify-between p-5">
              <div>
                <h2 className="font-display text-lg text-ink">Assigned tests</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {isAdmin
                    ? "Set the same paper for every learner — timed, due-dated, and tracked."
                    : "Papers your admin has set for you, with a countdown and exam-style panel."}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href="/assignments" variant="secondary">
                  {isAdmin ? "Manage assignments" : "View assigned tests"}
                </ButtonLink>
                <ButtonLink href="/leaderboard" variant="ghost">
                  Leaderboard
                </ButtonLink>
              </div>
            </Card>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="flex items-center gap-5 border-transparent bg-accent-soft/70 p-6">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl text-ink">
                  {isAdmin ? "Manage the library" : "Ready when you are"}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {questionCount} {plural(questionCount, "question")} across {setCount}{" "}
                  {plural(setCount, "set")}
                  {isAdmin
                    ? " — import more material or reorganise your collections into folders."
                    : " — build a test from all of it or a slice."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href="/test/new">
                    <Play className="size-4" aria-hidden /> Build a test
                  </ButtonLink>
                  <ButtonLink href="/sets" variant="secondary">
                    <Library className="size-4" aria-hidden />
                    {isAdmin ? "Manage library" : "Browse library"}
                  </ButtonLink>
                </div>
              </div>
              <span
                aria-hidden
                className="hidden size-28 shrink-0 items-center justify-center rounded-full bg-surface/70 text-faint sm:flex"
              >
                <BookOpenText className="size-12" />
              </span>
            </Card>

            {isAdmin ? (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl text-ink">Recent sets</h2>
                  <Link
                    href="/sets"
                    className="text-sm text-accent underline-offset-4 hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <ul className="mt-3 divide-y divide-line">
                  {recentSets.map((set) => (
                    <li key={set.id}>
                      <Link
                        href={`/sets/${set.id}`}
                        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-raised/50"
                      >
                        <DateTile iso={set.created_at} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {set.title}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Calendar className="size-3" aria-hidden />
                            {formatDate(set.created_at)}
                          </span>
                        </span>
                        <Badge tone="accent" className="shrink-0 tabular-nums">
                          {set.question_count} qs
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl text-ink">Recent results</h2>
                  <Link
                    href="/history"
                    className="text-sm text-accent underline-offset-4 hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {recentSessions.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    Your scores land here after your first test.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {recentSessions.map((s) => {
                      const percent = scorePercent(s.correct_count, s.question_count);
                      return (
                        <li key={s.id}>
                          <Link
                            href={`/history/${s.id}`}
                            className="flex items-center gap-3 py-2.5 transition-colors hover:bg-raised/50"
                          >
                            <DateTile iso={s.started_at} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">
                                {s.label ?? "Practice test"}
                              </span>
                              <span className="text-xs text-muted">
                                {formatDateTime(s.started_at)}
                              </span>
                            </span>
                            <Badge tone={toneMap[scoreTone(percent)]} className="shrink-0">
                              {percent}%
                            </Badge>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
