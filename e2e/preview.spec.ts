import path from "node:path";
import { expect, test } from "@playwright/test";
import { importFile, signUp, uniqueEmail } from "./helpers";

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");
const OUT = path.resolve(process.cwd(), "docs", "screenshots");

test.skip(process.env.PREVIEW !== "1", "preview capture is opt-in");

test("capture folder overview preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signUp(page, "Preview", uniqueEmail("preview"));

  for (const [name, color, icon] of [
    ["Ancient History", "amber", "landmark"],
    ["Geography", "teal", "globe"],
    ["Polity", "indigo", "scale"],
  ]) {
    await page.goto("/sets");
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByLabel(`Colour ${color}`).click();
    await page.getByLabel(`Icon ${icon}`).click();
    await page.getByRole("button", { name: "Create folder" }).click();
    await expect(page.getByTestId("folder-card").filter({ hasText: name })).toBeVisible();
  }

  await page.goto("/import");
  await page.setInputFiles("#import-file", EXAMPLE_FILE);
  await page.getByLabel("Folder (optional)").selectOption({ label: "Ancient History" });
  await page.getByRole("button", { name: "Import questions" }).click();
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");
  await importFile(page, EXAMPLE_FILE);

  await page.goto("/sets");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "sets-folders.png") });

  await page.getByTestId("folder-card").filter({ hasText: "Ancient History" }).click();
  await page.waitForURL("**/sets/folder/**");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "folder-detail.png") });
});
