// Verifies the study engine on a live deployment, as a real learner would
// meet it: spaced repetition, bookmarks and notes, the daily target, negative
// marking, and the on-demand AI explanation.
//
// Uses one throwaway account, removed on every exit path including Ctrl-C —
// an earlier script only cleaned up on a clean exit and left phantom accounts
// visible in the admin's user list.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-study-engine.mjs <supabase-url> <site>
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const [supabaseUrl, site] = process.argv.slice(2);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !site || !serviceKey) {
  console.error(
    "usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-study-engine.mjs <supabase-url> <site>",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const PASSWORD = `Tt${Math.random().toString(36).slice(2)}!7`;
const email = `verify-${Date.now()}@prashnaset.test`;
let userId = null;

async function cleanup() {
  if (!userId) return;
  const id = userId;
  userId = null;
  await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log("  (throwaway account removed)");
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, async () => {
    await cleanup();
    process.exit(130);
  });
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch();
try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Verify Learner" },
  });
  if (error) throw new Error(`could not create the throwaway learner: ${error.message}`);
  userId = data.user.id;

  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  check("a learner can sign in", true);

  // --- dashboard --------------------------------------------------------
  const due = page.getByTestId("review-due");
  check("dashboard offers the review queue", (await due.count()) > 0);
  check(
    "review card is honest before any practice",
    /Answer some questions/i.test(await due.innerText()),
  );

  // --- progress ---------------------------------------------------------
  await page.goto(`${site}/progress`, { waitUntil: "networkidle" });
  check("progress page renders", (await page.getByTestId("daily-target").count()) > 0);
  check(
    "bookmarks start empty rather than fabricated",
    await page.getByText("No bookmarks yet").isVisible(),
  );

  // The daily target writes to a column-granted field on profiles; if that
  // grant is missing the value silently fails to persist across a reload.
  await page.getByRole("button", { name: "20/day" }).click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  check(
    "daily target survives a reload",
    (await page.getByTestId("daily-target").innerText()).includes("/20"),
  );

  // --- builder ----------------------------------------------------------
  await page.goto(`${site}/test/new`, { waitUntil: "networkidle" });
  check(
    "negative marking is offered",
    (await page.getByTestId("negative-marking-toggle").count()) > 0,
  );
  const mock = page.getByTestId("mock-preset");
  check("full BPSC mock preset is offered", (await mock.count()) > 0);

  // Run a short practice test rather than the 150-question mock.
  await page.getByRole("button", { name: /^5$/ }).first().click();
  await page.getByTestId("negative-marking-toggle").check();
  await page.getByRole("button", { name: /^Start/ }).first().click();
  await page.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 60000 });
  check("a test starts", true);

  // --- answer, study tools, AI on demand --------------------------------
  const total = Number(
    (await page.getByTestId("progress-text").innerText()).match(/of (\d+)/)[1],
  );
  let sawExplainOffer = false;
  let sawAiPanel = false;

  for (let i = 0; i < total; i++) {
    const radios = page.getByRole("radio");
    if (await radios.count()) await radios.nth(i === 0 ? 1 : 0).click();
    else {
      const boxes = page.getByRole("checkbox");
      if (await boxes.count()) await boxes.first().click();
      else {
        const selects = page.getByRole("combobox");
        for (let s = 0; s < (await selects.count()); s++) {
          const options = await selects.nth(s).locator("option").allTextContents();
          await selects.nth(s).selectOption(options.filter((o) => o !== "Choose…")[0]);
        }
      }
    }
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByTestId("feedback").waitFor({ timeout: 30000 });

    if (i === 0) {
      // Bookmark and annotate the first question.
      await page.getByTestId("bookmark-toggle").click();
      await page.getByRole("button", { name: "Add note" }).click();
      await page.getByLabel("Your note").fill("Checked live on production.");
      await page.getByRole("button", { name: "Save note" }).click();
      await page.getByText("Saved").waitFor({ timeout: 15000 });
      check("bookmark and note save", true);
    }

    if ((await page.getByTestId("ai-insight").count()) > 0) sawAiPanel = true;
    const offer = page.getByTestId("ai-explain");
    if (!sawExplainOffer && (await offer.count()) > 0) {
      sawExplainOffer = true;
      await offer.click();
      await page.getByTestId("ai-insight").waitFor({ timeout: 120000 });
      const text = (await page.getByTestId("ai-insight").innerText()).replace(/\s+/g, " ");
      check("on-demand AI explanation works in production", text.length > 120, `(len ${text.length})`);
      sawAiPanel = true;
    }

    await page.getByTestId("advance").click();
  }

  check("explanations reach the learner", sawAiPanel);
  if (!sawExplainOffer) {
    console.log("  note: every question drawn already had an explanation cached");
  }

  // --- finish screen ----------------------------------------------------
  const net = page.getByTestId("net-score");
  await net.waitFor({ timeout: 30000 });
  const cells = (await net.innerText()).replace(/\s+/g, " ").toLowerCase();
  const summary = await page.getByTestId("finish-summary").innerText();
  const [, correctText, totalText] = summary.match(/(\d+) of (\d+) correct/);
  const correct = Number(correctText);
  const wrong = Number(totalText) - correct;
  check(
    "net score applies BPSC's 1/3 penalty",
    cells.includes(`penalty -${(wrong / 3).toFixed(2)}`),
    `got "${cells}" for ${wrong} wrong`,
  );

  // --- the schedule picked the answers up -------------------------------
  await page.goto(`${site}/progress`, { waitUntil: "networkidle" });
  check("topic breakdown appears after answering", (await page.getByTestId("topic-table").count()) > 0);
  const list = page.getByTestId("bookmark-list");
  check("the bookmark is listed", (await list.count()) > 0);
  // The note lives in a textarea, so read its value — innerText does not
  // expose the contents of a form field.
  check(
    "the note came back with it",
    (await list.getByLabel("Your note").first().inputValue()) === "Checked live on production.",
  );

  await page.goto(`${site}/dashboard`, { waitUntil: "networkidle" });
  check(
    "answered questions entered the review schedule",
    /in your schedule|scheduled for today|Nothing due today/i.test(
      await page.getByTestId("review-due").innerText(),
    ),
  );

  check("no console errors anywhere", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (error) {
  failures += 1;
  console.log(`  FAIL  threw: ${String(error).slice(0, 300)}`);
} finally {
  await browser.close();
  await cleanup();
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
