import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  createAdminAccount,
  PASSWORD,
  SUPABASE_KEY,
  SUPABASE_URL,
  uniqueEmail,
} from "./helpers";

/** Proves the product's security model at the database layer:
 *  content is shared-read but admin-only-write; activity stays private. */

function freshClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
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

test("content is shared-read admin-write; practice activity stays private", async () => {
  // Admin with content.
  const adminAccount = await createAdminAccount("rls-admin");
  const admin = freshClient();
  const { data: adminSession, error: adminSignInError } = await admin.auth.signInWithPassword({
    email: adminAccount.email,
    password: adminAccount.password,
  });
  expect(adminSignInError).toBeNull();
  const adminId = adminSession!.user!.id;

  const { data: set, error: setError } = await admin
    .from("question_sets")
    .insert({ owner_id: adminId, title: `RLS bank set ${Date.now()}` })
    .select("id")
    .single();
  expect(setError).toBeNull();
  const setId = set!.id as string;

  const { data: question, error: questionError } = await admin
    .from("questions")
    .insert({
      set_id: setId,
      owner_id: adminId,
      type: "mcq",
      stem: "Shared bank question?",
      options: ["yes", "no"],
      correct: "yes",
    })
    .select("id")
    .single();
  expect(questionError).toBeNull();
  const questionId = question!.id as string;

  const b = await signUpUser("rls-b");
  const c = await signUpUser("rls-c");

  // Shared read: a regular user CAN see the admin's content.
  const { data: bSet } = await b.client.from("question_sets").select("id").eq("id", setId);
  expect(bSet).toHaveLength(1);
  const { data: bQuestion } = await b.client
    .from("questions")
    .select("id, correct")
    .eq("id", questionId);
  expect(bQuestion).toHaveLength(1);

  // Admin-only write: the user cannot create, modify or delete content.
  const { error: bInsertSet } = await b.client
    .from("question_sets")
    .insert({ owner_id: b.id, title: "user-created set" });
  expect(bInsertSet).not.toBeNull();

  const { error: bInsertFolder } = await b.client
    .from("folders")
    .insert({ owner_id: b.id, name: `user folder ${Date.now()}` });
  expect(bInsertFolder).not.toBeNull();

  const { error: bInsertQuestion } = await b.client.from("questions").insert({
    set_id: setId,
    owner_id: b.id,
    type: "mcq",
    stem: "planted",
    options: ["x", "y"],
    correct: "x",
  });
  expect(bInsertQuestion).not.toBeNull();

  const { data: bUpdate } = await b.client
    .from("question_sets")
    .update({ title: "hijacked" })
    .eq("id", setId)
    .select();
  expect(bUpdate).toEqual([]);

  const { data: bDelete } = await b.client
    .from("question_sets")
    .delete()
    .eq("id", setId)
    .select();
  expect(bDelete).toEqual([]);

  // Practice is allowed: B builds a session on the admin's question.
  const { data: bSession, error: bSessionError } = await b.client
    .from("test_sessions")
    .insert({ owner_id: b.id, label: "B's practice", question_count: 1 })
    .select("id")
    .single();
  expect(bSessionError).toBeNull();
  const bSessionId = bSession!.id as string;

  const { error: bMemberError } = await b.client
    .from("session_questions")
    .insert({ session_id: bSessionId, question_id: questionId, sort_order: 0 });
  expect(bMemberError).toBeNull();

  const { error: bAttemptError } = await b.client.from("attempts").insert({
    owner_id: b.id,
    question_id: questionId,
    session_id: bSessionId,
    selected: "yes",
    is_correct: true,
  });
  expect(bAttemptError).toBeNull();

  // Activity stays private: C sees none of B's practice.
  const { data: cSessions } = await c.client
    .from("test_sessions")
    .select("id")
    .eq("id", bSessionId);
  expect(cSessions).toEqual([]);
  const { data: cAttempts } = await c.client
    .from("attempts")
    .select("id")
    .eq("session_id", bSessionId);
  expect(cAttempts).toEqual([]);

  // C cannot forge a session for B.
  const { error: cForge } = await c.client
    .from("test_sessions")
    .insert({ owner_id: b.id, label: "forged", question_count: 1 });
  expect(cForge).not.toBeNull();

  // A user cannot escalate their own account: role and subscription columns
  // are locked down; only display_name is writable.
  const { error: selfPromote } = await b.client
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", b.id);
  expect(selfPromote).not.toBeNull();

  const { error: selfSubscribe } = await b.client
    .from("profiles")
    .update({ subscription_status: "active" })
    .eq("id", b.id);
  expect(selfSubscribe).not.toBeNull();

  const { error: renameSelf } = await b.client
    .from("profiles")
    .update({ display_name: "Renamed B" })
    .eq("id", b.id);
  expect(renameSelf).toBeNull();

  // Anonymous clients still get nothing at all.
  const anon = freshClient();
  const { data: anonData, error: anonError } = await anon.from("question_sets").select("*");
  expect(anonError).not.toBeNull();
  expect(anonData).toBeNull();

  // Sanity: the admin's content is intact.
  const { data: adminSet } = await admin
    .from("question_sets")
    .select("title")
    .eq("id", setId);
  expect(adminSet).toHaveLength(1);
  expect((adminSet![0].title as string).startsWith("RLS bank set")).toBe(true);
});
