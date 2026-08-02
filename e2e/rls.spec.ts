import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "./helpers";

/** Proves at the database layer — not the UI — that user B cannot read or
 *  modify user A's rows, and that anonymous clients get nothing at all. */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

function freshClient(): SupabaseClient {
  return createClient(URL, KEY, { auth: { persistSession: false } });
}

async function signUpUser(tag: string): Promise<{ client: SupabaseClient; id: string }> {
  const client = freshClient();
  const { data, error } = await client.auth.signUp({
    email: uniqueEmail(tag),
    password: PASSWORD,
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Sign-up failed for ${tag}: ${error?.message}`);
  }
  return { client, id: data.user.id };
}

test("cross-user RLS: user B cannot read, modify or forge user A's rows", async () => {
  const a = await signUpUser("rls-a");
  const b = await signUpUser("rls-b");

  // A creates a set with one question.
  const { data: set, error: setError } = await a.client
    .from("question_sets")
    .insert({ owner_id: a.id, title: "A's private set" })
    .select("id")
    .single();
  expect(setError).toBeNull();
  const setId = set!.id as string;

  const { data: question, error: questionError } = await a.client
    .from("questions")
    .insert({
      set_id: setId,
      owner_id: a.id,
      type: "mcq",
      stem: "A's secret question?",
      options: ["yes", "no"],
      correct: "yes",
    })
    .select("id")
    .single();
  expect(questionError).toBeNull();
  const questionId = question!.id as string;

  // B sees nothing — even querying by exact id.
  const { data: bSets } = await b.client.from("question_sets").select("*");
  expect(bSets).toEqual([]);
  const { data: bById } = await b.client.from("question_sets").select("*").eq("id", setId);
  expect(bById).toEqual([]);
  const { data: bQuestions } = await b.client.from("questions").select("*").eq("id", questionId);
  expect(bQuestions).toEqual([]);

  // B cannot modify A's rows: updates and deletes touch zero rows.
  const { data: updated } = await b.client
    .from("question_sets")
    .update({ title: "hijacked" })
    .eq("id", setId)
    .select();
  expect(updated).toEqual([]);

  const { data: deleted } = await b.client
    .from("question_sets")
    .delete()
    .eq("id", setId)
    .select();
  expect(deleted).toEqual([]);

  // B cannot forge rows into A's account or A's set.
  const { error: forgeSetError } = await b.client
    .from("question_sets")
    .insert({ owner_id: a.id, title: "forged" });
  expect(forgeSetError).not.toBeNull();

  const { error: forgeQuestionError } = await b.client.from("questions").insert({
    set_id: setId,
    owner_id: b.id,
    type: "mcq",
    stem: "planted",
    options: ["x", "y"],
    correct: "x",
  });
  expect(forgeQuestionError).not.toBeNull();

  // Anonymous clients have no table access at all.
  const anon = freshClient();
  const { data: anonData, error: anonError } = await anon.from("question_sets").select("*");
  expect(anonError).not.toBeNull();
  expect(anonData).toBeNull();

  // Sanity: A still sees its own data intact.
  const { data: aSets } = await a.client.from("question_sets").select("title").eq("id", setId);
  expect(aSets).toEqual([{ title: "A's private set" }]);
});
