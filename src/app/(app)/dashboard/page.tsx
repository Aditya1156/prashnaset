import { ArrowRight, ClipboardCheck, FileJson2, Play, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import type { QuestionSetRow, TestSessionRow } from "@/lib/types";
import { formatDate, plural, scorePercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const onboardingSteps = [
  {
    icon: FileJson2,
    title: "Convert your notes",
    body: "Turn notes into a JSON file with any tool — the format guide and example are on the import page.",
  },
  {
    icon: Upload,
    title: "Import the file",
    body: "Drop it once. You'll see exactly what landed and what was skipped, with reasons.",
  },
  {
    icon: ClipboardCheck,
    title: "Take a test tonight",
    body: "Build a test from your sets, get a score, and retake the weak ones.",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, questionCountRes, setsRes, completedRes, inProgressRes] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
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
    ]);

  const displayName = profileRes.data?.display_name?.trim() || null;
  const questionCount = questionCountRes.count ?? 0;
  const recentSets = (setsRes.data ?? []) as QuestionSetRow[];
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

  const { count: totalSetsCount } = await supabase
    .from("question_sets")
    .select("id", { count: "exact", head: true });

  const firstRun = questionCount === 0;

  return (
    <>
      <PageHeader
        title={displayName ? `Namaste, ${displayName}` : "Dashboard"}
        description={
          firstRun
            ? "Three steps between you and your first test."
            : "Everything below is computed from your own questions and attempts."
        }
        actions={
          !firstRun ? (
            <>
              <ButtonLink href="/test/new">
                <Play className="size-4" aria-hidden /> Take a test
              </ButtonLink>
              <ButtonLink href="/import" variant="secondary">
                Import
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      {firstRun ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {onboardingSteps.map((step, index) => (
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
            <ButtonLink href="/question-import-example.json" variant="secondary" size="lg" download>
              Download the example JSON
            </ButtonLink>
          </div>
        </div>
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
            <StatCard label="Questions" value={String(questionCount)} />
            <StatCard label="Sets" value={String(totalSetsCount ?? 0)} />
            <StatCard label="Tests taken" value={String(testsTaken)} />
            <StatCard
              label="Average score"
              value={averageScore === null ? "—" : `${averageScore}%`}
              hint={averageScore === null ? "Take your first test" : undefined}
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
            <Card className="p-5">
              <h2 className="font-display text-lg text-ink">Ready when you are</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {questionCount} {plural(questionCount, "question")} across {totalSetsCount ?? 0}{" "}
                {plural(totalSetsCount ?? 0, "set")} — build a test from all of them or a slice.
              </p>
              <ButtonLink href="/test/new" className="mt-4">
                <Play className="size-4" aria-hidden /> Build a test
              </ButtonLink>
            </Card>

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
          </div>
        </div>
      )}
    </>
  );
}
