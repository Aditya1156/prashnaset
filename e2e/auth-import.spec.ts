import path from "node:path";
import { expect, test } from "@playwright/test";
import { importFile, signUp, uniqueEmail, watchConsole } from "./helpers";

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");
const MIXED_FILE = path.resolve(process.cwd(), "e2e", "fixtures", "mixed-good-bad.json");

test("signup → empty dashboard → import example → set detail shows answers", async ({
  page,
}) => {
  const errors = watchConsole(page);

  await signUp(page, "Asha E2E", uniqueEmail("import"));

  // Honest empty state: onboarding, no invented numbers.
  await expect(page.getByRole("link", { name: "Import your first file" })).toBeVisible();

  // M1 acceptance: drop the example file, see 4 questions imported.
  await importFile(page, EXAMPLE_FILE);
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");
  await expect(page.getByTestId("import-result")).toContainText("Indian Polity — sample set");

  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL("**/sets/**");
  await expect(page.getByTestId("question-item")).toHaveCount(4);

  // Expand the first question; the correct answer is highlighted.
  await page
    .getByTestId("question-item")
    .first()
    .getByRole("button", { name: /Which article/ })
    .click();
  const highlighted = page.locator("li[data-correct]");
  await expect(highlighted).toHaveCount(1);
  await expect(highlighted).toContainText("Article 17");

  // The sets page is folder-first: the set sits behind the Unfiled card,
  // and the summary counts are real.
  await page.goto("/sets");
  await expect(page.getByTestId("sets-summary")).toContainText("1 set");
  await expect(page.getByTestId("sets-summary")).toContainText("4 questions");
  const unfiledCard = page.getByTestId("unfiled-card");
  await expect(unfiledCard).toContainText("1 set · 4 questions");
  await unfiledCard.click();
  await page.waitForURL("**/sets/folder/unfiled");
  await expect(page.getByTestId("sets-list")).toContainText("Indian Polity — sample set");
  await expect(page.getByTestId("sets-list")).toContainText("4 questions");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});

test("a file with 2 good + 2 bad rows imports 2 and lists 2 reasons", async ({ page }) => {
  const errors = watchConsole(page);

  await signUp(page, "Mixed E2E", uniqueEmail("mixed"));
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
