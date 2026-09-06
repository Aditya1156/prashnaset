// Drives the whole product on the live site as a real learner would, and
// screenshots each step. Uses a throwaway account, removed afterwards.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/walkthrough.mjs <ref> <site> [outDir]
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createThrowawayFactory } from "./lib/throwaway.mjs";

const [ref, site, outDir = "docs/screenshots/walkthrough"] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/walkthrough.mjs <ref> <site>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const factory = await createThrowawayFactory(ref, token);
const browser = await chromium.launch();
const errors = [];
let step = 0;
let failures = 0;

const note = (msg) => console.log(`  ${msg}`);
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failures += 1;
};

try {
  const learner = await factory.create("tour");
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${String(e)}`));

  const shot = async (name) => {
    step += 1;
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, `${String(step).padStart(2, "0")}-${name}.png`) });
  };

  // 1. Landing
  await page.goto(site, { waitUntil: "networkidle" });
  await shot("landing");

  // 2. Sign in
  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(learner.email);
  await page.getByLabel("Password", { exact: true }).fill(learner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  await shot("dashboard");
  const stats = (await page.getByTestId("stats").innerText()).replace(/\s+/g, " ");
  note(`dashboard stats: ${stats}`);
  check("learner sees no admin nav", (await page.getByRole("link", { name: "Import" }).count()) === 0);

  // 3. Library
  await page.goto(`${site}/sets`, { waitUntil: "networkidle" });
  await shot("library");
  note(`library: ${(await page.getByTestId("sets-summary").innerText()).replace(/\s+/g, " ")}`);

  // 4. Builder
  await page.goto(`${site}/test/new`, { waitUntil: "networkidle" });
  await shot("builder");
  note(`length options: ${(await page.getByTestId("count-options").innerText()).replace(/\s+/g, " ")}`);
  note(`summary count: ${await page.getByTestId("summary-count").innerText()}`);

  // 5. Run a practice test, answering the first question
  await page.getByRole("button", { name: /^Start/ }).first().click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 30000 });
  await shot("question");

  const radios = page.getByRole("radio");
  if (await radios.count()) await radios.first().click();
  else {
    const boxes = page.getByRole("checkbox");
    if (await boxes.count()) await boxes.first().click();
    else {
      const sels = page.getByRole("combobox");
      for (let i = 0; i < (await sels.count()); i++) {
        const opts = await sels.nth(i).locator("option").allTextContents();
        await sels.nth(i).selectOption(opts.filter((o) => o !== "Choose\u2026")[0]);
      }
    }
  }
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByTestId("feedback").waitFor({ timeout: 20000 });
  await shot("answer-with-ai");
  check("AI explanation shows after answering", (await page.getByTestId("ai-insight").count()) > 0);

  // 6. Finish the test
  const total = Number(/of (\d+)/.exec(await page.getByTestId("progress-text").innerText())?.[1] ?? "0");
  for (let i = 0; i < total; i++) {
    if (await page.getByTestId("advance").count()) await page.getByTestId("advance").click();
    else break;
    if (await page.getByTestId("finish-screen").count()) break;
    const r = page.getByRole("radio");
    if (await r.count()) await r.first().click();
    else {
      const b = page.getByRole("checkbox");
      if (await b.count()) await b.first().click();
      else {
        const s = page.getByRole("combobox");
        for (let j = 0; j < (await s.count()); j++) {
          const o = await s.nth(j).locator("option").allTextContents();
          await s.nth(j).selectOption(o.filter((x) => x !== "Choose\u2026")[0]);
        }
      }
    }
    const check1 = page.getByRole("button", { name: "Check answer" });
    if (await check1.count()) {
      await check1.click();
      await page.getByTestId("feedback").waitFor({ timeout: 20000 });
    }
  }
  await page.getByTestId("finish-screen").waitFor({ timeout: 30000 });
  await shot("score");
  note(`result: ${(await page.getByTestId("finish-summary").innerText()).trim()}`);

  // 7. Review
  await page.getByRole("link", { name: "Review answers" }).click();
  await page.waitForURL("**/history/**", { timeout: 20000 });
  await shot("review");

  // 8. Mistake drill offered?
  await page.goto(`${site}/dashboard`, { waitUntil: "networkidle" });
  const drill = (await page.getByTestId("mistake-drill").innerText()).replace(/\s+/g, " ");
  note(`mistake drill: ${drill.slice(0, 90)}`);
  const streak = (await page.getByTestId("streak-card").innerText()).replace(/\s+/g, " ");
  note(`streak: ${streak.slice(0, 70)}`);

  // 9. Leaderboard + history
  await page.goto(`${site}/leaderboard`, { waitUntil: "networkidle" });
  await shot("leaderboard");
  await page.goto(`${site}/history`, { waitUntil: "networkidle" });
  await shot("history");

  check("no console errors anywhere", errors.length === 0, errors.slice(0, 2).join("; ").slice(0, 200));
} catch (e) {
  failures += 1;
  console.log("ERROR: " + String(e).slice(0, 400));
} finally {
  await browser.close();
  await factory.cleanup();
}
console.log(failures === 0 ? "\nwalkthrough clean" : `\n${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
