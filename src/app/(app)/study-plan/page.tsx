import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Study Plan" };

interface TopicRow {
  topic: string;
  answered: number;
  correct: number;
  accuracy: number | null;
}

function sectionLabel(tone: BadgeTone): string {
  switch (tone) {
    case "danger":
      return "Needs work";
    case "warn":
      return "Getting there";
    case "success":
      return "Strong";
    default:
      return "";
  }
}

function sectionDescription(tone: BadgeTone): string {
  switch (tone) {
    case "danger":
      return "These topics need the most attention. Drill them first.";
    case "warn":
      return "You are making progress here. A few more rounds will lock them in.";
    case "success":
      return "You have a good grip on these. Revisit occasionally to stay sharp.";
    default:
      return "";
  }
}

interface TopicCardProps {
  topic: string;
  accuracy: number;
  answered: number;
  available: number;
  tone: BadgeTone;
  showTip?: boolean;
}

function TopicCard({ topic, accuracy, answered, available, tone, showTip }: TopicCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base text-ink">{topic}</h3>
        <Badge tone={tone}>{accuracy}%</Badge>
      </div>
      <Progress
        value={answered}
        max={available}
        className="mt-3"
        label={`${topic} coverage`}
      />
      <p className="mt-2 text-sm text-muted">
        {answered} of {available} {plural(available, "question")} practiced
      </p>
      {showTip && (
        <p className="mt-2 text-sm font-medium text-danger">
          Focus here — drill this topic until accuracy improves.
        </p>
      )}
      <div className="mt-3">
        <ButtonLink href="/test/new" variant="secondary" size="sm">
          Practice
        </ButtonLink>
      </div>
    </Card>
  );
}

function CompactTopicRow({
  topic,
  accuracy,
  answered,
  available,
}: {
  topic: string;
  accuracy: number;
  answered: number;
  available: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="flex-1 text-sm font-medium text-ink">{topic}</span>
      <span className="text-sm tabular-nums text-muted">
        {answered}/{available}
      </span>
      <Badge tone="success">{accuracy}%</Badge>
    </div>
  );
}

export default async function StudyPlanPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const [topicRes, questionsRes] = await Promise.all([
    supabase.rpc("my_topic_accuracy", { days: 0 }),
    supabase.from("questions").select("topic").eq("status", "active"),
  ]);

  const topicRows = (topicRes.data ?? []) as TopicRow[];
  const answeredTopics = topicRows.filter((r) => r.answered > 0);

  // Count total available questions per topic
  const availableByTopic: Record<string, number> = {};
  for (const q of questionsRes.data ?? []) {
    const t = (q.topic as string) || "Untagged";
    availableByTopic[t] = (availableByTopic[t] ?? 0) + 1;
  }

  // Partition answered topics into buckets
  interface BucketEntry { topic: string; answered: number; correct: number; accuracy: number; available: number }
  const needsWork: BucketEntry[] = [];
  const gettingThere: BucketEntry[] = [];
  const strong: BucketEntry[] = [];

  for (const row of answeredTopics) {
    const accuracy = Math.round(row.accuracy ?? 0);
    const available = availableByTopic[row.topic] ?? row.answered;
    const entry: BucketEntry = { topic: row.topic, answered: row.answered, correct: row.correct, accuracy, available };
    if (accuracy < 50) needsWork.push(entry);
    else if (accuracy < 80) gettingThere.push(entry);
    else strong.push(entry);
  }

  // Sort each bucket by accuracy ascending (worst first)
  needsWork.sort((a, b) => a.accuracy - b.accuracy);
  gettingThere.sort((a, b) => a.accuracy - b.accuracy);
  strong.sort((a, b) => a.accuracy - b.accuracy);

  // Find topics with available questions that the learner hasn't attempted
  const answeredSet = new Set(answeredTopics.map((r) => r.topic));
  const notStarted = Object.entries(availableByTopic)
    .filter(([topic]) => !answeredSet.has(topic))
    .map(([topic, available]) => ({ topic, available }))
    .sort((a, b) => b.available - a.available);

  const hasAnyData = answeredTopics.length > 0;

  return (
    <>
      <PageHeader
        overline="Study plan"
        title="What to focus on"
        description="Recommendations based on your accuracy per topic across all attempts. Work on the weakest areas first for the biggest gains."
      />

      {!hasAnyData ? (
        <EmptyState
          icon={Compass}
          title="No study data yet"
          body="Take a test first. Once you have answered some questions, this page shows which topics to focus on."
          action={<ButtonLink href="/test/new">Take a test</ButtonLink>}
        />
      ) : (
        <div className="space-y-10">
          {/* Needs work */}
          {needsWork.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-xl text-ink">{sectionLabel("danger")}</h2>
                <p className="mt-1 text-sm text-muted">{sectionDescription("danger")}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {needsWork.map((row) => (
                  <TopicCard
                    key={row.topic}
                    topic={row.topic}
                    accuracy={row.accuracy}
                    answered={row.answered}
                    available={row.available}
                    tone="danger"
                    showTip
                  />
                ))}
              </div>
            </section>
          )}

          {/* Getting there */}
          {gettingThere.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-xl text-ink">{sectionLabel("warn")}</h2>
                <p className="mt-1 text-sm text-muted">{sectionDescription("warn")}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gettingThere.map((row) => (
                  <TopicCard
                    key={row.topic}
                    topic={row.topic}
                    accuracy={row.accuracy}
                    answered={row.answered}
                    available={row.available}
                    tone="warn"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Strong */}
          {strong.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-xl text-ink">{sectionLabel("success")}</h2>
                <p className="mt-1 text-sm text-muted">{sectionDescription("success")}</p>
              </div>
              <div className="space-y-2">
                {strong.map((row) => (
                  <CompactTopicRow
                    key={row.topic}
                    topic={row.topic}
                    accuracy={row.accuracy}
                    answered={row.answered}
                    available={row.available}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Not started */}
          {notStarted.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-xl text-ink">Not started</h2>
                <p className="mt-1 text-sm text-muted">
                  You have not attempted any questions in {plural(notStarted.length, "this topic", "these topics")} yet.
                  Try them to get a full picture of where you stand.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {notStarted.map(({ topic, available }) => (
                  <Card key={topic} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-base text-ink">{topic}</h3>
                      <Badge tone="neutral">New</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {available} {plural(available, "question")} available
                    </p>
                    <div className="mt-3">
                      <ButtonLink href="/test/new" variant="secondary" size="sm">
                        Start
                      </ButtonLink>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
