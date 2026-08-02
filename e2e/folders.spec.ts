import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  createAdminAccount,
  signIn,
  signOut,
  signUp,
  uniqueEmail,
  watchConsole,
} from "./helpers";

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");

test("admin folder lifecycle; learners see folders read-only", async ({ page }) => {
  const errors = watchConsole(page);

  // Unique names per run — the library is shared and persists across runs.
  const runTag = Date.now().toString(36);
  const historyName = `Ancient History ${runTag}`;
  const renamedName = `Ancient India ${runTag}`;
  const polityName = `Polity ${runTag}`;

  const admin = await createAdminAccount("folders");
  await signIn(page, admin.email);

  // Create a folder with a custom colour and icon.
  await page.goto("/sets");
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill(historyName);
  await page.getByLabel("Colour amber").click();
  await page.getByLabel("Icon landmark").click();
  await page.getByRole("button", { name: "Create folder" }).click();

  const historyCard = page.getByTestId("folder-card").filter({ hasText: historyName });
  await expect(historyCard).toBeVisible();
  await expect(historyCard).toContainText("0 sets · 0 questions");

  // Duplicate names are rejected with a human message.
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill(historyName.toLowerCase());
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByText("You already have a folder with this name.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Import straight into the folder; its card summary updates.
  await page.goto("/import");
  await page.setInputFiles("#import-file", EXAMPLE_FILE);
  await page.getByLabel("Folder (optional)").selectOption({ label: historyName });
  await page.getByRole("button", { name: "Import questions" }).click();
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const setId = page.url().split("/").pop()!;
  await expect(page.getByTestId("folder-badge")).toContainText(historyName);

  await page.goto("/sets");
  await expect(historyCard).toContainText("1 set · 4 questions");

  // Open the folder page — the set lives there.
  await historyCard.click();
  await page.waitForURL("**/sets/folder/**");
  await expect(page.getByTestId("folder-title")).toHaveText(historyName);
  await expect(page.locator(`a[href="/sets/${setId}"]`)).toBeVisible();

  // Edit the folder: rename + recolour.
  await page.getByRole("button", { name: "Edit folder" }).click();
  await page.getByLabel("Folder name").fill(renamedName);
  await page.getByLabel("Colour teal").click();
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.getByTestId("folder-title")).toHaveText(renamedName);

  // Second folder; move the set into it from the folder page's set row.
  await page.goto("/sets");
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill(polityName);
  await page.getByRole("button", { name: "Create folder" }).click();
  const polityCard = page.getByTestId("folder-card").filter({ hasText: polityName });
  await expect(polityCard).toBeVisible();

  await page.getByTestId("folder-card").filter({ hasText: renamedName }).click();
  await page.waitForURL("**/sets/folder/**");
  await page.getByLabel("Move set Indian Polity — sample set").click();
  await page.getByLabel("Destination").selectOption({ label: polityName });
  await page.getByRole("button", { name: "Move set", exact: true }).click();
  await expect(page.getByText("This folder is empty")).toBeVisible();

  await page.goto("/sets");
  await expect(polityCard).toContainText("1 set · 4 questions");

  // Deleting the folder keeps the set — it becomes Unfiled.
  await polityCard.click();
  await page.waitForURL("**/sets/folder/**");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("stay safe under", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Delete folder", exact: true }).click();
  await page.waitForURL("**/sets");

  await expect(polityCard).toHaveCount(0);
  await page.getByTestId("unfiled-card").click();
  await page.waitForURL("**/sets/folder/unfiled");
  await expect(page.locator(`a[href="/sets/${setId}"]`)).toBeVisible();

  await signOut(page);

  // A learner sees the folder card but has no management controls anywhere.
  await signUp(page, "Folder Learner", uniqueEmail("folders-user"));
  await page.goto("/sets");
  await expect(
    page.getByTestId("folder-card").filter({ hasText: renamedName }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New folder" })).toHaveCount(0);
  await page.getByTestId("folder-card").filter({ hasText: renamedName }).click();
  await page.waitForURL("**/sets/folder/**");
  await expect(page.getByRole("button", { name: "Edit folder" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});
