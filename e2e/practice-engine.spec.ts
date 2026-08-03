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

/** Answers whatever is on screen; `correct` decides whether to answer well. */
async function answerCurrent(page: Page, correct: boolean) {
  const stem = (await page.getByTestId("stem").innerText()).trim();

  if (stem.startsWith("Match")) {
    const selects = page.getByRole("combobox");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const options = await selects.nth(i).locator("option").allTextContents();
      const choices = options.filter((o) => o !== "Choose…");
      // Deliberately misalign when we want a wrong answer.
      const pick = correct ? choices[i] : choices[(i + 1) % choices.length];
      await selects.nth(i).selectOption(pick);
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

test("exam mode: timer, palette, mark for review, jump, submit", async ({ page }) => {
  const errors = watchConsole(page);

  const admin = await createAdminAccount("exam");
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await signOut(page);

  await signUp(page, "Exam Learner", uniqueEmail("exam-user"));
  await page.goto(`/test/new?set=${setId}`);

  // Opt into the timed exam experience.
  await page.getByRole("checkbox", { name: /Timed exam mode/ }).check();
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  // The exam furniture is present.
  const clock = page.getByTestId("exam-clock");
  await expect(clock).toBeVisible();
  await expect(page.getByTestId("question-palette")).toBeVisible();

  const firstReading = (await clock.innerText()).trim();

  // Answering does NOT reveal the verdict in exam mode.
  await answerCurrent(page, true);
  await expect(page.getByTestId("feedback")).toHaveCount(0);

  // Mark for review, then jump around via the palette.
  await page.getByRole("button", { name: "Mark for review" }).click();
  await expect(page.getByRole("button", { name: "Marked for review" })).toBeVisible();

  await page.getByRole("button", { name: /^Question 3,/ }).click();
  await expect(page.getByTestId("progress-text")).toContainText("Question 3 of 4");
  await page.getByRole("button", { name: /^Question 1,/ }).click();
  await expect(page.getByTestId("progress-text")).toContainText("Question 1 of 4");
  // The answer survived the round trip. Asserted through the palette rather
  // than a specific control, since question 1 may be any of the three types.
  await expect(page.getByRole("button", { name: /^Question 1, answered/ })).toBeVisible();

  // The clock is genuinely counting down.
  await expect
    .poll(async () => (await clock.innerText()).trim(), { timeout: 15000 })
    .not.toBe(firstReading);

  // Answer the rest and submit from the palette.
  for (const index of [2, 3, 4]) {
    await page.getByRole("button", { name: new RegExp(`^Question ${index},`) }).click();
    await answerCurrent(page, true);
  }
  await page.getByRole("button", { name: "Submit test", exact: true }).first().click();
  await expect(page.getByTestId("finish-screen")).toBeVisible({ timeout: 20000 });

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});

test("mistake drill collects wrong answers and retests exactly those", async ({ page }) => {
  const errors = watchConsole(page);

  const admin = await createAdminAccount("mistakes");
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await signOut(page);

  await signUp(page, "Mistake Learner", uniqueEmail("mistake-user"));

  // Nothing missed yet, so the drill offers nothing to do.
  await expect(page.getByTestId("mistake-drill")).toContainText("Nothing missed");

  // Take a practice test answering everything wrong.
  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);
  for (let i = 0; i < 4; i++) {
    await answerCurrent(page, false);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    await page.getByTestId("advance").click();
  }
  await expect(page.getByTestId("finish-screen")).toBeVisible({ timeout: 20000 });

  // The dashboard now offers a drill of exactly those mistakes.
  await page.goto("/dashboard");
  const drill = page.getByTestId("mistake-drill");
  await expect(drill).toContainText("you got wrong in the last 7 days");
  const drillButton = drill.getByRole("button", { name: /Drill \d+ question/ });
  const label = await drillButton.innerText();
  const drillCount = Number(/\d+/.exec(label)?.[0] ?? "0");
  expect(drillCount).toBeGreaterThan(0);

  await drillButton.click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 20000 });
  await expect(page.getByTestId("progress-text")).toContainText(`of ${drillCount}`);

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});

test("admin assigns a test; the learner sees and takes it", async ({ page }) => {
  const errors = watchConsole(page);
  const runTag = Date.now().toString(36);
  const assignmentTitle = `Weekly test ${runTag}`;

  const admin = await createAdminAccount("assign");
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);

  await page.goto("/assignments");
  await page.getByRole("button", { name: "New assignment" }).click();
  await page.getByLabel("Title").fill(assignmentTitle);
  await page.locator("#assignment-count").selectOption("5");
  await page.locator("#assignment-duration").fill("10");
  await page.getByRole("button", { name: "Assign test" }).click();

  const card = page.getByTestId("assignment-card").filter({ hasText: assignmentTitle });
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card).toContainText("Everyone");
  await signOut(page);

  // A learner sees it and can start it — in exam mode, because it is timed.
  await signUp(page, "Assigned Learner", uniqueEmail("assign-user"));
  await page.goto("/assignments");
  const learnerCard = page.getByTestId("assignment-card").filter({ hasText: assignmentTitle });
  await expect(learnerCard).toBeVisible();
  await expect(learnerCard.getByRole("button", { name: "Delete" })).toHaveCount(0);

  await learnerCard.getByRole("button", { name: "Start test" }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 20000 });
  await expect(page.getByTestId("exam-clock")).toBeVisible();
  await expect(page.getByTestId("question-palette")).toBeVisible();

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});

test("leaderboard ranks real completed tests only", async ({ page }) => {
  const errors = watchConsole(page);

  const admin = await createAdminAccount("board");
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await signOut(page);

  const learnerName = `Board Learner ${Date.now().toString(36)}`;
  await signUp(page, learnerName, uniqueEmail("board-user"));

  // Before any test, this learner is absent from the standings.
  await page.goto("/leaderboard");
  await expect(page.getByText("Your standing")).toHaveCount(0);

  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);
  for (let i = 0; i < 4; i++) {
    await answerCurrent(page, true);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    await page.getByTestId("advance").click();
  }
  await expect(page.getByTestId("finish-screen")).toBeVisible({ timeout: 20000 });

  // Now they appear, with their own row highlighted.
  await page.goto("/leaderboard");
  await expect(page.getByText("Your standing")).toBeVisible();
  await expect(page.getByTestId("leaderboard-list")).toContainText(learnerName);

  // And a streak has started.
  await page.goto("/dashboard");
  await expect(page.getByTestId("streak-card")).toContainText("1");
  await expect(page.getByTestId("streak-card")).toContainText("Today is counted");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});
