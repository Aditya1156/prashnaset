import path from "node:path";
import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail, watchConsole } from "./helpers";

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");

test("folders: styled create → import into → move → edit → delete leaves sets unfiled", async ({
  page,
}) => {
  const errors = watchConsole(page);

  await signUp(page, "Folders E2E", uniqueEmail("folders"));

  // Create a folder with a custom colour and icon.
  await page.goto("/sets");
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Ancient History");
  await page.getByLabel("Colour amber").click();
  await page.getByLabel("Icon landmark").click();
  await page.getByRole("button", { name: "Create folder" }).click();

  const ancientCard = page.getByTestId("folder-card").filter({ hasText: "Ancient History" });
  await expect(ancientCard).toBeVisible();
  await expect(ancientCard).toContainText("0 sets · 0 questions");

  // Duplicate names are rejected with a human message.
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("ancient history");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByText("You already have a folder with this name.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Import straight into the folder; its card summary updates.
  await page.goto("/import");
  await page.setInputFiles("#import-file", EXAMPLE_FILE);
  await page.getByLabel("Folder (optional)").selectOption({ label: "Ancient History" });
  await page.getByRole("button", { name: "Import questions" }).click();
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");

  // The set detail shows a coloured folder chip that links to the folder.
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/);
  const folderBadge = page.getByTestId("folder-badge");
  await expect(folderBadge).toContainText("Ancient History");

  await page.goto("/sets");
  await expect(ancientCard).toContainText("1 set · 4 questions");
  await expect(page.getByTestId("sets-summary")).toContainText("1 folder");

  // Open the folder page — the set lives there.
  await ancientCard.click();
  await page.waitForURL("**/sets/folder/**");
  await expect(page.getByTestId("folder-title")).toHaveText("Ancient History");
  await expect(page.getByTestId("sets-list")).toContainText("Indian Polity — sample set");

  // Edit the folder: rename + recolour.
  await page.getByRole("button", { name: "Edit folder" }).click();
  await page.getByLabel("Folder name").fill("Ancient India");
  await page.getByLabel("Colour teal").click();
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.getByTestId("folder-title")).toHaveText("Ancient India");

  // Second folder; move the set into it from the folder page's set row.
  await page.goto("/sets");
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Polity");
  await page.getByRole("button", { name: "Create folder" }).click();
  const polityCard = page.getByTestId("folder-card").filter({ hasText: "Polity" });
  await expect(polityCard).toBeVisible();

  await page.getByTestId("folder-card").filter({ hasText: "Ancient India" }).click();
  await page.waitForURL("**/sets/folder/**");
  await page.getByLabel("Move set Indian Polity — sample set").click();
  await page.getByLabel("Destination").selectOption({ label: "Polity" });
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
  const unfiledCard = page.getByTestId("unfiled-card");
  await expect(unfiledCard).toContainText("1 set · 4 questions");
  await unfiledCard.click();
  await page.waitForURL("**/sets/folder/unfiled");
  await expect(page.getByTestId("sets-list")).toContainText("Indian Polity — sample set");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});
