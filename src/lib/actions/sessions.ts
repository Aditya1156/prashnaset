"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gradeAnswer } from "@/lib/grading/grade";
import { MISTAKE_WINDOW_DAYS } from "@/lib/practice";
import { recordReview } from "@/lib/actions/study";
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

/** Materialises a session row plus its ordered questions. Shared by every
 *  mode so timing and membership behave identically. */
async function buildSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    ownerId: string;
    questionIds: string[];
    label: string;
    mode: "practice" | "mistakes" | "assigned";
    durationMinutes?: number | null;
    assignmentId?: string | null;
    negativeMarking?: number | null;
  },
): Promise<{ ok: true; sessionId: string } | ActionError> {
  const { ownerId, questionIds, label, mode, durationMinutes, assignmentId, negativeMarking } =
    params;
  if (questionIds.length === 0) {
    return { ok: false, error: "No questions match those filters." };
  }

  const durationSeconds =
    durationMinutes && durationMinutes > 0 ? durationMinutes * 60 : null;

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .insert({
      owner_id: ownerId,
      label,
      question_count: questionIds.length,
      mode,
      duration_seconds: durationSeconds,
      expires_at: durationSeconds
        ? new Date(Date.now() + durationSeconds * 1000).toISOString()
        : null,
      assignment_id: assignmentId ?? null,
      negative_marking: negativeMarking ?? 0,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    return { ok: false, error: "Couldn't create the test session." };
  }

  const { error: membersError } = await supabase.from("session_questions").insert(
    questionIds.map((questionId, sortOrder) => ({
      session_id: session.id,
      question_id: questionId,
      sort_order: sortOrder,
    })),
  );
  if (membersError) {
    await supabase.from("test_sessions").delete().eq("id", session.id);
    return { ok: false, error: "Couldn't assemble the test. Nothing was started." };
  }

  return { ok: true, sessionId: session.id as string };
}

/** Builds a session from the user's filters and redirects into the runner. */
export async function createTestSession(input: CreateSessionInput): Promise<ActionError> {
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid test settings." };
  const { scope, setIds, types, difficulties, count, label, durationMinutes, negativeMarking } =
    parsed.data;

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
  if (difficulties.length < 3) query = query.in("difficulty", difficulties);

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
    if (difficulties.length < 3) {
      sessionLabel += ` · ${difficulties
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
        .join(" + ")}`;
    }
  }

  const built = await buildSession(supabase, {
    ownerId: user.id,
    questionIds: chosen,
    label: sessionLabel || "Practice test",
    mode: "practice",
    durationMinutes,
    negativeMarking,
  });
  if (!built.ok) return built;

  revalidatePath("/history");
  redirect(`/test/${built.sessionId}`);
}

/** Retest of questions the learner most recently got wrong within the window.
 *  Retrieval practice on your own errors is the highest-yield revision there
 *  is, so this is offered as a one-tap action rather than something to
 *  assemble by hand. */
export async function createMistakeSession(
  days: number = MISTAKE_WINDOW_DAYS,
  max: number = 20,
): Promise<ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data, error } = await supabase.rpc("my_mistake_questions", {
    days,
    max_count: max,
  });
  if (error) return { ok: false, error: "Couldn't load your recent mistakes." };

  const ids = ((data ?? []) as unknown[])
    .map((row) => (typeof row === "string" ? row : (row as { id?: string })?.id))
    .filter((id): id is string => typeof id === "string");

  if (ids.length === 0) {
    return {
      ok: false,
      error: `No mistakes in the last ${days} days — take a test first, then come back to drill what you miss.`,
    };
  }

  const built = await buildSession(supabase, {
    ownerId: user.id,
    questionIds: ids,
    label: `Mistake revision · last ${days} days`,
    mode: "mistakes",
  });
  if (!built.ok) return built;

  revalidatePath("/history");
  redirect(`/test/${built.sessionId}`);
}

/** Builds today's spaced-repetition queue: questions whose scheduled review
 *  date has arrived. This is the highest-value thing a learner can do each
 *  day, so it gets its own one-tap entry point. */
export async function createReviewSession(max: number = 20): Promise<ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data, error } = await supabase.rpc("my_due_questions", { max_count: max });
  if (error) return { ok: false, error: "Couldn't load your review queue." };

  const ids = ((data ?? []) as unknown[])
    .map((row) => (typeof row === "string" ? row : (row as { id?: string })?.id))
    .filter((id): id is string => typeof id === "string");

  if (ids.length === 0) {
    return {
      ok: false,
      error: "Nothing is due for review yet. Take a test and questions will be scheduled.",
    };
  }

  const built = await buildSession(supabase, {
    ownerId: user.id,
    questionIds: ids,
    label: `Review · ${ids.length} due`,
    mode: "mistakes",
  });
  if (!built.ok) return built;

  revalidatePath("/history");
  redirect(`/test/${built.sessionId}`);
}

/** Drills the questions the learner has bookmarked. Bookmarking is a
 *  deliberate "come back to this" signal, so it deserves to be practisable
 *  rather than only readable. */
export async function createBookmarkSession(max: number = 25): Promise<ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("question_notes")
    .select("question_id")
    .eq("bookmarked", true)
    .limit(Math.max(1, max));
  if (error) return { ok: false, error: "Couldn't load your bookmarks." };

  const ids = (data ?? []).map((row) => row.question_id as string);
  if (ids.length === 0) {
    return { ok: false, error: "You haven't bookmarked any questions yet." };
  }

  const built = await buildSession(supabase, {
    ownerId: user.id,
    questionIds: ids,
    label: `Bookmarks · ${ids.length} ${ids.length === 1 ? "question" : "questions"}`,
    mode: "mistakes",
  });
  if (!built.ok) return built;

  revalidatePath("/history");
  redirect(`/test/${built.sessionId}`);
}

/** Starts (or resumes) a learner's attempt at an assigned test. */
export async function startAssignment(assignmentId: string): Promise<ActionError> {
  const parsed = uuidSchema.safeParse(assignmentId);
  if (!parsed.success) return { ok: false, error: "Invalid assignment." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // RLS already limits this to assignments aimed at the caller.
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, config, duration_minutes")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!assignment) return { ok: false, error: "That test isn't assigned to you." };

  const existing = await supabase
    .from("test_sessions")
    .select("id, completed_at")
    .eq("assignment_id", assignment.id)
    .eq("owner_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.data) {
    if (existing.data.completed_at) {
      return { ok: false, error: "You've already completed this assigned test." };
    }
    redirect(`/test/${existing.data.id}`);
  }

  const config = assignment.config as {
    setIds?: string[];
    types?: string[];
    difficulties?: string[];
    count?: number;
  };

  let query = supabase
    .from("questions")
    .select("id")
    .eq("status", "active")
    .in("type", config.types ?? ["mcq", "msq", "match"])
    .limit(5000);
  if (config.setIds && config.setIds.length > 0) query = query.in("set_id", config.setIds);
  if (config.difficulties && config.difficulties.length > 0 && config.difficulties.length < 3) {
    query = query.in("difficulty", config.difficulties);
  }

  const { data: questionRows } = await query;
  const ids = (questionRows ?? []).map((row) => row.id as string);
  const chosen = shuffle(ids).slice(0, Math.min(config.count ?? 10, ids.length));

  const built = await buildSession(supabase, {
    ownerId: user.id,
    questionIds: chosen,
    label: assignment.title as string,
    mode: "assigned",
    durationMinutes: assignment.duration_minutes as number | null,
    assignmentId: assignment.id as string,
  });
  if (!built.ok) return built;

  revalidatePath("/history");
  redirect(`/test/${built.sessionId}`);
}

/** Exam-panel state: flag a question to come back to. */
export async function setQuestionMarked(
  sessionId: string,
  questionId: string,
  marked: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!uuidSchema.safeParse(sessionId).success || !uuidSchema.safeParse(questionId).success) {
    return { ok: false, error: "Invalid question." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("session_questions")
    .update({ marked })
    .eq("session_id", sessionId)
    .eq("question_id", questionId);
  if (error) return { ok: false, error: "Couldn't save the flag." };
  return { ok: true };
}

export type AttemptResponse =
  | {
      ok: true;
      isCorrect: boolean;
      correct: string | string[];
      explanation: string | null;
      aiExplanation: string | null;
      aiTip: string | null;
      saved?: undefined;
    }
  /** Exam mode: recorded, but the verdict is withheld until submission. */
  | { ok: true; saved: true; isCorrect?: undefined }
  | ActionError;

/** Grades one answer server-side and stores the attempt. Repeat submissions
 *  for the same question return the original stored result. */
export async function submitAttempt(input: AttemptInput): Promise<AttemptResponse> {
  const parsed = attemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid answer payload." };
  const { sessionId, questionId, selected, reveal } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, completed_at, expires_at")
    .eq("id", sessionId)
    .single();
  if (!session) return { ok: false, error: "Test session not found." };
  if (session.completed_at) return { ok: false, error: "This test is already finished." };
  if (session.expires_at && new Date(session.expires_at as string).getTime() < Date.now()) {
    // The clock is authoritative on the server; a tampered or sleeping client
    // cannot buy extra time.
    return { ok: false, error: "Time is up — this answer wasn't counted." };
  }

  const { data: membership } = await supabase
    .from("session_questions")
    .select("question_id")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!membership) return { ok: false, error: "That question isn't part of this test." };

  const { data: questionData } = await supabase
    .from("questions")
    .select("type, options, correct, explanation, ai_explanation, ai_tip")
    .eq("id", questionId)
    .single();
  if (!questionData) return { ok: false, error: "Question not found." };
  const question = questionData as Pick<
    QuestionRow,
    "type" | "options" | "correct" | "explanation" | "ai_explanation" | "ai_tip"
  >;

  const isCorrect = gradeAnswer(question, selected);

  if (!reveal) {
    // Exam mode: the answer is recorded but nothing about correctness leaves
    // the server, and the learner may change their mind until they submit.
    const { data: changed } = await supabase
      .from("attempts")
      .update({ selected, is_correct: isCorrect })
      .eq("session_id", sessionId)
      .eq("question_id", questionId)
      .select("id");

    if (!changed || changed.length === 0) {
      const { error: insertError } = await supabase.from("attempts").insert({
        owner_id: user.id,
        question_id: questionId,
        session_id: sessionId,
        selected,
        is_correct: isCorrect,
      });
      if (insertError && insertError.code !== "23505") {
        return { ok: false, error: "Couldn't save your answer. Try again." };
      }
    }
    // Feed the spaced-repetition schedule. Awaited so the next screen sees
    // an up-to-date due count, but never allowed to fail the answer.
    await recordReview(questionId, isCorrect).catch(() => {});
    return { ok: true, saved: true };
  }

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
          aiExplanation: question.ai_explanation,
          aiTip: question.ai_tip,
        };
      }
    }
    return { ok: false, error: "Couldn't save your answer. Try again." };
  }

  await recordReview(questionId, isCorrect).catch(() => {});

  return {
    ok: true,
    isCorrect,
    correct: question.correct,
    explanation: question.explanation,
    aiExplanation: question.ai_explanation,
    aiTip: question.ai_tip,
  };
}

export type FinishResponse =
  | {
      ok: true;
      correctCount: number;
      total: number;
      /** Answered-but-wrong, needed to apply a negative-marking penalty. */
      wrongCount: number;
      negativeMarking: number;
    }
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
    .select("id, completed_at, correct_count, question_count, expires_at, negative_marking, wrong_count")
    .eq("id", parsed.data)
    .single();
  if (!session) return { ok: false, error: "Test session not found." };
  const timeUp =
    session.expires_at !== null &&
    new Date(session.expires_at as string).getTime() < Date.now();

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
  const wrongCount = answered - correctCount;
  const penaltyRate = Number(session.negative_marking ?? 0);

  if (session.completed_at) {
    return {
      ok: true,
      correctCount: session.correct_count,
      total: session.question_count,
      wrongCount: session.wrong_count ?? 0,
      negativeMarking: penaltyRate,
    };
  }
  // When the clock runs out the test closes as-is; unanswered questions simply
  // score zero, exactly like a real exam.
  if (!timeUp && answered < (total ?? 0)) {
    return { ok: false, error: "Answer every question before finishing." };
  }

  const { error } = await supabase
    .from("test_sessions")
    .update({
      correct_count: correctCount,
      wrong_count: wrongCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: "Couldn't finish the test. Try again." };

  // No revalidatePath here: it would re-render /test/[id] mid-action, whose
  // completed_at redirect would replace the client-side finish screen.
  // History and dashboard are dynamic pages and always render fresh.
  return {
    ok: true,
    correctCount,
    total: total ?? answered,
    wrongCount,
    negativeMarking: penaltyRate,
  };
}
