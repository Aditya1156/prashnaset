// Tags every untagged question with a BPSC syllabus topic, so the weak-area
// analytics on /progress can group by subject instead of lumping everything
// under "Untagged".
//
// The taxonomy is fixed and sent to the model as a closed list: a free-form
// topic per question would fragment into hundreds of near-duplicate labels
// and make the breakdown useless. Anything the model returns outside the list
// is rejected and the question is left untagged rather than mislabelled.
//
// Usage (local):
//   GROQ_API_KEY=... node scripts/tag-topics.mjs --url=http://127.0.0.1:56321 --key=<service_role>
// Usage (cloud):
//   SUPABASE_ACCESS_TOKEN=... GROQ_API_KEY=... node scripts/tag-topics.mjs --ref=<project-ref>

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=") || "true"];
  }),
);

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  console.error("GROQ_API_KEY is required");
  process.exit(1);
}

const model = process.env.AI_MODEL ?? "openai/gpt-oss-20b";
const PACE_MS = Number(process.env.PACE_MS ?? 900);
const limit = args.limit ? Number(args.limit) : Infinity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The BPSC prelims syllabus, flattened to the granularity that is actually
 *  actionable for revision: fine enough to point at a chapter, coarse enough
 *  that each bucket accumulates enough attempts to mean something. */
const TOPICS = [
  "Ancient History",
  "Medieval History",
  "Modern History",
  "Bihar History",
  "Art and Culture",
  "Physical Geography",
  "Indian Geography",
  "Bihar Geography",
  "World Geography",
  "Indian Polity",
  "Indian Economy",
  "Bihar Economy",
  "Environment and Ecology",
  "General Science",
  "Science and Technology",
  "Current Affairs",
  "Reasoning and Mental Ability",
];
const TOPIC_SET = new Map(TOPICS.map((t) => [t.toLowerCase(), t]));

const SYSTEM = `You classify questions from Indian Public Service Commission (BPSC) exam preparation material.
Reply with ONLY one topic, copied exactly from this list, and nothing else:
${TOPICS.join("\n")}
If a question fits more than one, choose the one a BPSC syllabus would file it under.`;

// --- data access -----------------------------------------------------------
let restUrl;
let restHeaders;

if (args.ref) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("--ref needs SUPABASE_ACCESS_TOKEN");
    process.exit(1);
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${args.ref}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`could not read project keys: ${res.status}`);
    process.exit(1);
  }
  const key = (await res.json()).find((k) => k.name === "service_role").api_key;
  restUrl = `https://${args.ref}.supabase.co/rest/v1`;
  restHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
} else {
  const base = args.url ?? "http://127.0.0.1:56321";
  const key = args.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("local mode needs --key=<service_role> or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  restUrl = `${base}/rest/v1`;
  restHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function withRetry(label, attempt) {
  let lastError;
  for (let i = 1; i <= 4; i++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (i < 4) await sleep(i * 2000);
    }
  }
  throw new Error(`${label} failed: ${String(lastError).slice(0, 200)}`);
}

async function loadPending() {
  return withRetry("load", async () => {
    const res = await fetch(
      `${restUrl}/questions?status=eq.active&topic=is.null&select=id,stem,options&order=created_at.asc&limit=5000`,
      { headers: restHeaders },
    );
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    return res.json();
  });
}

async function saveTopic(id, topic) {
  return withRetry("save", async () => {
    const res = await fetch(`${restUrl}/questions?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...restHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  });
}

// --- classification --------------------------------------------------------
function describe(question) {
  const options = Array.isArray(question.options)
    ? question.options.slice(0, 4).join(" | ")
    : "";
  return `Question: ${String(question.stem).slice(0, 600)}${options ? `\nOptions: ${options.slice(0, 400)}` : ""}`;
}

async function classify(question) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 400,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: describe(question) },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) return { error: `HTTP ${res.status} ${body.slice(0, 140)}` };
  const raw = JSON.parse(body).choices?.[0]?.message?.content ?? "";
  const cleaned = raw.trim().replace(/^["'\s]+|["'.\s]+$/g, "");
  const match = TOPIC_SET.get(cleaned.toLowerCase());
  return match ? { topic: match } : { error: `off-list reply: ${cleaned.slice(0, 60)}` };
}

// --- run -------------------------------------------------------------------
const all = await loadPending();
const pending = Number.isFinite(limit) ? all.slice(0, limit) : all;
console.log(`${all.length} untagged questions${Number.isFinite(limit) ? ` — tagging ${pending.length}` : ""}`);

let done = 0;
let failed = 0;
const counts = new Map();

for (const [i, question] of pending.entries()) {
  if (i > 0) await sleep(PACE_MS);

  let result = await classify(question);
  for (let attempt = 1; result.error && attempt <= 3; attempt++) {
    if (!/HTTP 429|HTTP 5\d\d|fetch failed|off-list/i.test(result.error)) break;
    await sleep(attempt * 3000);
    result = await classify(question);
  }

  if (result.error) {
    failed += 1;
    if (failed <= 5) console.log(`  ! ${String(question.stem).slice(0, 60)} -> ${result.error}`);
    if (/401|403|invalid.?api.?key/i.test(result.error)) {
      console.log("fatal provider error; stopping");
      break;
    }
    continue;
  }

  await saveTopic(question.id, result.topic);
  counts.set(result.topic, (counts.get(result.topic) ?? 0) + 1);
  done += 1;
  if (done % 50 === 0) console.log(`  ${done}/${pending.length} tagged`);
}

console.log(`\ntagged ${done}, failed ${failed}`);
for (const [topic, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${topic}`);
}
