import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  MAX_IMPORT_BYTES,
  parseQuestionImport,
  type ImportedQuestion,
  type ImportSkip,
} from "@/lib/import/parse";
import { toQuestionRows } from "@/lib/import/to-rows";
import { importedQuestionSchema, importRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

function fileNameStem(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const stem = fileName.replace(/\.json$/i, "").trim();
  return stem.length > 0 ? stem.slice(0, 200) : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to import." }, { status: 401 });
  }

  // Content is curated: only admins import. RLS enforces this at the
  // database too; this just fails early with a human message.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can import questions." },
      { status: 403 },
    );
  }

  // Cheap size gate from the header before reading the body. The JSON wrapper
  // adds overhead over the raw file, so allow a little slack here; the exact
  // 2MB limit on the file itself is enforced below.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMPORT_BYTES + 256 * 1024) {
    return NextResponse.json({ error: "File is larger than the 2MB limit." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsedBody = importRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  }
  const { title, fileName, folderId, raw } = parsedBody.data;

  if (folderId) {
    const { data: folder } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .maybeSingle();
    if (!folder) {
      return NextResponse.json({ error: "That folder doesn't exist." }, { status: 400 });
    }
  }

  if (Buffer.byteLength(raw, "utf8") > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "File is larger than the 2MB limit." }, { status: 413 });
  }

  let fileJson: unknown;
  try {
    fileJson = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "That file isn't valid JSON. Export it again and retry.", skipped: [] },
      { status: 400 },
    );
  }

  const result = parseQuestionImport(fileJson);

  // The parser already normalized; this is the strict schema guard before
  // anything reaches the database.
  const questions: ImportedQuestion[] = [];
  const skipped: ImportSkip[] = [...result.skipped];
  for (const question of result.questions) {
    const check = importedQuestionSchema.safeParse(question);
    if (check.success) {
      questions.push(check.data as ImportedQuestion);
    } else {
      skipped.push({ index: 0, reason: "a question failed validation and was skipped" });
    }
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No usable questions found in this file.", skipped },
      { status: 400 },
    );
  }

  const setTitle = title?.trim() || result.title || fileNameStem(fileName) || "Untitled set";

  const { data: set, error: setError } = await supabase
    .from("question_sets")
    .insert({
      owner_id: user.id,
      title: setTitle,
      language: result.language,
      folder_id: folderId ?? null,
    })
    .select("id")
    .single();

  if (setError || !set) {
    return NextResponse.json(
      { error: "Couldn't create the set. Nothing was imported." },
      { status: 500 },
    );
  }

  const rows = toQuestionRows(questions, { setId: set.id, ownerId: user.id });
  const { error: questionsError } = await supabase.from("questions").insert(rows);

  if (questionsError) {
    // Honest failure: roll back the empty set rather than "succeeding" empty.
    await supabase.from("question_sets").delete().eq("id", set.id);
    return NextResponse.json(
      { error: "Couldn't save the questions. Nothing was imported.", skipped },
      { status: 500 },
    );
  }

  await supabase
    .from("question_sets")
    .update({ question_count: rows.length })
    .eq("id", set.id);

  // Best-effort: keep the original file for provenance. Import still succeeds
  // if the storage bucket isn't provisioned.
  const storagePath = `${user.id}/${set.id}.json`;
  const { error: storageError } = await supabase.storage
    .from("imports")
    .upload(storagePath, raw, { contentType: "application/json", upsert: true });
  if (!storageError) {
    await supabase
      .from("question_sets")
      .update({ source_file_ref: storagePath })
      .eq("id", set.id);
  }

  revalidatePath("/sets");
  revalidatePath("/dashboard");

  return NextResponse.json(
    { setId: set.id, title: setTitle, imported: rows.length, skipped },
    { status: 201 },
  );
}
