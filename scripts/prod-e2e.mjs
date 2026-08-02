// End-to-end check against the LIVE site: admin signs in and sees the real
// library; a brand-new learner can sign up and reach the test builder.
// Usage: node scripts/prod-e2e.mjs <site> <adminEmail> <adminPassword>
import { chromium } from "@playwright/test";

const [site, adminEmail, adminPassword] = process.argv.slice(2);
if (!site || !adminEmail || !adminPassword) {
  console.error("usage: node scripts/prod-e2e.mjs <site> <adminEmail> <adminPassword>");
  process.exit(1);
}

const browser = await chromium.launch();
const errors = [];
let failures = 0;

async function newPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${String(e)}`));
  return page;
}

// --- admin ---
const admin = await newPage();
await admin.goto(`${site}/signin`, { waitUntil: "networkidle" });
await admin.getByLabel("Email").fill(adminEmail);
await admin.getByLabel("Password", { exact: true }).fill(adminPassword);
await admin.getByRole("button", { name: "Sign in" }).click();
try {
  await admin.waitForURL("**/dashboard", { timeout: 25000 });
  const stats = await admin.getByTestId("stats").innerText();
  const isAdmin = (await admin.getByTestId("admin-badge").count()) > 0;
  console.log(`ADMIN SIGN-IN OK — admin badge: ${isAdmin}`);
  console.log("dashboard stats: " + stats.replace(/\s+/g, " ").trim());
  await admin.goto(`${site}/sets`, { waitUntil: "networkidle" });
  console.log("library summary: " + (await admin.getByTestId("sets-summary").innerText()).replace(/\s+/g, " ").trim());
} catch (e) {
  failures += 1;
  console.log("ADMIN SIGN-IN FAILED: " + String(e).slice(0, 200));
}

// --- new learner (proves signup works without a confirmation email) ---
const learner = await newPage();
const learnerEmail = `check-${Date.now()}@prashnaset.test`;
await learner.goto(`${site}/signup`, { waitUntil: "networkidle" });
await learner.getByLabel("Name").fill("Signup Check");
await learner.getByLabel("Email").fill(learnerEmail);
await learner.getByLabel("Password", { exact: true }).fill("check-password-123");
await learner.getByLabel("Confirm password").fill("check-password-123");
await learner.getByRole("button", { name: "Create account" }).click();
try {
  await learner.waitForURL("**/dashboard", { timeout: 25000 });
  await learner.goto(`${site}/test/new`, { waitUntil: "networkidle" });
  const count = await learner.getByTestId("summary-count").innerText();
  const canImport = await learner.getByRole("link", { name: "Import" }).count();
  console.log(`LEARNER SIGNUP OK — builder offers ${count} questions, import links visible: ${canImport}`);
} catch (e) {
  failures += 1;
  console.log("LEARNER SIGNUP FAILED: " + String(e).slice(0, 200));
}

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "zero console errors");
console.log(`\nleftover test account to remove: ${learnerEmail}`);
await browser.close();
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
