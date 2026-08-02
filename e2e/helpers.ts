import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "test-password-123";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

/** The well-known service_role JWT every local `supabase start` stack ships
 *  with (signed by the public demo secret). It is NOT a secret and is only
 *  valid against local stacks; tests use it to seed admin accounts. The app
 *  itself never touches a service key. */
const LOCAL_DEMO_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_DEMO_SERVICE_ROLE;
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(SUPABASE_URL)) {
    throw new Error("e2e admin seeding only runs against a local Supabase stack");
  }
  return key;
}

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@prashnaset.test`;
}

/** Creates a confirmed account and promotes it to admin, service-side.
 *  Returns credentials for a normal UI sign-in. */
export async function createAdminAccount(tag: string): Promise<{ email: string; password: string }> {
  const service = createClient(SUPABASE_URL, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = uniqueEmail(tag);
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `Admin ${tag}` },
  });
  if (error || !data.user) throw new Error(`Couldn't create admin account: ${error?.message}`);

  const { error: promoteError } = await service
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", data.user.id);
  if (promoteError) throw new Error(`Couldn't promote admin: ${promoteError.message}`);

  return { email, password: PASSWORD };
}

/** Collects console errors and uncaught page errors. Assert it stays empty —
 *  "zero console errors" is part of every milestone's acceptance. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

export async function signUp(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL(/\/($|signin)/, { timeout: 15_000 });
}

/** Imports a JSON file through the real UI and waits for the result panel.
 *  Caller must be signed in as an admin. */
export async function importFile(page: Page, filePath: string): Promise<void> {
  await page.goto("/import");
  await page.setInputFiles("#import-file", filePath);
  await page.getByRole("button", { name: "Import questions" }).click();
  await expect(
    page.getByTestId("import-result").or(page.getByTestId("import-error")),
  ).toBeVisible({ timeout: 20_000 });
}
