import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { BuilderForm, type BuilderSet } from "@/components/test/builder-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/types";

export const metadata: Metadata = { title: "New test" };

export default async function TestBuilderPage(props: {
  searchParams: Promise<{ set?: string | string[] }>;
}) {
  const { set } = await props.searchParams;
  const preselected = (Array.isArray(set) ? set : set ? [set] : []).filter(Boolean);

  const supabase = await createClient();

  const { data: setRows } = await supabase
    .from("question_sets")
    .select("id, title")
    .order("created_at", { ascending: false });

  const { data: questionRows } = await supabase
    .from("questions")
    .select("set_id, type")
    .eq("status", "active")
    .limit(5000);

  const countsBySet = new Map<string, Record<QuestionType, number>>();
  for (const row of questionRows ?? []) {
    const entry = countsBySet.get(row.set_id) ?? { mcq: 0, msq: 0, match: 0 };
    entry[row.type as QuestionType] += 1;
    countsBySet.set(row.set_id, entry);
  }

  const sets: BuilderSet[] = (setRows ?? [])
    .map((row) => ({
      id: row.id as string,
      title: row.title as string,
      counts: countsBySet.get(row.id) ?? { mcq: 0, msq: 0, match: 0 },
    }))
    .filter((entry) => entry.counts.mcq + entry.counts.msq + entry.counts.match > 0);

  const totalQuestions = sets.reduce(
    (sum, entry) => sum + entry.counts.mcq + entry.counts.msq + entry.counts.match,
    0,
  );

  return (
    <>
      <PageHeader
        title="Build a test"
        description="Pick the scope, the question types and how many — then start."
      />
      {totalQuestions === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing to test yet"
          body="Once you import questions, you can assemble a test from any of your sets here."
          action={<ButtonLink href="/import">Import questions</ButtonLink>}
        />
      ) : (
        <BuilderForm sets={sets} initialSetIds={preselected} />
      )}
    </>
  );
}
