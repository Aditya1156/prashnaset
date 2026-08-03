// Fills in AI explanations across the whole live library by driving the app's
// own admin UI — the same code path a real admin uses, so this verifies the
// feature rather than side-stepping it. Uses a throwaway admin, deleted after.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/backfill-ai.mjs <ref> <site>
import { chromium } from "@playwright/test";
import { createThrowawayFactory } from "./lib/throwaway.mjs";

const [ref, site] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/backfill-ai.mjs <ref> <site>");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

const before = await sql(
  "select count(*) filter (where ai_explanation is not null) as done, count(*) as total from public.questions where status='active';",
);
console.log(`starting: ${before[0].done}/${before[0].total} questions have AI explanations`);

// Throwaway admin. The factory removes it on exit, Ctrl+C or a crash — an
// earlier version deleted it only on the last line, so interrupted runs left
// fake admins sitting in the production user list.
const factory = await createThrowawayFactory(ref, token);
const { email, password } = await factory.create("backfill", { admin: true });

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(180000);

try {
  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  const sets = await sql(
    "select id, title from public.question_sets order by created_at;",
  );

  for (const set of sets) {
    let guard = 0;
    for (;;) {
      guard += 1;
      if (guard > 40) {
        console.log(`  ${set.title}: stopping after 40 batches`);
        break;
      }

      await page.goto(`${site}/sets/${set.id}`, { waitUntil: "networkidle" });
      const button = page.getByRole("button", { name: /AI explanations \(\d+\)/ });
      if ((await button.count()) === 0) {
        console.log(`  ${set.title}: complete`);
        break;
      }

      const label = await button.innerText();
      const missing = Number(/\((\d+)\)/.exec(label)?.[1] ?? "0");
      await button.click();
      await page.getByRole("button", { name: /^Generate \d+/ }).click();

      const report = page.locator("text=/Generated \\d+/").first();
      await report.waitFor({ timeout: 170000 });
      const outcome = (await report.innerText()).replace(/\s+/g, " ").trim();
      console.log(`  ${set.title}: ${missing} missing -> ${outcome}`);

      if (/Generated 0\b/.test(outcome)) {
        const failure = page.locator("text=/First failure/").first();
        if ((await failure.count()) > 0) {
          console.log(`    ${(await failure.innerText()).slice(0, 220)}`);
        }
        break; // no progress: stop rather than loop forever
      }
    }
  }
} catch (e) {
  console.log("ERROR: " + String(e).slice(0, 400));
}

await browser.close();
await factory.cleanup();

const after = await sql(
  "select count(*) filter (where ai_explanation is not null) as done, count(*) as total from public.questions where status='active';",
);
console.log(`\nfinished: ${after[0].done}/${after[0].total} questions have AI explanations`);
