"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextReviewState, type ReviewState } from "@/lib/review/schedule";

const uuidSchema = z.uuid();

export interface StudyResult {
  ok: boolean;
  error?: string;
}

/** Records the outcome of answering a question against its review schedule.
 *  Called after grading, and deliberately never blocks the answer itself:
 *  a scheduling hiccup must not cost the learner their attempt. */
export async function recordReview(questionId: string, correct: boolean): Promise<void> {
  const parsed = uuidSchema.safeParse(questionId);
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("review_state")
    .select("box, reps, lapses, due_on, last_correct")
    .eq("owner_id", user.id)
    .eq("question_id", parsed.data)
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
      owner_id: user.id,
      question_id: parsed.data,
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

/** Reads the learner's existing row for a question. An upsert writes a whole
 *  row, so any column left out of the payload would be reset to its default —
 *  saving a note would silently clear the bookmark, and vice versa. Both
 *  writers merge onto what is already stored. */
async function currentNote(
  supabase: SupabaseClient,
  ownerId: string,
  questionId: string,
): Promise<{ bookmarked: boolean; note: string | null }> {
  const { data } = await supabase
    .from("question_notes")
    .select("bookmarked, note")
    .eq("owner_id", ownerId)
    .eq("question_id", questionId)
    .maybeSingle();
  return {
    bookmarked: Boolean(data?.bookmarked),
    note: (data?.note as string | null) ?? null,
  };
}

/** Toggles a bookmark on a question. */
export async function toggleBookmark(
  questionId: string,
): Promise<StudyResult & { bookmarked?: boolean }> {
  const parsed = uuidSchema.safeParse(questionId);
  if (!parsed.success) return { ok: false, error: "Invalid question." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const existing = await currentNote(supabase, user.id, parsed.data);
  const bookmarked = !existing.bookmarked;

  const { error } = await supabase.from("question_notes").upsert(
    {
      owner_id: user.id,
      question_id: parsed.data,
      bookmarked,
      note: existing.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,question_id" },
  );
  if (error) return { ok: false, error: "Couldn't save the bookmark." };

  revalidatePath("/progress");
  return { ok: true, bookmarked };
}

/** Saves (or clears) a learner's own note on a question. */
export async function saveNote(questionId: string, note: string): Promise<StudyResult> {
  const parsed = uuidSchema.safeParse(questionId);
  if (!parsed.success) return { ok: false, error: "Invalid question." };
  const trimmed = note.trim().slice(0, 2000);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const existing = await currentNote(supabase, user.id, parsed.data);

  const { error } = await supabase.from("question_notes").upsert(
    {
      owner_id: user.id,
      question_id: parsed.data,
      note: trimmed || null,
      bookmarked: existing.bookmarked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,question_id" },
  );
  if (error) return { ok: false, error: "Couldn't save the note." };

  revalidatePath("/progress");
  return { ok: true };
}

/** Sets the learner's daily question goal. 0 turns the goal off. */
export async function setDailyTarget(target: number): Promise<StudyResult> {
  const value = Math.min(Math.max(Math.trunc(target) || 0, 0), 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ daily_target: value })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your daily target." };

  revalidatePath("/dashboard");
  revalidatePath("/progress");
  return { ok: true };
}
