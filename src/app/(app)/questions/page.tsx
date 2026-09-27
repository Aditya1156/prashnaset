import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import {
  QuestionSearch,
  type SearchResult,
} from "@/components/questions/question-search";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Difficulty, QuestionType } from "@/lib/types";

export const metadata: Metadata = { title: "Question Bank" };

const PAGE_SIZE = 20;

export default async function QuestionsPage(props: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    difficulty?: string;
    topic?: string;
    year?: string;
    page?: string;
  }>;
}) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  const isAdmin = session?.isAdmin ?? false;

  const queryText = (params.q ?? "").trim();
  const filterType = params.type as QuestionType | undefined;
  const filterDifficulty = params.difficulty as Difficulty | undefined;
  const filterTopic = params.topic ?? "";
  const filterYear = params.year ? Number(params.year) : null;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // Fetch filter options (distinct topics and exam years) in parallel with results.
  const [topicsRes, yearsRes] = await Promise.all([
    supabase
      .from("questions")
      .select("topic")
      .eq("status", "active")
      .not("topic", "is", null)
      .neq("topic", ""),
    supabase
      .from("questions")
      .select("exam_year")
      .eq("status", "active")
      .not("exam_year", "is", null),
  ]);

  const topicSet = new Set<string>();
  for (const row of topicsRes.data ?? []) {
    if (row.topic) topicSet.add(row.topic as string);
  }
  const topics = [...topicSet].sort();

  const yearSet = new Set<number>();
  for (const row of yearsRes.data ?? []) {
    if (row.exam_year) yearSet.add(row.exam_year as number);
  }
  const examYears = [...yearSet].sort((a, b) => b - a);

  // Build the filtered query.
  let countQuery = supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (queryText) countQuery = countQuery.ilike("stem", `%${queryText}%`);
  if (filterType) countQuery = countQuery.eq("type", filterType);
  if (filterDifficulty) countQuery = countQuery.eq("difficulty", filterDifficulty);
  if (filterTopic) countQuery = countQuery.eq("topic", filterTopic);
  if (filterYear) countQuery = countQuery.eq("exam_year", filterYear);

  const { count: totalCount } = await countQuery;
  const total = totalCount ?? 0;

  // Fetch paginated results with the set title joined.
  let dataQuery = supabase
    .from("questions")
    .select("id, stem, type, difficulty, topic, exam_year, exam_name, set_id, question_sets ( title )")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (queryText) dataQuery = dataQuery.ilike("stem", `%${queryText}%`);
  if (filterType) dataQuery = dataQuery.eq("type", filterType);
  if (filterDifficulty) dataQuery = dataQuery.eq("difficulty", filterDifficulty);
  if (filterTopic) dataQuery = dataQuery.eq("topic", filterTopic);
  if (filterYear) dataQuery = dataQuery.eq("exam_year", filterYear);

  const { data: rows } = await dataQuery;

  const results: SearchResult[] = (rows ?? []).map((row) => {
    const joined = row.question_sets as unknown as { title: string } | null;
    return {
      id: row.id as string,
      stem: row.stem as string,
      type: row.type as QuestionType,
      difficulty: row.difficulty as Difficulty,
      topic: (row.topic as string | null) ?? null,
      examYear: (row.exam_year as number | null) ?? null,
      examName: (row.exam_name as string | null) ?? null,
      setId: row.set_id as string,
      setTitle: joined?.title ?? "Unknown set",
    };
  });

  const hasAnyQuestions = total > 0 || queryText || filterType || filterDifficulty || filterTopic || filterYear;

  return (
    <>
      <PageHeader
        overline="Search & filter"
        title="Question Bank"
        description="Search across every question in the library by text, topic, type, difficulty, or exam year."
        actions={
          isAdmin ? (
            <ButtonLink href="/import" variant="navy">
              Import questions
            </ButtonLink>
          ) : (
            <ButtonLink href="/test/new">Build a test</ButtonLink>
          )
        }
      />

      {!hasAnyQuestions ? (
        <EmptyState
          icon={SearchIcon}
          title="No questions yet"
          body={
            isAdmin
              ? "Import your first JSON file to fill the question bank."
              : "The admin hasn't published any questions yet. Check back soon."
          }
          action={
            isAdmin ? <ButtonLink href="/import">Import questions</ButtonLink> : undefined
          }
        />
      ) : (
        <QuestionSearch
          results={results}
          topics={topics}
          examYears={examYears}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
        />
      )}
    </>
  );
}
