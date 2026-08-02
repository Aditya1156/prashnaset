"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { FOLDER_COLOR_NAMES, FOLDER_ICON_NAMES } from "@/lib/folder-style";
import { folderNameSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const uuidSchema = z.uuid();
const DUPLICATE_NAME = "You already have a folder with this name.";

const folderInputSchema = z.object({
  name: folderNameSchema,
  color: z.enum(FOLDER_COLOR_NAMES),
  icon: z.enum(FOLDER_ICON_NAMES),
});

export interface FolderInput {
  name: string;
  color: string;
  icon: string;
}

export async function createFolder(input: FolderInput): Promise<ActionResult> {
  const parsed = folderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give the folder a name (max 60 characters)." };
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { error } = await supabase
    .from("folders")
    .insert({ owner_id: admin.userId, ...parsed.data });
  if (error) {
    return { ok: false, error: error.code === "23505" ? DUPLICATE_NAME : "Couldn't create the folder." };
  }

  revalidatePath("/sets");
  revalidatePath("/import");
  return { ok: true };
}

export async function updateFolder(
  folderId: string,
  input: FolderInput,
): Promise<ActionResult> {
  const idParsed = uuidSchema.safeParse(folderId);
  const parsed = folderInputSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { ok: false, error: "Give the folder a name (max 60 characters)." };
  }

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const { data: updated, error } = await supabase
    .from("folders")
    .update(parsed.data)
    .eq("id", idParsed.data)
    .select("id");
  if (error) {
    return { ok: false, error: error.code === "23505" ? DUPLICATE_NAME : "Couldn't save the folder." };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Folder not found." };
  }

  revalidatePath("/sets");
  revalidatePath(`/sets/folder/${idParsed.data}`);
  revalidatePath("/import");
  return { ok: true };
}

/** Deletes the folder only — its sets fall back to Unfiled via the
 *  on delete set null foreign key. */
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(folderId);
  if (!parsed.success) return { ok: false, error: "Invalid folder id." };

  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

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
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

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
