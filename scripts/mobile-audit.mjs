// Audits the app at phone size: screenshots every main screen and flags any
// page whose content scrolls sideways or whose tap targets are too small.
// Usage: node scripts/mobile-audit.mjs <site> <email> <password> [outDir]
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const [site, email, password, outDir = "docs/screenshots/mobile"] = process.argv.slice(2);
if (!site || !email || !password) {
  console.error("usage: node scripts/mobile-audit.mjs <site> <email> <password> [outDir]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 12"] });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()} :: ${String(e)}`));

let problems = 0;

/** Horizontal overflow is the classic phone bug: a fixed width or a long
 *  unbroken string pushes the page sideways. */
async function check(name, url, prepare) {
  await page.goto(site + url, { waitUntil: "networkidle" });
  if (prepare) await prepare();
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > doc.clientWidth + 1) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(rect.right)}`,
        );
      }
    }
    // Interactive elements below the 40px comfortable-tap threshold.
    const small = [];
    for (const el of Array.from(document.querySelectorAll("button, a[href], select, input"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32)) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
        small.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return {
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      offenders: offenders.slice(0, 4),
      small: small.slice(0, 4),
    };
  });

  const overflows = metrics.scrollW > metrics.clientW + 1;
  if (overflows) problems += 1;
  console.log(
    `${overflows ? "OVERFLOW" : "ok      "} ${name.padEnd(16)} ${metrics.scrollW}/${metrics.clientW}px` +
      (metrics.small.length ? `  small taps: ${metrics.small.join(", ")}` : ""),
  );
  if (overflows) metrics.offenders.forEach((o) => console.log(`           ${o}`));

  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password", { exact: true }).fill(password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/dashboard", { timeout: 30000 });

await check("dashboard", "/dashboard");
await check("library", "/sets");
await check("builder", "/test/new");
await check("assignments", "/assignments");
await check("leaderboard", "/leaderboard");
await check("history", "/history");
await check("progress", "/progress");
await check("import", "/import");
await check("users", "/users");

// Exam runner: the densest screen on a phone.
await page.goto(`${site}/test/new`, { waitUntil: "networkidle" });
const timed = page.getByRole("checkbox", { name: /Timed exam mode/ });
if ((await timed.count()) > 0) {
  await timed.check();
  await page.getByRole("button", { name: /^Start/ }).first().click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 30000 });
  await check("exam-runner", page.url().replace(site, ""));
  await page.getByRole("button", { name: /All questions/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "exam-palette.png") });
  console.log("ok       exam-palette   (captured)");
}

console.log(errors.length ? `\nconsole errors:\n${errors.join("\n")}` : "\nzero console errors");
console.log(problems === 0 ? "no horizontal overflow anywhere" : `${problems} page(s) overflow`);
await browser.close();
process.exit(problems === 0 && errors.length === 0 ? 0 : 1);
