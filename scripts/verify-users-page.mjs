// Checks the Users page guards on the live site: an admin must not be able
// to demote themselves or the designated admin, but may manage other admins
// and learners. Uses throwaway accounts that clean up even if interrupted.
//
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-users-page.mjs <ref> <site> <designatedEmail>
import { chromium } from "@playwright/test";
import { createThrowawayFactory } from "./lib/throwaway.mjs";

const [ref, site, designated] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !designated || !token) {
  console.error(
    "usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-users-page.mjs <ref> <site> <designatedEmail>",
  );
  process.exit(1);
}

const factory = await createThrowawayFactory(ref, token);
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch();
try {
  const viewer = await factory.create("viewer", { admin: true });
  // A second admin the viewer is allowed to manage, for the positive case.
  await factory.create("other", { admin: true });

  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(viewer.email);
  await page.getByLabel("Password", { exact: true }).fill(viewer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  await page.goto(`${site}/users`, { waitUntil: "networkidle" });

  // Target the control by its accessible name rather than guessing at row
  // structure: an imprecise row locator silently reports "no menu" for a row
  // it simply failed to find.
  const menuCount = async (displayName) =>
    page.getByRole("button", { name: `Actions for ${displayName}` }).count();

  const totalMenus = await page.getByRole("button", { name: /^Actions for / }).count();
  const rowCount = await page.getByTestId("users-list").getByRole("img").count();
  console.log(`  rows: ${rowCount}, action menus: ${totalMenus}`);

  check("own admin row has no actions menu", (await menuCount("Temp viewer")) === 0);
  check("designated admin row has no actions menu", (await menuCount("Aditya Kumar")) === 0);
  check("another admin row does have an actions menu", (await menuCount("Temp other")) > 0);
  check("learners have an actions menu", (await menuCount("Refactors Life")) > 0);

  // Counts should reflect reality.
  const summary = await page.getByTestId("users-summary").innerText();
  console.log(`  summary: ${summary.replace(/\s+/g, " ").trim()}`);

  check("no console errors", errors.length === 0, errors.join("; ").slice(0, 200));
} catch (e) {
  failures += 1;
  console.log("ERROR: " + String(e).slice(0, 300));
} finally {
  await browser.close();
  await factory.cleanup();
}

process.exit(failures === 0 ? 0 : 1);
