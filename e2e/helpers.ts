import { expect, type Page } from "@playwright/test";

export const PASSWORD = "test-password-123";

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@prashnaset.test`;
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

/** Imports a JSON file through the real UI and waits for the result panel. */
export async function importFile(page: Page, filePath: string): Promise<void> {
  await page.goto("/import");
  await page.setInputFiles("#import-file", filePath);
  await page.getByRole("button", { name: "Import questions" }).click();
  await expect(
    page.getByTestId("import-result").or(page.getByTestId("import-error")),
  ).toBeVisible({ timeout: 20_000 });
}
