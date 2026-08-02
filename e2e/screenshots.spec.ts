import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { createAdminAccount, importFile, signIn } from "./helpers";

/** Captures the README screenshots from the real running app with real data
 *  created in the run itself. Opt-in: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts */

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots");

test.skip(process.env.SCREENSHOTS !== "1", "screenshot capture is opt-in");

async function shot(page: Page, name: string) {
  await page.waitForTimeout(350); // let fonts/transitions settle
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
}

test("capture README screenshots", async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your notes/ })).toBeVisible();
  await shot(page, "landing");

  const admin = await createAdminAccount("shots");
  await signIn(page, admin.email);
  await importFile(page, EXAMPLE_FILE);
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");
  await shot(page, "import-result");

  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await page
    .getByTestId("question-item")
    .first()
    .getByRole("button", { name: /Which article/ })
    .click();
  await shot(page, "set-detail");

  await page.goto(`/test/new?set=${setId}`);
  await page.getByRole("button", { name: /Start test/ }).click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/);

  // Answer questions until done, saving one reveal screenshot along the way.
  let revealShotTaken = false;
  for (let i = 0; i < 4; i++) {
    const stem = (await page.getByTestId("stem").innerText()).trim();
    if (stem.startsWith("Which article")) {
      await page.getByRole("radio", { name: "Article 17" }).click();
    } else if (stem.startsWith("Who is the ex-officio")) {
      await page.getByRole("radio", { name: "The Vice-President" }).click();
    } else if (stem.startsWith("Which of the following")) {
      for (const option of [
        "Right to Equality",
        "Right to Freedom of Religion",
        "Right to Constitutional Remedies",
      ]) {
        await page.getByRole("checkbox", { name: option }).click();
      }
    } else {
      for (const [left, right] of [
        ["Election Commission", "Article 324"],
        ["Union Public Service Commission", "Article 315"],
        ["Comptroller and Auditor-General", "Article 148"],
      ]) {
        await page.getByLabel(`Match for ${left}`).selectOption(right);
      }
    }
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    if (!revealShotTaken) {
      await shot(page, "runner-reveal");
      revealShotTaken = true;
    }
    await page.getByTestId("advance").click();
  }

  await expect(page.getByTestId("finish-screen")).toBeVisible();
  await shot(page, "finish-screen");

  await page.getByRole("link", { name: "Review answers" }).click();
  await page.waitForURL("**/history/**");
  await shot(page, "review");

  await page.goto("/dashboard");
  await expect(page.getByTestId("stats")).toBeVisible();
  await shot(page, "dashboard");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await shot(page, "dashboard-dark");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByTestId("stats")).toBeVisible();
  await shot(page, "dashboard-mobile");
});
