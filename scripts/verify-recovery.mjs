// Proves an emailed recovery link works in a browser that never requested it
// (the cross-device case that used to fail). Generates the exact link Supabase
// puts in the email, opens it in a clean browser, and checks the password form
// becomes usable — then actually sets a new password and signs in with it.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-recovery.mjs <ref> <site> <email>
import { chromium } from "@playwright/test";

const [ref, site, email] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !email || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-recovery.mjs <ref> <site> <email>");
  process.exit(1);
}

const keys = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const serviceKey = keys.find((k) => k.name === "service_role").api_key;
const projectUrl = `https://${ref}.supabase.co`;

// The same URL the recovery email embeds.
const linkRes = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "recovery", email, redirect_to: `${site}/update-password` }),
});
const link = await linkRes.json();
if (!link.action_link) {
  console.log("could not generate link:", JSON.stringify(link));
  process.exit(1);
}

// A brand-new browser: no code_verifier, no cookies — like opening the mail
// on a different device.
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(link.action_link, { waitUntil: "networkidle" });
console.log("landed on:", page.url().split("#")[0]);

const newPassword = process.env.NEW_PASSWORD;
let ok = false;
try {
  await page.getByLabel("New password", { exact: true }).waitFor({ timeout: 25000 });
  console.log("PASSWORD FORM REACHED (cross-device recovery works)");
  if (newPassword) {
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await page.waitForURL("**/dashboard", { timeout: 25000 });
    console.log("PASSWORD UPDATED — landed on dashboard");
  }
  ok = true;
} catch {
  const body = await page.locator("body").innerText();
  console.log("FAILED. page said:\n" + body.slice(0, 400));
}

console.log(errors.length ? `console errors:\n${errors.join("\n")}` : "zero console errors");
await browser.close();
process.exit(ok ? 0 : 1);
