import type { SupabaseClient } from "@supabase/supabase-js";
import { nextReviewState, type ReviewState } from "@/lib/review/schedule";

/** Advances a question's Leitner schedule using a caller-supplied client and
 *  user id.
 *
 *  This is deliberately not a server action. The action wrapper in
 *  lib/actions/study.ts has to build its own client and re-verify the user,
 *  which costs an extra auth round trip; callers that already hold both —
 *  submitAttempt, on every single answer — go through here instead and skip
 *  it. Scheduling must never cost a learner their answer, so callers swallow
 *  failures rather than propagating them. */
export async function recordReviewWith(
  supabase: SupabaseClient,
  userId: string,
  questionId: string,
  correct: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from("review_state")
    .select("box, reps, lapses, due_on, last_correct")
    .eq("owner_id", userId)
    .eq("question_id", questionId)
    .maybeSingle();

  const previous: ReviewState | null = existing
    ? {
        box: existing.box as number,
        reps: existing.reps as number,
        lapses: existing.lapses as number,
        dueOn: existing.due_on as string,
        lastCorrect: existing.last_correct as boolean | null,
      }
    : null;

  const next = nextReviewState(previous, correct);

  await supabase.from("review_state").upsert(
    {
      owner_id: userId,
      question_id: questionId,
      box: next.box,
      reps: next.reps,
      lapses: next.lapses,
      due_on: next.dueOn,
      last_correct: next.lastCorrect,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,question_id" },
  );
}
