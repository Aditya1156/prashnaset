import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  createAdminAccount,
  importFile,
  signIn,
  signOut,
  signUp,
  uniqueEmail,
  watchConsole,
} from "./helpers";

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");
const MIXED_FILE = path.resolve(process.cwd(), "e2e", "fixtures", "mixed-good-bad.json");

test("admin imports; learner browses the shared library with answers hidden", async ({
  page,
}) => {
  const errors = watchConsole(page);

  // Admin side: import the example file.
  const admin = await createAdminAccount("import");
  await signIn(page, admin.email);
  await expect(page.getByTestId("admin-badge")).toBeVisible();
  await importFile(page, EXAMPLE_FILE);
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  // Admin sees answers highlighted and can edit.
  await page
    .getByTestId("question-item")
    .first()
    .getByRole("button", { name: /Which article/ })
    .click();
  await expect(page.locator("li[data-correct]").first()).toContainText("Article 17");
  await signOut(page);

  // Learner side: fresh normal account sees the admin's content.
  await signUp(page, "Learner One", uniqueEmail("learner"));

  // No import access: nav hides it and the page redirects.
  await expect(page.getByRole("link", { name: "Import" })).toHaveCount(0);
  await page.goto("/import");
  await page.waitForURL("**/dashboard");

  // The shared set is browsable…
  await page.goto(`/sets/${setId}`);
  await expect(page.getByRole("heading", { name: "Indian Polity — sample set" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Practice this set" })).toBeVisible();
  // …but answers stay hidden and there are no manage controls.
  await expect(page.getByTestId("question-preview-list")).toBeVisible();
  await expect(page.locator("li[data-correct]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete set" })).toHaveCount(0);

  // Library overview shows folder cards, but no folder management for users.
  await page.goto("/sets");
  await expect(page.getByTestId("sets-summary")).toBeVisible();
  await expect(page.getByRole("button", { name: "New folder" })).toHaveCount(0);

  // Admin-only surfaces stay hidden and guarded for learners.
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.goto("/users");
  await page.waitForURL("**/dashboard");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});

test("a file with 2 good + 2 bad rows imports 2 and lists 2 reasons", async ({ page }) => {
  const errors = watchConsole(page);

  const admin = await createAdminAccount("mixed");
  await signIn(page, admin.email);
  await importFile(page, MIXED_FILE);

  const result = page.getByTestId("import-result");
  await expect(result).toContainText("2 questions imported");
  await expect(result).toContainText("2 skipped");

  const reasons = page.getByTestId("skip-reasons").locator("li");
  await expect(reasons).toHaveCount(2);
  await expect(reasons.nth(0)).toContainText("Question 2: answer doesn't match any option");
  await expect(reasons.nth(1)).toContainText("Question 3: needs between 2 and 8 options");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});

test("re-importing the same file is caught as duplicates", async ({ page }) => {
  const errors = watchConsole(page);

  const admin = await createAdminAccount("dupes");
  await signIn(page, admin.email);

  // First import lands (duplicates allowed so earlier specs can't interfere).
  await importFile(page, EXAMPLE_FILE);
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");

  // Second import of the very same file, with detection on, imports nothing.
  await page.goto("/import");
  await page.setInputFiles("#import-file", EXAMPLE_FILE);
  await page.getByRole("button", { name: "Import questions" }).click();
  const failure = page.getByTestId("import-error");
  await expect(failure).toBeVisible({ timeout: 20_000 });
  await expect(failure).toContainText("already in the bank");
  await expect(page.getByTestId("skip-reasons")).toContainText("already in the question bank");

  // The rejection is delivered as HTTP 400, which the browser logs by design;
  // everything else must still be clean.
  const unexpected = errors.filter((e) => !e.includes("400"));
  expect(unexpected, `Console errors: ${unexpected.join("\n")}`).toEqual([]);
});

test("landing page renders honestly for signed-out visitors", async ({ page }) => {
  const errors = watchConsole(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your notes\. Your questions\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create your free account" })).toBeVisible();

  // Protected pages bounce to sign-in.
  await page.goto("/dashboard");
  await page.waitForURL("**/signin**");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});
