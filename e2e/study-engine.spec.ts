import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
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

/** Answers the current question; `correct` decides whether to answer well. */
async function answerCurrent(page: Page, correct: boolean) {
  const stem = (await page.getByTestId("stem").innerText()).trim();

  if (stem.startsWith("Match")) {
    const selects = page.getByRole("combobox");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const options = await selects.nth(i).locator("option").allTextContents();
      const choices = options.filter((o) => o !== "Choose…");
      await selects.nth(i).selectOption(correct ? choices[i] : choices[(i + 1) % choices.length]);
    }
    return;
  }

  const radios = page.getByRole("radio");
  if ((await radios.count()) > 0) {
    await radios.nth(correct ? 0 : 1).click();
    return;
  }
  await page.getByRole("checkbox").first().click();
}

/** Publishes the example set as an admin and returns its id. */
async function publishSet(page: Page, tag: string): Promise<string> {
  const admin = await createAdminAccount(tag);
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await signOut(page);
  return setId;
}

test("answering schedules a review, and the dashboard offers today's queue", async ({ page }) => {
  const errors = watchConsole(page);
  const setId = await publishSet(page, "sr-admin");

  await signUp(page, "Review Learner", uniqueEmail("review"));

  // Before answering anything, nothing is tracked and nothing is due.
  const dueCard = page.getByTestId("review-due");
  await expect(dueCard).toContainText("Answer some questions");

  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  // Answer one question wrongly. A miss drops the question to box 0, which is
  // due tomorrow — so it must NOT appear in today's queue.
  await answerCurrent(page, false);
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();

  await page.goto("/dashboard");
  await expect(dueCard).toContainText("Nothing due today");
  await expect(dueCard).toContainText("1 question");

  expect(errors).toEqual([]);
});

test("bookmarks and notes persist, and surface on the progress page", async ({ page }) => {
  const errors = watchConsole(page);
  const setId = await publishSet(page, "bm-admin");

  await signUp(page, "Bookmark Learner", uniqueEmail("bookmark"));
  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  await answerCurrent(page, true);
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();

  const stem = (await page.getByTestId("stem").innerText()).trim();

  const bookmark = page.getByTestId("bookmark-toggle");
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await bookmark.click();
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByLabel("Your note").fill("Mnemonic: check the chronology first.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  // Both must survive the round trip: /progress is rendered from the database
  // on the server, so what shows there is what was actually stored.
  await page.goto("/progress");
  const list = page.getByTestId("bookmark-list");
  await expect(list).toContainText(stem.slice(0, 40));
  await expect(list).toContainText("Mnemonic: check the chronology first.");
  await expect(list.getByTestId("bookmark-toggle")).toHaveAttribute("aria-pressed", "true");

  // Un-bookmarking removes it, and does not take the note's row with it.
  await list.getByTestId("bookmark-toggle").click();
  await page.reload();
  await expect(page.getByText("No bookmarks yet")).toBeVisible();

  expect(errors).toEqual([]);
});

test("negative marking reports a net score, not just a hit rate", async ({ page }) => {
  const errors = watchConsole(page);
  const setId = await publishSet(page, "neg-admin");

  await signUp(page, "Mock Learner", uniqueEmail("negative"));
  await page.goto(`/test/new?set=${setId}`);

  await page.getByTestId("negative-marking-toggle").check();
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  // Get the first one wrong so there is a penalty to show, then work through
  // the rest — practice mode only offers "Finish test" on the last question.
  const total = Number(
    (await page.getByTestId("progress-text").innerText()).match(/of (\d+)/)![1],
  );
  for (let i = 0; i < total; i++) {
    await answerCurrent(page, i > 0);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    await page.getByTestId("advance").click();
  }

  const net = page.getByTestId("net-score");
  await expect(net).toBeVisible({ timeout: 20_000 });

  // Check the arithmetic rather than a hard-coded figure: how many the
  // fixture's first option gets right is not this test's business.
  const summary = await page.getByTestId("finish-summary").innerText();
  const [, correctText, totalText] = summary.match(/(\d+) of (\d+) correct/)!;
  const correct = Number(correctText);
  const wrong = Number(totalText) - correct;
  expect(wrong).toBeGreaterThan(0);

  const cells = (await net.innerText()).replace(/\s+/g, " ").toLowerCase();
  expect(cells).toContain(`raw ${correct.toFixed(2)}`);
  expect(cells).toContain(`penalty -${(wrong / 3).toFixed(2)}`);
  expect(cells).toContain(`net ${Math.max(0, correct - wrong / 3).toFixed(2)}`);

  expect(errors).toEqual([]);
});

test("the progress page groups accuracy by topic", async ({ page }) => {
  const errors = watchConsole(page);
  const setId = await publishSet(page, "topic-admin");

  await signUp(page, "Topic Learner", uniqueEmail("topic"));

  // Nothing answered yet — an honest empty state, not a zeroed table.
  await page.goto("/progress");
  await expect(page.getByText("No topic data yet")).toBeVisible();

  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);
  await answerCurrent(page, true);
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByTestId("topic-table")).toBeVisible();
  await expect(page.getByTestId("topic-table")).toContainText("%");

  // The daily target is opt-in and writes through.
  await page.getByRole("button", { name: "20/day" }).click();
  await expect(page.getByTestId("daily-target")).toContainText("/20");
  await page.reload();
  await expect(page.getByTestId("daily-target")).toContainText("/20");

  expect(errors).toEqual([]);
});

test("an unexplained question offers to have one written on demand", async ({ page }) => {
  const errors = watchConsole(page);
  const setId = await publishSet(page, "ai-admin");

  await signUp(page, "Curious Learner", uniqueEmail("explain"));
  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  await answerCurrent(page, true);
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();

  // Freshly imported questions carry no AI explanation, so the offer stands
  // in place of the panel. The button is not clicked here on purpose: the
  // suite stays free of live model calls.
  await expect(page.getByTestId("ai-explain")).toBeVisible();
  await expect(page.getByTestId("ai-insight")).toHaveCount(0);

  expect(errors).toEqual([]);
});
