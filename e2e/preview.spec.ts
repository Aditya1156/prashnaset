import path from "node:path";
import { expect, test } from "@playwright/test";
import { createAdminAccount, importFile, signIn } from "./helpers";

/** Captures the Test Center screenshot for the README. Opt-in:
 *  PREVIEW=1 npx playwright test e2e/preview.spec.ts
 *  Navigation is id-based — the shared library may contain any content. */

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");
const OUT = path.resolve(process.cwd(), "docs", "screenshots");

test.skip(process.env.PREVIEW !== "1", "preview capture is opt-in");

test("capture test-center preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const admin = await createAdminAccount("preview");
  await signIn(page, admin.email);

  await importFile(page, EXAMPLE_FILE);
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;

  await page.goto(`/test/new?set=${setId}`);
  await expect(page.getByTestId("summary-count")).toHaveText("4");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "test-center.png") });

  await page.goto("/sets");
  await expect(page.getByTestId("sets-summary")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "sets-folders.png") });

  await page.goto("/users");
  await expect(page.getByTestId("users-list")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "users.png") });
});
