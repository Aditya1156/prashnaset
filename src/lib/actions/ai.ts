"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { explainQuestionWithAi, isAiConfigured } from "@/lib/ai/client";
import { isAccountLevelFailure, isTransientFailure } from "@/lib/ai/failure";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";

const uuidSchema = z.uuid();

const NOT_CONFIGURED =
  "No AI provider is configured on the server. Set one key: GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, CEREBRAS_API_KEY or TOGETHER_API_KEY.";

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

/** Free tiers throttle by requests-per-minute, so a short pause between calls
 *  keeps a run under the limit instead of tripping it and backing off. */
const PACE_MS = 1200;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One question, retrying transient failures with growing backoff. */
async function explainWithRetry(row: QuestionRow) {
  let last = await explainQuestionWithAi(row);
  for (let attempt = 1; !last.ok && attempt <= MAX_RETRIES; attempt++) {
    if (!isTransientFailure(last.error)) break;
    await sleep(attempt * 2500);
    last = await explainQuestionWithAi(row);
  }
  return last;
}

export async function generateAiExplanations(
  setId: string,
  limit: number = MAX_PER_RUN,
): Promise<GenerateResult> {
  const parsed = uuidSchema.safeParse(setId);
  if (!parsed.success) return { ok: false, error: "Invalid set." };
  if (!isAiConfigured()) return { ok: false, error: NOT_CONFIGURED };

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
  if (!rows || rows.length === 0) return { ok: true, generated: 0, failed: 0 };

  let generated = 0;
  let failed = 0;
  let firstFailure: string | undefined;

  // Sequential on purpose: free tiers rate-limit aggressively, and a burst of
  // parallel calls fails far more often than it finishes faster.
  for (const [index, row] of rows.entries()) {
    if (index > 0) await sleep(PACE_MS);

    const result = await explainWithRetry(row as unknown as QuestionRow);
    if (!result.ok) {
      failed += 1;
      firstFailure ??= result.error;
      // Account-level problems (bad key, disabled billing, blocked project)
      // hit every remaining question identically, so stop rather than making
      // two dozen doomed calls. Transient throttling already got its retries.
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
  if (!isAiConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: row } = await supabase
    .from("questions")
    .select("id, set_id, type, stem, options, correct, explanation")
    .eq("id", parsed.data)
    .single();
  if (!row) return { ok: false, error: "Question not found." };

  const result = await explainWithRetry(row as unknown as QuestionRow);
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
