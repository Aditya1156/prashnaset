import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExamOption {
  id: string;
  name: string;
  description: string | null;
}

export interface ActiveExam {
  /** Every exam the learner may switch to, ordered for the picker. */
  options: ExamOption[];
  /** The track currently in context. Null only when no exam exists at all. */
  current: ExamOption | null;
}

/** Resolves which exam track the signed-in learner is looking at.
 *
 *  Falls back to the first active exam when their stored choice is missing
 *  or points at something deleted, so a stale profile row can never leave
 *  somebody staring at an empty library with no way to recover. The fallback
 *  is not written back — a read path should not quietly mutate the profile,
 *  and switching explicitly is what persists a choice. */
export async function getActiveExam(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveExam> {
  const [{ data: examRows }, { data: profile }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, name, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("profiles").select("active_exam_id").eq("id", userId).single(),
  ]);

  const options = (examRows ?? []) as ExamOption[];
  if (options.length === 0) return { options, current: null };

  const storedId = (profile?.active_exam_id as string | null) ?? null;
  const current = options.find((exam) => exam.id === storedId) ?? options[0];
  return { options, current };
}
