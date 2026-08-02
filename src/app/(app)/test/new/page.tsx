import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import {
  BuilderForm,
  type BuilderFolder,
  type BuilderSet,
  type QuestionTally,
} from "@/components/test/builder-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { Difficulty, QuestionType } from "@/lib/types";

export const metadata: Metadata = { title: "New test" };

export default async function TestBuilderPage(props: {
  searchParams: Promise<{ set?: string | string[] }>;
}) {
  const { set } = await props.searchParams;
  const preselected = (Array.isArray(set) ? set : set ? [set] : []).filter(Boolean);

  const supabase = await createClient();

  const [setsRes, foldersRes, questionsRes] = await Promise.all([
    supabase
      .from("question_sets")
      .select("id, title, folder_id")
      .order("created_at", { ascending: false }),
    supabase.from("folders").select("id, name, color, icon").order("name", { ascending: true }),
    supabase
      .from("questions")
      .select("set_id, type, difficulty")
      .eq("status", "active")
      .limit(5000),
  ]);

  const tallyMap = new Map<string, QuestionTally>();
  for (const row of questionsRes.data ?? []) {
    const key = `${row.set_id}|${row.type}|${row.difficulty}`;
    const existing = tallyMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      tallyMap.set(key, {
        setId: row.set_id as string,
        type: row.type as QuestionType,
        difficulty: row.difficulty as Difficulty,
        count: 1,
      });
    }
  }
  const tallies = [...tallyMap.values()];

  const populatedSetIds = new Set(tallies.map((t) => t.setId));
  const sets: BuilderSet[] = (setsRes.data ?? [])
    .filter((row) => populatedSetIds.has(row.id as string))
    .map((row) => ({
      id: row.id as string,
      title: row.title as string,
      folderId: (row.folder_id as string | null) ?? null,
    }));
  const folders: BuilderFolder[] = (foldersRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    icon: row.icon as string,
  }));

  return (
    <>
      <PageHeader
        overline="Configurator"
        title="Build a test"
        description="Choose your material, tune the mix, and start — answers are graded as you go."
      />
      {sets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing to test yet"
          body="Once question sets are published in the library, you can assemble a test from them here."
          action={<ButtonLink href="/sets">Browse the library</ButtonLink>}
        />
      ) : (
        <BuilderForm
          sets={sets}
          folders={folders}
          tallies={tallies}
          initialSetIds={preselected}
        />
      )}
    </>
  );
}
