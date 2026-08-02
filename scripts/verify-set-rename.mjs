// Proves set renaming works on the live site without altering real content:
// renames one set, checks the new name appears, then restores the original.
// Usage: node scripts/verify-set-rename.mjs <site> <adminEmail> <adminPassword>
import { chromium } from "@playwright/test";

// Either pass admin credentials, or pass a project ref with
// SUPABASE_ACCESS_TOKEN set to provision (and afterwards delete) a temporary
// admin — so a real person's account and password are never involved.
//   node scripts/verify-set-rename.mjs <site> <email> <password>
//   SUPABASE_ACCESS_TOKEN=... node scripts/verify-set-rename.mjs <site> --provision <ref>
const [site, arg2, arg3] = process.argv.slice(2);
const provision = arg2 === "--provision";
let email = provision ? null : arg2;
let password = provision ? null : arg3;
let tempAdminId = null;
let projectUrl = null;
let serviceKey = null;

if (!site || (!provision && (!email || !password))) {
  console.error("usage: node scripts/verify-set-rename.mjs <site> <email> <password>");
  console.error("   or: SUPABASE_ACCESS_TOKEN=... node scripts/verify-set-rename.mjs <site> --provision <ref>");
  process.exit(1);
}

if (provision) {
  const ref = arg3;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.error("--provision needs <ref> and SUPABASE_ACCESS_TOKEN");
    process.exit(1);
  }
  const keys = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  serviceKey = keys.find((k) => k.name === "service_role").api_key;
  projectUrl = `https://${ref}.supabase.co`;
  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  email = `rename-check-${Date.now()}@prashnaset.test`;
  password = `Check-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const created = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Rename Check" },
    }),
  }).then((r) => r.json());
  tempAdminId = created.id;
  await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${tempAdminId}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ role: "admin" }),
  });
  console.log(`provisioned temporary admin: ${email}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

async function rename(to) {
  await page.getByRole("button", { name: "Rename" }).click();
  const field = page.getByLabel("Set title");
  await field.fill(to);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("heading", { name: to, exact: true }).waitFor({ timeout: 20000 });
}

let ok = false;
let original = null;
try {
  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 25000 });

  // Open the most recent set from the dashboard's recent list.
  await page.locator('a[href^="/sets/"]').first().click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/, { timeout: 20000 });
  original = (await page.locator("h1").first().innerText()).trim();
  console.log(`opened set: ${original}`);

  const temp = `${original} [rename check]`;
  await rename(temp);
  console.log("renamed OK — heading updated");

  // Confirm the new name is really persisted, not just optimistic UI.
  await page.reload({ waitUntil: "networkidle" });
  const afterReload = (await page.locator("h1").first().innerText()).trim();
  if (afterReload !== temp) throw new Error(`not persisted, saw: ${afterReload}`);
  console.log("persisted across reload OK");

  await rename(original);
  await page.reload({ waitUntil: "networkidle" });
  const restored = (await page.locator("h1").first().innerText()).trim();
  if (restored !== original) throw new Error(`restore failed, saw: ${restored}`);
  console.log(`restored original name OK: ${restored}`);
  ok = true;
} catch (e) {
  console.log("FAILED: " + String(e).slice(0, 300));
  if (original) console.log(`!! check this set's name manually: ${original}`);
}

console.log(errors.length ? `console errors:\n${errors.join("\n")}` : "zero console errors");
await browser.close();

if (tempAdminId) {
  await fetch(`${projectUrl}/auth/v1/admin/users/${tempAdminId}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  console.log("temporary admin deleted");
}

process.exit(ok && errors.length === 0 ? 0 : 1);
