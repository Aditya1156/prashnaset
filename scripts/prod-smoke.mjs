// Drives the LIVE production site's password-reset flow in a real browser.
// This exercises the exact browser fetch that failed when the inlined
// Supabase key contained a non-ASCII byte — and, on success, sends a real
// recovery email to the address given.
// Usage: node scripts/prod-smoke.mjs [email]
import { chromium } from "@playwright/test";

const email = process.argv[2] ?? "adityaissc7@gmail.com";
const base = "https://prashnaset.vercel.app";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${base}/reset`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(email);
await page.getByRole("button", { name: "Send reset link" }).click();

const ok = await page
  .getByText("Check your inbox")
  .waitFor({ timeout: 20000 })
  .then(() => true)
  .catch(() => false);

console.log(ok ? "RESET FLOW OK — recovery email sent" : "RESET FLOW FAILED");
if (errors.length) console.log("console errors:\n" + errors.join("\n"));
await browser.close();
process.exit(ok && errors.length === 0 ? 0 : 1);
