"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const batchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
});

export async function createBatch(input: {
  name: string;
  description?: string;
}): Promise<ActionResult> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the batch name and try again." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.from("batches").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "A batch with this name already exists." };
    return { ok: false, error: "Couldn't create the batch." };
  }

  revalidatePath("/batches");
  return { ok: true };
}

export async function deleteBatch(batchId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(batchId);
  if (!parsed.success) return { ok: false, error: "Invalid batch." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.from("batches").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't delete the batch." };

  revalidatePath("/batches");
  return { ok: true };
}

/** Moves a learner into a batch, or out of every batch when batchId is null.
 *  Goes through the admin-guarded definer function because profiles RLS only
 *  ever lets somebody update their own row. */
export async function setLearnerBatch(
  userId: string,
  batchId: string | null,
): Promise<ActionResult> {
  const parsedUser = z.uuid().safeParse(userId);
  if (!parsedUser.success) return { ok: false, error: "Invalid learner." };
  if (batchId !== null && !z.uuid().safeParse(batchId).success) {
    return { ok: false, error: "Invalid batch." };
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.rpc("admin_set_batch", {
    target_id: parsedUser.data,
    new_batch_id: batchId,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("batch not found")
        ? "That batch no longer exists."
        : "Couldn't move the learner.",
    };
  }

  revalidatePath("/batches");
  revalidatePath("/users");
  return { ok: true };
}

export async function toggleBatchActive(
  batchId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(batchId);
  if (!parsed.success) return { ok: false, error: "Invalid batch." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase
    .from("batches")
    .update({ is_active: isActive })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't update the batch." };

  revalidatePath("/batches");
  return { ok: true };
}
