"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readAllRows } from "@/lib/supabase/read-all";
import { createClient } from "@/lib/supabase/server";
import { shuffle } from "@/lib/utils";

const pyqSessionSchema = z.object({
  examYear: z.number().int().min(1900).max(2100),
  examName: z.string().trim().min(1).max(200),
  durationMinutes: z.number().int().min(1).max(600).nullish(),
  negativeMarking: z.number().min(0).max(1).optional().default(0),
});

export type PyqSessionInput = z.infer<typeof pyqSessionSchema>;

export interface ActionError {
  ok: false;
  error: string;
}

export async function createPyqSession(input: PyqSessionInput): Promise<ActionError> {
  const parsed = pyqSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid paper settings." };
  const { examYear, examName, durationMinutes, negativeMarking } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { rows: questionRows, error: qError } = await readAllRows<{ id: string }>(
    (from, to) =>
      supabase
        .from("questions")
        .select("id")
        .eq("status", "active")
        .eq("exam_year", examYear)
        .eq("exam_name", examName)
        .order("created_at", { ascending: true })
        .range(from, to),
  );
  if (qError) return { ok: false, error: "Couldn't load the paper's questions." };

  const ids = questionRows.map((r) => r.id);
  if (ids.length === 0) {
    return { ok: false, error: "No questions found for this paper." };
  }

  const chosen = shuffle(ids);
  const durationSeconds =
    durationMinutes && durationMinutes > 0 ? durationMinutes * 60 : null;

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .insert({
      owner_id: user.id,
      label: `${examName} ${examYear}`,
      question_count: chosen.length,
      mode: "practice",
      duration_seconds: durationSeconds,
      expires_at: durationSeconds
        ? new Date(Date.now() + durationSeconds * 1000).toISOString()
        : null,
      negative_marking: negativeMarking ?? 0,
    })
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
    return { ok: false, error: "Couldn't assemble the paper. Nothing was started." };
  }

  revalidatePath("/history");
  redirect(`/test/${session.id}`);
}
