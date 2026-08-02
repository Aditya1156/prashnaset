"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  updateQuestionSchema,
  updateSetSchema,
  type UpdateQuestionInput,
  type UpdateSetInput,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { shuffleAvoidingOrder } from "@/lib/utils";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const uuidSchema = z.uuid();

async function refreshQuestionCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  setId: string,
) {
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("set_id", setId)
    .eq("status", "active");
  await supabase
    .from("question_sets")
    .update({ question_count: count ?? 0 })
    .eq("id", setId);
}

/** Renames a set (and fixes its language). Import-time titles come from the
 *  file, so they usually need tidying afterwards. */
export async function updateSet(input: UpdateSetInput): Promise<ActionResult> {
  const parsed = updateSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give the set a title of 1–200 characters." };
  }
  const { id, title, language } = parsed.data;

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: updated, error } = await supabase
    .from("question_sets")
    .update({ title, language })
    .eq("id", id)
    .select("id, folder_id");
  if (error) return { ok: false, error: "Couldn't save the set." };
  if (!updated || updated.length === 0) return { ok: false, error: "Set not found." };

  revalidatePath("/sets");
  revalidatePath(`/sets/${id}`);
  if (updated[0].folder_id) revalidatePath(`/sets/folder/${updated[0].folder_id}`);
  else revalidatePath("/sets/folder/unfiled");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Deletes a whole set (cascade removes its questions). RLS scopes the
 *  delete to the owner; a foreign id simply deletes nothing. */
export async function deleteSet(setId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(setId);
  if (!parsed.success) return { ok: false, error: "Invalid set id." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.from("question_sets").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't delete the set. Try again." };

  revalidatePath("/sets");
  revalidatePath("/dashboard");
  redirect("/sets");
}

/** Soft-removes a question: it disappears from the set and future tests,
 *  while past attempts keep their history. */
export async function removeQuestion(questionId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(questionId);
  if (!parsed.success) return { ok: false, error: "Invalid question id." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: question, error } = await supabase
    .from("questions")
    .update({ status: "removed" })
    .eq("id", parsed.data)
    .select("set_id")
    .single();
  if (error || !question) return { ok: false, error: "Couldn't remove the question." };

  await refreshQuestionCount(supabase, question.set_id);

  revalidatePath(`/sets/${question.set_id}`);
  revalidatePath("/sets");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateQuestion(input: UpdateQuestionInput): Promise<ActionResult> {
  const parsed = updateQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The edited question is invalid. Check every field." };
  }
  const payload = parsed.data;

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: existing } = await supabase
    .from("questions")
    .select("id, set_id, type")
    .eq("id", payload.id)
    .single();
  if (!existing) return { ok: false, error: "Question not found." };
  if (existing.type !== payload.type) {
    return { ok: false, error: "A question's type can't be changed." };
  }

  const explanation = payload.explanation.trim() || null;
  let fields: Record<string, unknown>;

  if (payload.type === "mcq") {
    if (payload.correctIndex >= payload.options.length) {
      return { ok: false, error: "Pick which option is correct." };
    }
    fields = {
      stem: payload.stem,
      options: payload.options,
      correct: payload.options[payload.correctIndex],
      explanation,
      difficulty: payload.difficulty,
    };
  } else if (payload.type === "msq") {
    const indexes = [...new Set(payload.correctIndexes)].filter(
      (i) => i < payload.options.length,
    );
    if (indexes.length === 0) {
      return { ok: false, error: "Pick at least one correct option." };
    }
    fields = {
      stem: payload.stem,
      options: payload.options,
      correct: indexes.sort((a, b) => a - b).map((i) => payload.options[i]),
      explanation,
      difficulty: payload.difficulty,
    };
  } else {
    const correct = payload.pairs.map((pair) => pair.right);
    fields = {
      stem: payload.stem,
      options: {
        left: payload.pairs.map((pair) => pair.left),
        right: shuffleAvoidingOrder(correct),
      },
      correct,
      explanation,
      difficulty: payload.difficulty,
    };
  }

  const { error } = await supabase.from("questions").update(fields).eq("id", payload.id);
  if (error) return { ok: false, error: "Couldn't save the changes." };

  revalidatePath(`/sets/${existing.set_id}`);
  return { ok: true };
}
