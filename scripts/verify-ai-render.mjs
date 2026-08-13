// Confirms a learner actually sees the AI explanation and tip after
// answering, on the live site. Uses a throwaway learner, removed afterwards.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-ai-render.mjs <ref> <site>
import { chromium } from "@playwright/test";
import { createThrowawayFactory } from "./lib/throwaway.mjs";

const [ref, site] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-ai-render.mjs <ref> <site>");
  process.exit(1);
}

const factory = await createThrowawayFactory(ref, token);
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failures += 1;
};

try {
  const learner = await factory.create("airender");
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(learner.email);
  await page.getByLabel("Password", { exact: true }).fill(learner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  // Untimed practice, so the verdict and explanation are revealed on check.
  await page.goto(`${site}/test/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Start/ }).first().click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 30000 });

  // Answer whatever is shown.
  const radios = page.getByRole("radio");
  if ((await radios.count()) > 0) await radios.first().click();
  else {
    const boxes = page.getByRole("checkbox");
    if ((await boxes.count()) > 0) await boxes.first().click();
    else {
      const selects = page.getByRole("combobox");
      for (let i = 0; i < (await selects.count()); i++) {
        const options = await selects.nth(i).locator("option").allTextContents();
        await selects.nth(i).selectOption(options.filter((o) => o !== "Choose…")[0]);
      }
    }
  }
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByTestId("feedback").waitFor({ timeout: 20000 });

  const insight = page.getByTestId("ai-insight");
  check("AI explanation panel is shown after answering", (await insight.count()) > 0);
  if ((await insight.count()) > 0) {
    const text = (await insight.innerText()).replace(/\s+/g, " ").trim();
    check("panel is labelled as AI generated", /AI EXPLANATION/i.test(text));
    check("panel carries a tip", /Tip:/i.test(text));
    check("explanation has real content", text.length > 120, `(len ${text.length})`);
    console.log(`\n  sample: ${text.slice(0, 260)}…\n`);
  }
  check("no console errors", errors.length === 0, errors.join("; ").slice(0, 160));
} catch (e) {
  failures += 1;
  console.log("ERROR: " + String(e).slice(0, 300));
} finally {
  await browser.close();
  await factory.cleanup();
}

process.exit(failures === 0 ? 0 : 1);
