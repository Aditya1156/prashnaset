"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ExamResult {
  ok: boolean;
  error?: string;
}

const uuidSchema = z.uuid();

/** Switches which exam track the learner is looking at. Self-service by
 *  design: it only scopes what content they see. */
export async function setActiveExam(examId: string): Promise<ExamResult> {
  const parsed = uuidSchema.safeParse(examId);
  if (!parsed.success) return { ok: false, error: "Invalid exam." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: exam } = await supabase
    .from("exams")
    .select("id")
    .eq("id", parsed.data)
    .eq("is_active", true)
    .maybeSingle();
  if (!exam) return { ok: false, error: "That exam is no longer available." };

  const { error } = await supabase
    .from("profiles")
    .update({ active_exam_id: parsed.data })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't switch exam." };

  // Content listings are scoped by the active exam, so everything the shell
  // renders is now stale.
  revalidatePath("/", "layout");
  return { ok: true };
}

const examSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().default(""),
});

export async function createExam(input: {
  name: string;
  description?: string;
}): Promise<ExamResult> {
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the exam name and try again." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.from("exams").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "An exam with this name already exists." };
    return { ok: false, error: "Couldn't create the exam." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Exams holding folders or sets cannot be deleted — the foreign keys
 *  restrict rather than cascade, so this reports that instead of letting a
 *  single click take a curated library with it. */
export async function deleteExam(examId: string): Promise<ExamResult> {
  const parsed = uuidSchema.safeParse(examId);
  if (!parsed.success) return { ok: false, error: "Invalid exam." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.from("exams").delete().eq("id", parsed.data);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "This exam still has folders or sets. Move or delete them first.",
      };
    }
    return { ok: false, error: "Couldn't delete the exam." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
