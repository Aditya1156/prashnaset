"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  classifyQuestion,
  evaluateAnswer,
  generateModelAnswer,
  isMainsAiConfigured,
  transcribePage,
  type InlineImage,
} from "@/lib/ai/mains-client";
import { finaliseEvaluation, type MainsType } from "@/lib/ai/mains-rubric";
import type { MainsQuestionSpec } from "@/lib/ai/mains-prompt";
import { requireAdmin } from "@/lib/auth";
import { getActiveExam } from "@/lib/exam";
import { parseMainsFile } from "@/lib/mains/parse";
import { createClient } from "@/lib/supabase/server";

export interface MainsResult {
  ok: boolean;
  error?: string;
}

const uuid = z.uuid();
const NO_AI = "No AI provider is configured on the server. Set GEMINI_API_KEY.";

/** Vision calls are the most expensive thing in this app, so a learner gets a
 *  bounded number of markings per day. */
const EVALUATIONS_PER_DAY = 15;

type QuestionRow = {
  id: string;
  paper: string;
  section: number | null;
  type: string;
  marks: number;
  text_en: string | null;
  text_hi: string | null;
  directive: string | null;
  bihar_angle: boolean;
};

function toSpec(row: QuestionRow): MainsQuestionSpec {
  return {
    type: row.type as MainsType,
    marks: row.marks,
    paper: row.paper,
    section: row.section,
    textEn: row.text_en,
    textHi: row.text_hi,
    directive: row.directive,
    biharAngle: row.bihar_angle,
  };
}

// ── Import ─────────────────────────────────────────────────────
export interface MainsImportResult extends MainsResult {
  imported?: number;
  skipped?: { index: number; reason: string }[];
}

export async function importMainsQuestions(raw: string): Promise<MainsImportResult> {
  if (raw.length > 2_000_000) return { ok: false, error: "That file is too large (max 2MB)." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const parsed = parseMainsFile(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { current: exam } = await getActiveExam(supabase, admin.userId);

  const rows = parsed.questions.map((q) => ({
    exam_id: exam?.id ?? null,
    source: "PYQ",
    exam_label: q.examLabel,
    exam_year: q.examYear,
    paper: q.paper,
    section: q.section,
    type: q.type,
    marks: q.marks,
    word_limit: q.wordLimit,
    text_en: q.textEn,
    text_hi: q.textHi,
    directive: q.directive,
    bihar_angle: q.biharAngle,
    topic: q.topic,
    tags: q.tags,
    model_answer: q.modelAnswer,
    created_by: admin.userId,
  }));

  const { error } = await supabase.from("mains_questions").insert(rows);
  if (error) return { ok: false, error: "Couldn't save the questions." };

  revalidatePath("/writing");
  return { ok: true, imported: rows.length, skipped: parsed.skipped };
}

// ── Learner adds their own question ────────────────────────────
export interface AddQuestionResult extends MainsResult {
  questionId?: string;
  note?: string;
}

export async function addMyQuestion(
  text: string,
  userMarks?: number | null,
): Promise<AddQuestionResult> {
  const trimmed = text.trim();
  if (trimmed.length < 15) return { ok: false, error: "Type the full question first." };
  if (trimmed.length > 2000) return { ok: false, error: "That question is too long." };
  if (!isMainsAiConfigured()) return { ok: false, error: NO_AI };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const classified = await classifyQuestion(trimmed, userMarks);
  if (!classified.ok) return { ok: false, error: classified.error };
  const c = classified.value;

  if (!c.isValidBpscStyle) {
    return {
      ok: false,
      error: c.note || "That doesn't look like a BPSC Mains question.",
    };
  }

  const { current: exam } = await getActiveExam(supabase, user.id);
  const paper = ["GS1", "GS2", "ESSAY"].includes(c.paper) ? c.paper : "GS1";

  const { data, error } = await supabase
    .from("mains_questions")
    .insert({
      exam_id: exam?.id ?? null,
      source: "USER",
      paper,
      section: paper === "ESSAY" ? null : c.section,
      type: c.type,
      marks: userMarks ?? c.marks,
      text_en: trimmed,
      text_hi: c.textHi ?? null,
      directive: c.directive ?? null,
      bihar_angle: c.biharAngle === true,
      topic: c.topic ?? null,
      tags: c.tags ?? [],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Couldn't save that question." };

  revalidatePath("/writing");
  return { ok: true, questionId: data.id as string, note: c.note };
}

// ── Model answer, generated once and cached ────────────────────
export interface ModelAnswerResponse extends MainsResult {
  answer?: string;
}

export async function getModelAnswer(questionId: string): Promise<ModelAnswerResponse> {
  if (!uuid.safeParse(questionId).success) return { ok: false, error: "Invalid question." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: row } = await supabase
    .from("mains_questions")
    .select("id, paper, section, type, marks, text_en, text_hi, directive, bihar_angle, model_answer")
    .eq("id", questionId)
    .single();
  if (!row) return { ok: false, error: "Question not found." };

  if (row.model_answer) return { ok: true, answer: row.model_answer as string };
  if (!isMainsAiConfigured()) return { ok: false, error: NO_AI };

  const generated = await generateModelAnswer(
    toSpec(row as QuestionRow),
    row.text_hi && !row.text_en ? "hi" : "en",
  );
  if (!generated.ok) return { ok: false, error: generated.error };

  // Cached on the question so it is written once for everybody. RLS allows
  // this only for admins and for a learner's own question; a failure here
  // costs nothing but a regeneration next time.
  await supabase
    .from("mains_questions")
    .update({
      model_answer: generated.value.answer,
      model_answer_model: generated.model,
      model_answer_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  return { ok: true, answer: generated.value.answer };
}

// ── Attempt lifecycle ──────────────────────────────────────────
export interface StartAttemptResult extends MainsResult {
  attemptId?: string;
}

export async function startAttempt(
  questionId: string,
  mode: "study" | "test",
): Promise<StartAttemptResult> {
  if (!uuid.safeParse(questionId).success) return { ok: false, error: "Invalid question." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("mains_answers")
    .insert({ owner_id: user.id, question_id: questionId, mode })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't start that attempt." };

  return { ok: true, attemptId: data.id as string };
}

export interface TranscribeResult extends MainsResult {
  transcript?: string;
  illegibleCount?: number;
  language?: "en" | "hi" | "mixed";
  legibilityNote?: string;
}

/** Transcribes ONE page. The client walks the pages and stitches the result:
 *  a six-page sheet in a single request runs past the serverless budget, and
 *  a failure there would lose the whole submission rather than one page. */
export async function transcribeAttemptPage(
  attemptId: string,
  pageNumber: number,
  base64: string,
  mimeType: string,
): Promise<TranscribeResult> {
  if (!uuid.safeParse(attemptId).success) return { ok: false, error: "Invalid attempt." };
  if (!isMainsAiConfigured()) return { ok: false, error: NO_AI };
  // ~8MB of base64 is a generous single page; anything larger is a sign the
  // client skipped compression.
  if (base64.length > 8_000_000) return { ok: false, error: "That page image is too large." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: attempt } = await supabase
    .from("mains_answers")
    .select("id")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return { ok: false, error: "Attempt not found." };

  const image: InlineImage = { base64, mimeType };
  const result = await transcribePage(image, pageNumber);
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    transcript: result.value.transcript,
    illegibleCount: result.value.illegibleCount ?? 0,
    language: result.value.language ?? "en",
    legibilityNote: result.value.legibilityNote,
  };
}

/** Stores the transcript the candidate confirmed. Marking runs on this, not
 *  on the raw read — the text they are judged on is theirs. */
export async function saveTranscript(
  attemptId: string,
  raw: string,
  final: string,
  meta: { illegibleCount: number; language: "en" | "hi" | "mixed"; legibilityNote?: string },
): Promise<MainsResult> {
  if (!uuid.safeParse(attemptId).success) return { ok: false, error: "Invalid attempt." };
  if (final.trim().length < 20) return { ok: false, error: "There's almost nothing to mark." };

  const supabase = await createClient();
  const wordCount = final.trim().split(/\s+/).filter(Boolean).length;

  const { error } = await supabase
    .from("mains_answers")
    .update({
      transcript_raw: raw,
      transcript_final: final,
      word_count: wordCount,
      illegible_count: meta.illegibleCount,
      language: meta.language,
      legibility_note: meta.legibilityNote ?? null,
      status: "TRANSCRIBED",
    })
    .eq("id", attemptId);
  if (error) return { ok: false, error: "Couldn't save the transcript." };

  return { ok: true };
}

export interface EvaluateResult extends MainsResult {
  evaluationId?: string;
  total?: number;
  maxMarks?: number;
  percent?: number;
  band?: string;
}

export async function evaluateAttempt(
  attemptId: string,
  timeTakenSec?: number | null,
): Promise<EvaluateResult> {
  if (!uuid.safeParse(attemptId).success) return { ok: false, error: "Invalid attempt." };
  if (!isMainsAiConfigured()) return { ok: false, error: NO_AI };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("mains_evaluations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= EVALUATIONS_PER_DAY) {
    return {
      ok: false,
      error: `You've used all ${EVALUATIONS_PER_DAY} evaluations for today. They reset 24 hours after each one.`,
    };
  }

  const { data: attempt } = await supabase
    .from("mains_answers")
    .select("id, question_id, transcript_final, language, time_taken_sec, mode")
    .eq("id", attemptId)
    .single();
  if (!attempt) return { ok: false, error: "Attempt not found." };
  if (!attempt.transcript_final) {
    return { ok: false, error: "Confirm the transcript before marking." };
  }

  const { data: question } = await supabase
    .from("mains_questions")
    .select("id, paper, section, type, marks, text_en, text_hi, directive, bihar_angle")
    .eq("id", attempt.question_id as string)
    .single();
  if (!question) return { ok: false, error: "Question not found." };

  const spec = toSpec(question as QuestionRow);
  const evaluated = await evaluateAnswer({
    question: spec,
    transcript: attempt.transcript_final as string,
    language: (attempt.language as "en" | "hi" | "mixed") ?? "en",
    timeTakenSec: timeTakenSec ?? (attempt.time_taken_sec as number | null),
  });

  if (!evaluated.ok) {
    await supabase
      .from("mains_answers")
      .update({ status: "FAILED", failure_reason: evaluated.error.slice(0, 300) })
      .eq("id", attemptId);
    return { ok: false, error: evaluated.error };
  }

  // The model's own total is discarded and the score recomputed from its
  // per-criterion marks — see finaliseEvaluation.
  const score = finaliseEvaluation(
    evaluated.value.criteria ?? [],
    spec.type,
    spec.marks,
  );
  const v = evaluated.value;

  const { data: saved, error: saveError } = await supabase
    .from("mains_evaluations")
    .insert({
      answer_id: attemptId,
      owner_id: user.id,
      marks_awarded: score.total,
      marks_max: score.maxMarks,
      percent: score.percent,
      band: score.band,
      criteria: score.criteria,
      demand_analysis: v.demandAnalysis ?? [],
      directive_followed: v.directiveFollowed ?? null,
      bihar_dimension: v.biharDimension ?? null,
      strengths: v.strengths ?? [],
      mistakes: v.mistakes ?? [],
      missed_points: v.missedPoints ?? [],
      suggested_structure: v.suggestedStructure ?? [],
      improved_intro: v.improvedIntro ?? null,
      improved_conclusion: v.improvedConclusion ?? null,
      diagram_suggestion: v.diagramSuggestion ?? null,
      presentation_note: v.presentationNote ?? null,
      next_action: v.nextAction ?? null,
      raw: v as unknown as Record<string, unknown>,
      model: evaluated.model,
    })
    .select("id")
    .single();

  if (saveError || !saved) return { ok: false, error: "Couldn't save the evaluation." };

  await supabase
    .from("mains_answers")
    .update({
      status: "EVALUATED",
      submitted_at: new Date().toISOString(),
      time_taken_sec: timeTakenSec ?? (attempt.time_taken_sec as number | null),
    })
    .eq("id", attemptId);

  revalidatePath("/writing");
  return {
    ok: true,
    evaluationId: saved.id as string,
    total: score.total,
    maxMarks: score.maxMarks,
    percent: score.percent,
    band: score.band,
  };
}
