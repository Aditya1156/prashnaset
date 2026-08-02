// Live check: test length is no longer capped, and the AI generation button
// reports the real reason when the model call fails. Uses a throwaway admin
// that is deleted afterwards.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-ai-and-length.mjs <ref> <site>
import { chromium } from "@playwright/test";

const [ref, site] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-ai-and-length.mjs <ref> <site>");
  process.exit(1);
}

const keys = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const serviceKey = keys.find((k) => k.name === "service_role").api_key;
const projectUrl = `https://${ref}.supabase.co`;
const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const email = `ai-check-${Date.now()}@prashnaset.test`;
const password = `Check-${Math.random().toString(36).slice(2)}`;
const user = await fetch(`${projectUrl}/auth/v1/admin/users`, {
  method: "POST",
  headers: adminHeaders,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "AI Check" },
  }),
}).then((r) => r.json());
await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${user.id}`, {
  method: "PATCH",
  headers: { ...adminHeaders, Prefer: "return=minimal" },
  body: JSON.stringify({ role: "admin" }),
});

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} ${ok ? "" : detail}`);
  if (!ok) failures += 1;
}

try {
  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  // --- length: presets beyond 25 plus an "All" option ---------------------
  await page.goto(`${site}/test/new`, { waitUntil: "networkidle" });
  const options = page.getByTestId("count-options");
  const labels = (await options.innerText()).replace(/\s+/g, " ").trim();
  console.log(`  length options: ${labels}`);
  check("offers a 50-question preset", /\b50\b/.test(labels));
  check("offers a 100-question preset", /\b100\b/.test(labels));
  check("offers an All option", /All/i.test(labels));

  // Selecting All should size the test to the whole matching bank.
  await options.getByRole("button", { name: /^All/ }).click();
  const summary = (await page.getByTestId("summary-count").innerText()).trim();
  const allCount = Number(summary);
  console.log(`  All -> ${allCount} questions`);
  check("All exceeds the old 25 cap", allCount > 25, `(got ${allCount})`);

  // --- AI: the button exists and reports failures honestly ----------------
  await page.goto(`${site}/sets`, { waitUntil: "networkidle" });
  await page.getByTestId("folder-card").first().click();
  await page.waitForURL("**/sets/folder/**", { timeout: 20000 });
  await page.locator('a[href^="/sets/"]').first().click();
  await page.waitForURL(/\/sets\/[0-9a-f-]+$/, { timeout: 20000 });

  const aiButton = page.getByRole("button", { name: /AI explanations \(\d+\)/ });
  check("admin sees the AI generation button", (await aiButton.count()) > 0);

  if ((await aiButton.count()) > 0) {
    await aiButton.click();
    await page.getByRole("button", { name: /^Generate \d+/ }).click();
    // Either it works, or it must say why — never fail silently.
    const report = page.locator("text=/Generated|Gemini|API key|denied|quota/i").first();
    await report.waitFor({ timeout: 120000 });
    const message = (await report.innerText()).replace(/\s+/g, " ").trim();
    console.log(`  AI outcome: ${message.slice(0, 220)}`);
    check("AI result or a real error is reported", message.length > 0);
  }
} catch (e) {
  failures += 1;
  console.log("ERROR: " + String(e).slice(0, 300));
}

console.log(errors.length ? `\nconsole errors:\n${errors.join("\n")}` : "\nzero console errors");
await browser.close();

await fetch(`${projectUrl}/auth/v1/admin/users/${user.id}`, {
  method: "DELETE",
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
console.log("throwaway admin deleted");
process.exit(failures === 0 ? 0 : 1);
