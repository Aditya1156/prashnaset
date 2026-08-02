import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileJson2,
  Library,
  Play,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getSessionProfile } from "@/lib/auth";
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
                  Import
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
              className="flex items-center justify-between gap-3 rounded-2xl border border-accent-fill/40 bg-accent-soft px-4 py-3.5 transition-colors hover:border-accent-fill sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  Resume “{inProgress.label ?? "Practice test"}”
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Started {formatDate(inProgress.started_at)} · {inProgress.question_count}{" "}
                  {plural(inProgress.question_count, "question")}
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-accent" aria-hidden />
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="stats">
            <StatCard
              label={isAdmin ? "Questions in bank" : "Questions available"}
              value={String(questionCount)}
            />
            <StatCard label="Sets" value={String(setCount)} />
            <StatCard label="Tests taken" value={String(testsTaken)} />
            <StatCard
              label="Average score"
              value={averageScore === null ? "—" : `${averageScore}%`}
              hint={averageScore === null ? "Take your first test" : undefined}
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-display text-lg text-ink">
                {isAdmin ? "Manage the library" : "Ready when you are"}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {questionCount} {plural(questionCount, "question")} across {setCount}{" "}
                {plural(setCount, "set")}
                {isAdmin
                  ? " — import more material or reorganise the folders."
                  : " — build a test from all of it or a slice."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href="/test/new">
                  <Play className="size-4" aria-hidden /> Build a test
                </ButtonLink>
                {isAdmin ? (
                  <ButtonLink href="/sets" variant="secondary">
                    <Library className="size-4" aria-hidden /> Manage library
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/sets" variant="secondary">
                    <Library className="size-4" aria-hidden /> Browse library
                  </ButtonLink>
                )}
              </div>
            </Card>

            {isAdmin ? (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-ink">Recent sets</h2>
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
                        className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-raised/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {set.title}
                          </span>
                          <span className="text-xs text-muted">
                            {formatDate(set.created_at)}
                          </span>
                        </span>
                        <Badge tone="accent" className="shrink-0">
                          {set.question_count}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-ink">Recent results</h2>
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
                            className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-raised/50"
                          >
                            <span className="min-w-0">
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
