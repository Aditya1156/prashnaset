"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAccountLevelFailure } from "@/lib/ai/failure";
import { explainQuestionWithAi, isGeminiConfigured } from "@/lib/ai/gemini";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";

const uuidSchema = z.uuid();

/** Generated content is written by admins only, exactly like every other
 *  change to the shared bank — so RLS covers it and no service-role key is
 *  needed anywhere in the app. Results are cached on the question, so a
 *  learner never waits on (or pays for) a model call. */
export interface GenerateResult {
  ok: boolean;
  generated?: number;
  failed?: number;
  error?: string;
  /** The first real failure, surfaced verbatim so problems are diagnosable. */
  firstFailure?: string;
}

const MAX_PER_RUN = 25;

export async function generateAiExplanations(
  setId: string,
  limit: number = MAX_PER_RUN,
): Promise<GenerateResult> {
  const parsed = uuidSchema.safeParse(setId);
  if (!parsed.success) return { ok: false, error: "Invalid set." };

  if (!isGeminiConfigured()) {
    return {
      ok: false,
      error: "No Gemini API key is configured on the server (GEMINI_API_KEY).",
    };
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: rows, error } = await supabase
    .from("questions")
    .select("id, type, stem, options, correct, explanation")
    .eq("set_id", parsed.data)
    .eq("status", "active")
    .is("ai_explanation", null)
    .order("position", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), MAX_PER_RUN));

  if (error) return { ok: false, error: "Couldn't load the questions." };
  if (!rows || rows.length === 0) {
    return { ok: true, generated: 0, failed: 0 };
  }

  let generated = 0;
  let failed = 0;
  let firstFailure: string | undefined;

  // Sequential on purpose: free Gemini tiers rate-limit aggressively, and a
  // burst of parallel calls fails far more often than it finishes faster.
  for (const row of rows) {
    const result = await explainQuestionWithAi(row as unknown as QuestionRow);
    if (!result.ok) {
      failed += 1;
      firstFailure ??= result.error;
      // Account-level problems (bad key, disabled billing, exhausted quota,
      // blocked project) will hit every remaining question identically, so
      // stop rather than making two dozen doomed calls.
      if (isAccountLevelFailure(result.error)) break;
      continue;
    }

    const { error: writeError } = await supabase
      .from("questions")
      .update({
        ai_explanation: result.value.explanation,
        ai_tip: result.value.tip,
        ai_model: result.model,
        ai_generated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (writeError) {
      failed += 1;
      firstFailure ??= "Couldn't save the generated explanation.";
    } else {
      generated += 1;
    }
  }

  revalidatePath(`/sets/${parsed.data}`);
  return { ok: generated > 0 || failed === 0, generated, failed, firstFailure };
}

/** Regenerates a single question, replacing whatever is cached. */
export async function regenerateAiExplanation(questionId: string): Promise<GenerateResult> {
  const parsed = uuidSchema.safeParse(questionId);
  if (!parsed.success) return { ok: false, error: "Invalid question." };

  if (!isGeminiConfigured()) {
    return { ok: false, error: "No Gemini API key is configured on the server." };
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: row } = await supabase
    .from("questions")
    .select("id, set_id, type, stem, options, correct, explanation")
    .eq("id", parsed.data)
    .single();
  if (!row) return { ok: false, error: "Question not found." };

  const result = await explainQuestionWithAi(row as unknown as QuestionRow);
  if (!result.ok) return { ok: false, error: result.error };

  const { error: writeError } = await supabase
    .from("questions")
    .update({
      ai_explanation: result.value.explanation,
      ai_tip: result.value.tip,
      ai_model: result.model,
      ai_generated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data);
  if (writeError) return { ok: false, error: "Couldn't save the generated explanation." };

  revalidatePath(`/sets/${row.set_id}`);
  return { ok: true, generated: 1, failed: 0 };
}
