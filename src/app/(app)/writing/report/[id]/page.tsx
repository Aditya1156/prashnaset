import { AlertTriangle, CheckCircle2, Lightbulb, MapPin, Target } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Answer report" };

interface Criterion {
  key: string;
  label: string;
  awarded: number;
  max: number;
  comment?: string;
}

function List({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: typeof Target;
  items: string[];
  tone: "success" | "danger" | "accent";
}) {
  if (items.length === 0) return null;
  const colour =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-accent";
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-ink">
        <Icon className={`size-4 ${colour}`} aria-hidden />
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted">
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${colour.replace("text-", "bg-")}`} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function ReportPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const { data: evaluation } = await supabase
    .from("mains_evaluations")
    .select("*")
    .eq("id", id)
    .single();
  if (!evaluation) notFound();

  const { data: answer } = await supabase
    .from("mains_answers")
    .select("id, question_id, word_count, time_taken_sec, mode, transcript_final")
    .eq("id", evaluation.answer_id as string)
    .single();

  const { data: question } = answer
    ? await supabase
        .from("mains_questions")
        .select("id, paper, section, marks, text_en, text_hi, directive, bihar_angle")
        .eq("id", answer.question_id as string)
        .single()
    : { data: null };

  const criteria = (evaluation.criteria ?? []) as Criterion[];
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((v) => String(v)) : [];

  const bihar = evaluation.bihar_dimension as { present: boolean; comment: string } | null;

  return (
    <>
      <PageHeader
        overline="Mains"
        title="Answer report"
        description={question ? (question.text_en as string) ?? (question.text_hi as string) : undefined}
        actions={
          question ? (
            <ButtonLink href={`/writing/${question.id}`} variant="secondary">
              Attempt again
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl text-ink tabular-nums">
                {String(evaluation.marks_awarded)}
                <span className="text-xl text-muted">/{String(evaluation.marks_max)}</span>
              </p>
              <p className="mt-1 text-sm text-muted tabular-nums">
                {String(evaluation.percent)}% · {String(evaluation.band).replace("_", " ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {answer && <Badge>{String(answer.word_count)} words</Badge>}
              {answer?.time_taken_sec ? (
                <Badge>{Math.round((answer.time_taken_sec as number) / 60)} min</Badge>
              ) : null}
              {evaluation.directive_followed === false && (
                <Badge tone="danger">Directive missed</Badge>
              )}
              {answer?.mode === "study" && <Badge tone="neutral">Study</Badge>}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Where the marks went</h2>
          <ul className="mt-4 space-y-4">
            {criteria.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{c.label}</span>
                  <span className="shrink-0 text-sm text-muted tabular-nums">
                    {c.awarded}/{c.max}
                  </span>
                </div>
                <Progress
                  value={c.awarded}
                  max={c.max}
                  label={c.label}
                  className="mt-1.5"
                  tone={c.awarded / c.max >= 0.6 ? "success" : c.awarded / c.max >= 0.4 ? "warn" : "danger"}
                />
                {c.comment && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.comment}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {bihar && question?.bihar_angle ? (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-lg text-ink">
              <MapPin className="size-4 text-warn" aria-hidden /> Bihar dimension
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {bihar.present ? "Present. " : "Missing. "}
              {bihar.comment}
            </p>
          </Card>
        ) : null}

        <List
          title="What worked"
          icon={CheckCircle2}
          items={strings(evaluation.strengths)}
          tone="success"
        />
        <List
          title="Mistakes"
          icon={AlertTriangle}
          items={strings(evaluation.mistakes)}
          tone="danger"
        />
        <List
          title="Points a topper would have included"
          icon={Target}
          items={strings(evaluation.missed_points)}
          tone="accent"
        />

        {strings(evaluation.suggested_structure).length > 0 && (
          <Card className="p-5">
            <h2 className="font-display text-lg text-ink">Structure that would have scored</h2>
            <ol className="mt-3 space-y-1.5">
              {strings(evaluation.suggested_structure).map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted">
                  <span className="shrink-0 tabular-nums text-faint">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {(evaluation.improved_intro || evaluation.improved_conclusion) && (
          <Card className="p-5">
            <h2 className="font-display text-lg text-ink">Rewritten for you</h2>
            {evaluation.improved_intro ? (
              <div className="mt-3">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Introduction
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  {String(evaluation.improved_intro)}
                </p>
              </div>
            ) : null}
            {evaluation.improved_conclusion ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Conclusion
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  {String(evaluation.improved_conclusion)}
                </p>
              </div>
            ) : null}
          </Card>
        )}

        {evaluation.next_action ? (
          <Card className="border-accent/30 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg text-ink">
              <Lightbulb className="size-4 text-accent" aria-hidden /> Do this next
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {String(evaluation.next_action)}
            </p>
          </Card>
        ) : null}

        <p className="text-xs leading-relaxed text-faint">
          An AI estimate at BPSC-style strictness. BPSC does not publish a rubric, so this is a
          direction of travel rather than a result.
        </p>
      </div>
    </>
  );
}
