"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gradeAnswer } from "@/lib/grading/grade";
import {
  attemptSchema,
  createSessionSchema,
  type AttemptInput,
  type CreateSessionInput,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { shuffle } from "@/lib/utils";

const uuidSchema = z.uuid();

export interface ActionError {
  ok: false;
  error: string;
}

const TYPE_LABELS = { mcq: "MCQ", msq: "MSQ", match: "Match" } as const;

/** Builds a session from the user's filters and redirects into the runner. */
export async function createTestSession(input: CreateSessionInput): Promise<ActionError> {
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid test settings." };
  const { scope, setIds, types, count, label } = parsed.data;

  if (scope === "sets" && setIds.length === 0) {
    return { ok: false, error: "Choose at least one set." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  let query = supabase
    .from("questions")
    .select("id")
    .eq("status", "active")
    .in("type", types)
    .limit(5000);
  if (scope === "sets") query = query.in("set_id", setIds);

  const { data: questionRows, error: questionsError } = await query;
  if (questionsError) return { ok: false, error: "Couldn't load your questions." };

  const ids = (questionRows ?? []).map((row) => row.id as string);
  if (ids.length === 0) {
    return { ok: false, error: "No questions match those filters. Import some first." };
  }

  const chosen = shuffle(ids).slice(0, Math.min(count, ids.length));

  let sessionLabel = label?.trim();
  if (!sessionLabel) {
    if (scope === "all") {
      sessionLabel = "All sets";
    } else {
      const { data: titleRows } = await supabase
        .from("question_sets")
        .select("title")
        .in("id", setIds)
        .limit(2);
      const first = titleRows?.[0]?.title ?? "Selected sets";
      sessionLabel = setIds.length > 1 ? `${first} +${setIds.length - 1} more` : first;
    }
    if (types.length < 3) {
      sessionLabel += ` · ${types.map((t) => TYPE_LABELS[t]).join(" + ")}`;
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .insert({ owner_id: user.id, label: sessionLabel, question_count: chosen.length })
    .select("id")
    .single();
  if (sessionError || !session) {
    return { ok: false, error: "Couldn't create the test session." };
  }

  const { error: membersError } = await supabase.from("session_questions").insert(
    chosen.map((questionId, sortOrder) => ({
      session_id: session.id,
      question_id: questionId,
      sort_order: sortOrder,
    })),
  );
  if (membersError) {
    await supabase.from("test_sessions").delete().eq("id", session.id);
    return { ok: false, error: "Couldn't assemble the test. Nothing was started." };
  }

  revalidatePath("/history");
  redirect(`/test/${session.id}`);
}

export type AttemptResponse =
  | {
      ok: true;
      isCorrect: boolean;
      correct: string | string[];
      explanation: string | null;
    }
  | ActionError;

/** Grades one answer server-side and stores the attempt. Repeat submissions
 *  for the same question return the original stored result. */
export async function submitAttempt(input: AttemptInput): Promise<AttemptResponse> {
  const parsed = attemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid answer payload." };
  const { sessionId, questionId, selected } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, completed_at")
    .eq("id", sessionId)
    .single();
  if (!session) return { ok: false, error: "Test session not found." };
  if (session.completed_at) return { ok: false, error: "This test is already finished." };

  const { data: membership } = await supabase
    .from("session_questions")
    .select("question_id")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!membership) return { ok: false, error: "That question isn't part of this test." };

  const { data: questionData } = await supabase
    .from("questions")
    .select("type, options, correct, explanation")
    .eq("id", questionId)
    .single();
  if (!questionData) return { ok: false, error: "Question not found." };
  const question = questionData as Pick<
    QuestionRow,
    "type" | "options" | "correct" | "explanation"
  >;

  const isCorrect = gradeAnswer(question, selected);

  const { error: insertError } = await supabase.from("attempts").insert({
    owner_id: user.id,
    question_id: questionId,
    session_id: sessionId,
    selected,
    is_correct: isCorrect,
  });

  if (insertError) {
    // Unique violation → already answered; return the stored verdict.
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("attempts")
        .select("is_correct")
        .eq("session_id", sessionId)
        .eq("question_id", questionId)
        .single();
      if (existing) {
        return {
          ok: true,
          isCorrect: existing.is_correct as boolean,
          correct: question.correct,
          explanation: question.explanation,
        };
      }
    }
    return { ok: false, error: "Couldn't save your answer. Try again." };
  }

  return { ok: true, isCorrect, correct: question.correct, explanation: question.explanation };
}

export type FinishResponse =
  | { ok: true; correctCount: number; total: number }
  | ActionError;

export async function finishSession(sessionId: string): Promise<FinishResponse> {
  const parsed = uuidSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "Invalid session id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, completed_at, correct_count, question_count")
    .eq("id", parsed.data)
    .single();
  if (!session) return { ok: false, error: "Test session not found." };

  const { count: total } = await supabase
    .from("session_questions")
    .select("question_id", { count: "exact", head: true })
    .eq("session_id", session.id);

  const { data: attempts } = await supabase
    .from("attempts")
    .select("is_correct")
    .eq("session_id", session.id);

  const answered = attempts?.length ?? 0;
  const correctCount = attempts?.filter((a) => a.is_correct).length ?? 0;

  if (session.completed_at) {
    return { ok: true, correctCount: session.correct_count, total: session.question_count };
  }
  if (answered < (total ?? 0)) {
    return { ok: false, error: "Answer every question before finishing." };
  }

  const { error } = await supabase
    .from("test_sessions")
    .update({ correct_count: correctCount, completed_at: new Date().toISOString() })
    .eq("id", session.id);
  if (error) return { ok: false, error: "Couldn't finish the test. Try again." };

  // No revalidatePath here: it would re-render /test/[id] mid-action, whose
  // completed_at redirect would replace the client-side finish screen.
  // History and dashboard are dynamic pages and always render fresh.
  return { ok: true, correctCount, total: total ?? answered };
}
