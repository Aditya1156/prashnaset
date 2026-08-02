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

/** Ground truth from public/question-import-example.json. */
const MCQ_WRONG_STEM = "Which article of the Indian Constitution abolishes untouchability?";
const ANSWERS: Record<
  string,
  { type: "mcq" | "msq" | "match"; correct: string[]; pairs?: Record<string, string> }
> = {
  [MCQ_WRONG_STEM]: { type: "mcq", correct: ["Article 17"] },
  "Who is the ex-officio Chairman of the Rajya Sabha?": {
    type: "mcq",
    correct: ["The Vice-President"],
  },
  "Which of the following are Fundamental Rights under the Indian Constitution today?": {
    type: "msq",
    correct: ["Right to Equality", "Right to Freedom of Religion", "Right to Constitutional Remedies"],
  },
  "Match each constitutional body with the article that establishes it.": {
    type: "match",
    correct: [],
    pairs: {
      "Election Commission": "Article 324",
      "Union Public Service Commission": "Article 315",
      "Comptroller and Auditor-General": "Article 148",
    },
  },
};

async function answerCurrentQuestion(page: Page): Promise<boolean> {
  const stem = (await page.getByTestId("stem").innerText()).trim();
  const spec = ANSWERS[stem];
  if (!spec) throw new Error(`Unexpected stem on screen: ${stem}`);

  let answeredWrong = false;
  if (spec.type === "mcq") {
    if (stem === MCQ_WRONG_STEM) {
      await page.getByRole("radio", { name: "Article 14" }).click();
      answeredWrong = true;
    } else {
      await page.getByRole("radio", { name: spec.correct[0] }).click();
    }
  } else if (spec.type === "msq") {
    for (const option of spec.correct) {
      await page.getByRole("checkbox", { name: option }).click();
    }
  } else {
    for (const [left, right] of Object.entries(spec.pairs!)) {
      await page.getByLabel(`Match for ${left}`).selectOption(right);
    }
  }

  await page.getByRole("button", { name: "Check answer" }).click();
  const feedback = page.getByTestId("feedback");
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(answeredWrong ? "Not quite" : "Correct");
  return answeredWrong;
}

test("admin publishes → learner builds, runs (one wrong), resumes, scores 75%, reviews", async ({
  page,
}) => {
  const errors = watchConsole(page);

  // Admin publishes the material.
  const admin = await createAdminAccount("runner");
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await signOut(page);

  // A learner practices on it.
  await signUp(page, "Runner Learner", uniqueEmail("runner-user"));
  await page.goto(`/test/new?set=${setId}`);
  await expect(
    page.getByTestId("set-choices").locator("input[type=checkbox]:checked"),
  ).toHaveCount(1);

  // Only 4 questions in this scope — the length step says so honestly.
  await expect(page.getByTestId("count-all-note")).toContainText("all 4");
  await expect(page.getByTestId("summary-count")).toHaveText("4");

  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  // Answer two questions, then leave and resume — progress must survive.
  await answerCurrentQuestion(page);
  await page.getByTestId("advance").click();
  await answerCurrentQuestion(page);
  await page.getByTestId("advance").click();
  await expect(page.getByTestId("progress-text")).toContainText("Question 3 of 4");

  await page.goto("/history");
  await expect(page.getByTestId("history-list")).toContainText("2/4 answered");
  await page.getByTestId("history-list").getByRole("link").first().click();
  await page.waitForURL(/\/test\/[0-9a-f-]+$/);
  await expect(page.getByTestId("progress-text")).toContainText("Question 3 of 4");

  // Finish the remaining two.
  await answerCurrentQuestion(page);
  await page.getByTestId("advance").click();
  await answerCurrentQuestion(page);
  await page.getByTestId("advance").click();

  // Score matches the graded answers — 3 of 4 = 75%.
  const finish = page.getByTestId("finish-screen");
  await expect(finish).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("finish-summary")).toHaveText("3 of 4 correct");
  await expect(finish).toContainText("75%");

  // Review shows the wrong answer marked incorrect with the user's pick.
  await page.getByRole("link", { name: "Review answers" }).click();
  await page.waitForURL("**/history/**");
  await expect(page.getByTestId("review-score")).toHaveText("75%");
  await expect(page.getByTestId("review-question")).toHaveCount(4);
  const wrongCard = page.getByTestId("review-question").filter({ hasText: MCQ_WRONG_STEM });
  await expect(wrongCard).toContainText("Incorrect");
  await expect(wrongCard).toContainText("your pick");

  // History shows the colour-coded percentage.
  await page.goto("/history");
  await expect(page.getByTestId("history-list")).toContainText("75%");
  await expect(page.getByTestId("history-list")).toContainText("3/4 correct");

  // The learner dashboard reflects their own numbers.
  await page.goto("/dashboard");
  const stats = page.getByTestId("stats");
  await expect(stats).toContainText("Questions available");
  await expect(stats).toContainText("Tests taken");
  await expect(stats).toContainText("75%");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});
