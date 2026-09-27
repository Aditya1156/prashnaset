"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { assignmentSchema, type AssignmentInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const uuidSchema = z.uuid();

/** Admin designs a test once; learners each get their own attempt at it. */
export async function createAssignment(input: AssignmentInput): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the test settings and try again." };
  const data = parsed.data;

  if (!data.assignAll && !data.batchId && data.userIds.length === 0) {
    return { ok: false, error: "Pick at least one learner, a batch, or assign to everyone." };
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: created, error } = await supabase
    .from("assignments")
    .insert({
      owner_id: admin.userId,
      title: data.title,
      instructions: data.instructions || null,
      config: {
        setIds: data.setIds,
        types: data.types,
        difficulties: data.difficulties,
        count: data.count,
      },
      duration_minutes: data.durationMinutes ?? null,
      due_at: data.dueAt ?? null,
      assign_all: data.assignAll,
      batch_id: data.batchId ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Couldn't create the assignment." };

  if (!data.assignAll && !data.batchId && data.userIds.length > 0) {
    const { error: targetError } = await supabase.from("assignment_targets").insert(
      data.userIds.map((userId) => ({ assignment_id: created.id, user_id: userId })),
    );
    if (targetError) {
      await supabase.from("assignments").delete().eq("id", created.id);
      return { ok: false, error: "Couldn't assign the test to those learners." };
    }
  }

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAssignment(assignmentId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(assignmentId);
  if (!parsed.success) return { ok: false, error: "Invalid assignment." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.from("assignments").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't delete the assignment." };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { ok: true };
}
