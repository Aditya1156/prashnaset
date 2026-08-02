"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { folderNameSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const uuidSchema = z.uuid();
const DUPLICATE_NAME = "You already have a folder with this name.";

export async function createFolder(name: string): Promise<ActionResult> {
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Give the folder a name (max 60 characters)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("folders")
    .insert({ owner_id: user.id, name: parsed.data });
  if (error) {
    return { ok: false, error: error.code === "23505" ? DUPLICATE_NAME : "Couldn't create the folder." };
  }

  revalidatePath("/sets");
  revalidatePath("/import");
  return { ok: true };
}

export async function renameFolder(folderId: string, name: string): Promise<ActionResult> {
  const idParsed = uuidSchema.safeParse(folderId);
  const nameParsed = folderNameSchema.safeParse(name);
  if (!idParsed.success || !nameParsed.success) {
    return { ok: false, error: "Give the folder a name (max 60 characters)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("folders")
    .update({ name: nameParsed.data })
    .eq("id", idParsed.data);
  if (error) {
    return { ok: false, error: error.code === "23505" ? DUPLICATE_NAME : "Couldn't rename the folder." };
  }

  revalidatePath("/sets");
  revalidatePath("/import");
  return { ok: true };
}

/** Deletes the folder only — its sets fall back to Unfiled via the
 *  on delete set null foreign key. */
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(folderId);
  if (!parsed.success) return { ok: false, error: "Invalid folder id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase.from("folders").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't delete the folder." };

  revalidatePath("/sets");
  revalidatePath("/import");
  return { ok: true };
}

/** Moves a set into a folder, or to Unfiled when folderId is null. */
export async function moveSet(setId: string, folderId: string | null): Promise<ActionResult> {
  const setParsed = uuidSchema.safeParse(setId);
  if (!setParsed.success) return { ok: false, error: "Invalid set id." };
  if (folderId !== null && !uuidSchema.safeParse(folderId).success) {
    return { ok: false, error: "Invalid folder id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  if (folderId !== null) {
    const { data: folder } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .maybeSingle();
    if (!folder) return { ok: false, error: "That folder doesn't exist." };
  }

  const { data: updated, error } = await supabase
    .from("question_sets")
    .update({ folder_id: folderId })
    .eq("id", setParsed.data)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { ok: false, error: "Couldn't move the set." };
  }

  revalidatePath("/sets");
  revalidatePath(`/sets/${setParsed.data}`);
  return { ok: true };
}
