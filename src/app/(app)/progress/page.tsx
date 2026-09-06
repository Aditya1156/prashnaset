import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookmarkList, type BookmarkItem } from "@/components/study/bookmark-list";
import { DailyTargetCard } from "@/components/study/daily-target-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/server";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };

interface TopicRow {
  topic: string;
  answered: number;
  correct: number;
  accuracy: number | null;
}

function toneFor(accuracy: number): BadgeTone {
  if (accuracy >= 75) return "success";
  if (accuracy >= 50) return "warn";
  return "danger";
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Local midnight, so "today" means the learner's day rather than UTC's.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [topicRes, profileRes, todayRes, bookmarkRes] = await Promise.all([
    supabase.rpc("my_topic_accuracy", { days: 0 }),
    supabase.from("profiles").select("daily_target").eq("id", user.id).single(),
    supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString()),
    supabase
      .from("question_notes")
      .select("question_id, note, questions ( stem, question_sets ( title ) )")
      .eq("bookmarked", true)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const topics = ((topicRes.data ?? []) as TopicRow[]).filter((row) => row.answered > 0);
  const dailyTarget = (profileRes.data?.daily_target as number | undefined) ?? 0;
  const answeredToday = todayRes.count ?? 0;

  const bookmarks: BookmarkItem[] = (
    (bookmarkRes.data ?? []) as unknown as {
      question_id: string;
      note: string | null;
      questions: { stem: string; question_sets: { title: string } | null } | null;
    }[]
  )
    .filter((row) => row.questions !== null)
    .map((row) => ({
      questionId: row.question_id,
      stem: row.questions!.stem,
      setTitle: row.questions!.question_sets?.title ?? null,
      note: row.note ?? "",
    }));

  const totalAnswered = topics.reduce((sum, t) => sum + t.answered, 0);
  const totalCorrect = topics.reduce((sum, t) => sum + t.correct, 0);
  const weakest = topics.filter((t) => (t.accuracy ?? 100) < 60).slice(0, 3);
  const untaggedOnly = topics.length === 1 && topics[0].topic === "Untagged";

  return (
    <>
      <PageHeader
        overline="Your progress"
        title="Where you stand"
        description="Every figure here is computed from your own most recent answer to each question — re-drilling something you have since learned lifts the number, as it should."
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <DailyTargetCard answeredToday={answeredToday} target={dailyTarget} />
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Overall accuracy</h2>
          {totalAnswered === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Nothing answered yet. Take a test and this fills in on its own.
            </p>
          ) : (
            <>
              <p className="mt-3 font-display text-4xl text-ink tabular-nums">
                {Math.round((100 * totalCorrect) / totalAnswered)}%
              </p>
              <Progress
                value={totalCorrect}
                max={totalAnswered}
                className="mt-3"
                label="Overall accuracy"
              />
              <p className="mt-2 text-sm text-muted">
                {totalCorrect} of {totalAnswered} distinct {plural(totalAnswered, "question")}{" "}
                answered correctly on your latest attempt.
              </p>
            </>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Topic breakdown</h2>
        <p className="mt-1 text-sm text-muted">Weakest first — that is where revision pays.</p>

        {topics.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Compass}
            title="No topic data yet"
            body="Answer some questions and your accuracy per topic appears here."
            action={<ButtonLink href="/test/new">Take a test</ButtonLink>}
          />
        ) : (
          <>
            {untaggedOnly && (
              <p className="mt-4 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm text-muted">
                None of the questions you have answered carry a topic tag yet, so they are
                grouped as Untagged. Once the library is tagged this breaks down by subject.
              </p>
            )}
            {weakest.length > 0 && !untaggedOnly && (
              <p className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-ink">
                Weakest right now:{" "}
                <span className="font-semibold">{weakest.map((t) => t.topic).join(", ")}</span>.
                Drill these before anything you are already good at.
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-[0.14em] text-faint uppercase">
                    <th className="px-4 pb-1 font-semibold">Topic</th>
                    <th className="px-4 pb-1 font-semibold">Answered</th>
                    <th className="px-4 pb-1 font-semibold">Correct</th>
                    <th className="px-4 pb-1 font-semibold">Accuracy</th>
                  </tr>
                </thead>
                <tbody data-testid="topic-table">
                  {topics.map((row) => {
                    const accuracy = Math.round(row.accuracy ?? 0);
                    return (
                      <tr key={row.topic} className="bg-surface">
                        <td className="rounded-l-xl border-y border-l border-line px-4 py-3 font-medium text-ink">
                          {row.topic}
                        </td>
                        <td className="border-y border-line px-4 py-3 text-muted tabular-nums">
                          {row.answered}
                        </td>
                        <td className="border-y border-line px-4 py-3 text-muted tabular-nums">
                          {row.correct}
                        </td>
                        <td className="rounded-r-xl border-y border-r border-line px-4 py-3">
                          <Badge tone={toneFor(accuracy)}>{accuracy}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Bookmarks</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Questions you flagged to come back to, with your own notes.
        </p>
        <BookmarkList items={bookmarks} />
      </section>
    </>
  );
}
