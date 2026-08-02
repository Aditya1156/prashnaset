// Verifies the practice engine on the LIVE site with throwaway accounts that
// are deleted afterwards, so the real library and user list are untouched.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-practice-engine.mjs <ref> <site>
import { chromium } from "@playwright/test";

const [ref, site] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-practice-engine.mjs <ref> <site>");
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

const created = [];
async function makeUser(tag, { admin = false } = {}) {
  const email = `pe-${tag}-${Date.now()}@prashnaset.test`;
  const password = `Check-${Math.random().toString(36).slice(2)}`;
  const user = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `PE ${tag}` },
    }),
  }).then((r) => r.json());
  created.push(user.id);
  if (admin) {
    await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { ...adminHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ role: "admin" }),
    });
  }
  return { email, password };
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

async function signIn(page, { email, password }) {
  await page.goto(`${site}/signin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });
}

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

try {
  // --- admin: assignment creation against the REAL library -----------------
  const adminCreds = await makeUser("admin", { admin: true });
  const admin = await newPage();
  await signIn(admin, adminCreds);

  const title = `Live check ${Date.now().toString(36)}`;
  await admin.goto(`${site}/assignments`, { waitUntil: "networkidle" });
  await admin.getByRole("button", { name: "New assignment" }).click();
  await admin.getByLabel("Title").fill(title);
  await admin.locator("#assignment-count").selectOption("5");
  await admin.locator("#assignment-duration").fill("10");
  await admin.getByRole("button", { name: "Assign test" }).click();
  const adminCard = admin.getByTestId("assignment-card").filter({ hasText: title });
  await adminCard.waitFor({ timeout: 25000 });
  check("admin can create an assignment", true);

  // --- learner: sees it, takes it in exam mode -----------------------------
  const learnerCreds = await makeUser("learner");
  const learner = await newPage();
  await signIn(learner, learnerCreds);

  check(
    "streak card renders for a new learner",
    (await learner.getByTestId("streak-card").count()) > 0,
  );
  check(
    "mistake drill renders for a new learner",
    (await learner.getByTestId("mistake-drill").count()) > 0,
  );

  await learner.goto(`${site}/assignments`, { waitUntil: "networkidle" });
  const learnerCard = learner.getByTestId("assignment-card").filter({ hasText: title });
  await learnerCard.waitFor({ timeout: 25000 });
  check("learner sees the assignment", true);
  check(
    "learner has no admin controls on it",
    (await learnerCard.getByRole("button", { name: "Delete" }).count()) === 0,
  );

  await learnerCard.getByRole("button", { name: "Start test" }).click();
  await learner.waitForURL(/\/test\/(?!new)[0-9a-f-]+$/, { timeout: 30000 });
  check("exam clock is present", (await learner.getByTestId("exam-clock").count()) > 0);
  check("question palette is present", (await learner.getByTestId("question-palette").count()) > 0);

  // Answer one question: exam mode must NOT reveal the verdict.
  const radios = learner.getByRole("radio");
  if ((await radios.count()) > 0) {
    await radios.first().click();
    await learner.waitForTimeout(800);
    check(
      "exam mode withholds the answer",
      (await learner.getByTestId("feedback").count()) === 0,
    );
  }

  // --- leaderboard reachable ----------------------------------------------
  await learner.goto(`${site}/leaderboard`, { waitUntil: "networkidle" });
  check(
    "leaderboard page renders",
    (await learner.getByRole("heading", { name: "Leaderboard" }).count()) > 0,
  );

  // --- cleanup the assignment so the real product is left clean ------------
  await admin.goto(`${site}/assignments`, { waitUntil: "networkidle" });
  const toDelete = admin.getByTestId("assignment-card").filter({ hasText: title });
  await toDelete.getByRole("button", { name: "Delete" }).click();
  await admin.getByRole("button", { name: "Delete assignment" }).click();
  await admin.waitForTimeout(1500);
  await admin.reload({ waitUntil: "networkidle" });
  check(
    "test assignment removed again",
    (await admin.getByTestId("assignment-card").filter({ hasText: title }).count()) === 0,
  );
} catch (e) {
  failures += 1;
  console.log("ERROR: " + String(e).slice(0, 300));
}

console.log(errors.length ? `\nconsole errors:\n${errors.join("\n")}` : "\nzero console errors");
await browser.close();

for (const id of created) {
  await fetch(`${projectUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
}
console.log(`cleaned up ${created.length} throwaway accounts`);

process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
