import path from "node:path";
import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail, watchConsole } from "./helpers";

const EXAMPLE_FILE = path.resolve(process.cwd(), "public", "question-import-example.json");

test("folders: create → import into → move between → delete leaves sets unfiled", async ({
  page,
}) => {
  const errors = watchConsole(page);

  await signUp(page, "Folders E2E", uniqueEmail("folders"));

  // Create a folder from the Sets page.
  await page.goto("/sets");
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Ancient History");
  await page.getByRole("button", { name: "Create folder" }).click();
  const ancientSection = page
    .getByTestId("folder-section")
    .filter({ hasText: "Ancient History" });
  await expect(ancientSection).toBeVisible();
  await expect(ancientSection).toContainText("Nothing in here yet");

  // Duplicate names are rejected with a human message.
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("ancient history");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByText("You already have a folder with this name.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Import straight into the folder.
  await page.goto("/import");
  await page.setInputFiles("#import-file", EXAMPLE_FILE);
  await page.getByLabel("Folder (optional)").selectOption({ label: "Ancient History" });
  await page.getByRole("button", { name: "Import questions" }).click();
  await expect(page.getByTestId("import-result")).toContainText("4 questions imported");

  // The set detail shows its folder.
  await page.getByRole("link", { name: "View set" }).click();
  await page.waitForURL("**/sets/**");
  await expect(page.getByTestId("folder-badge")).toContainText("Ancient History");

  // The set sits inside the folder section on the Sets page.
  await page.goto("/sets");
  await expect(
    ancientSection.getByRole("link", { name: /Indian Polity — sample set/ }),
  ).toBeVisible();

  // Second folder, then move the set into it from the list row.
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Polity");
  await page.getByRole("button", { name: "Create folder" }).click();
  const politySection = page.getByTestId("folder-section").filter({ hasText: "Polity" });
  await expect(politySection).toBeVisible();

  await page.getByLabel("Move set Indian Polity — sample set").click();
  await page.getByLabel("Destination").selectOption({ label: "Polity" });
  await page.getByRole("button", { name: "Move set", exact: true }).click();
  await expect(
    politySection.getByRole("link", { name: /Indian Polity — sample set/ }),
  ).toBeVisible();
  await expect(ancientSection).toContainText("Nothing in here yet");

  // Deleting the folder keeps the set — it becomes Unfiled.
  await page.getByLabel("Delete folder Polity").click();
  await expect(
    page.getByText("stay safe under", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete folder", exact: true }).click();
  await expect(politySection).toHaveCount(0);
  const unfiled = page.getByTestId("unfiled-section");
  await expect(
    unfiled.getByRole("link", { name: /Indian Polity — sample set/ }),
  ).toBeVisible();
  await expect(unfiled).toContainText("4 questions");

  expect(errors, `Console errors: ${errors.join("\n")}`).toEqual([]);
});
