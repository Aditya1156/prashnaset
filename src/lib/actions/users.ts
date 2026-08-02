"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const uuidSchema = z.uuid();

/** Promotes or demotes an account via the admin-guarded database function.
 *  The designated admin can never be demoted; admins can't demote themselves. */
export async function setRole(targetId: string, makeAdmin: boolean): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(targetId);
  if (!parsed.success) return { ok: false, error: "Invalid user id." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase.rpc("admin_set_role", {
    target_id: parsed.data,
    make_admin: makeAdmin,
  });
  if (error) {
    const message = error.message.includes("designated admin")
      ? "The designated admin can't be demoted."
      : error.message.includes("demote yourself")
        ? "You can't demote yourself."
        : "Couldn't update the role.";
    return { ok: false, error: message };
  }

  revalidatePath("/users");
  return { ok: true };
}
