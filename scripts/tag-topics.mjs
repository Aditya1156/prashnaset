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

// Groq is fast but meters tokens per DAY per model (200k on the free tier —
// roughly 550 questions), so a large library runs dry mid-way. Gemini's free
// daily allowance is far larger, which is what a full library needs.
const groqKey = process.env.GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const provider = (process.env.AI_PROVIDER ?? (geminiKey ? "gemini" : "groq")).trim().toLowerCase();
if (provider === "gemini" ? !geminiKey : !groqKey) {
  console.error(`${provider} needs its API key (GEMINI_API_KEY or GROQ_API_KEY)`);
  process.exit(1);
}

const model =
  process.env.AI_MODEL ?? (provider === "gemini" ? "gemini-flash-latest" : "openai/gpt-oss-20b");
// Gemini free tier allows ~15 requests a minute; Groq ~30. Stay under.
const PACE_MS = Number(process.env.PACE_MS ?? (provider === "gemini" ? 4200 : 1500));
const limit = args.limit ? Number(args.limit) : Infinity;
console.log(`provider: ${provider} · model: ${model} · pace: ${PACE_MS}ms`);
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

/** PostgREST caps a response at 1000 rows and silently ignores a larger
 *  `limit`, so page explicitly — an earlier version quietly tagged only the
 *  first thousand of a larger library and reported success. */
async function loadPending() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await withRetry("load", async () => {
      const res = await fetch(
        `${restUrl}/questions?status=eq.active&topic=is.null&select=id,stem,options&order=created_at.asc`,
        { headers: { ...restHeaders, Range: `${from}-${from + 999}` } },
      );
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
      return res.json();
    });
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
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

async function classifyWithGroq(question) {
  // A transport-level failure (a dropped TLS connection, a DNS blip) throws
  // rather than returning a response. Turn it into a retryable result: an
  // earlier version lost a 1300-question run to one ECONNRESET.
  let res;
  let body;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        // gpt-oss spends tokens on hidden reasoning before it writes any
        // content, and a tight ceiling truncates the answer away entirely —
        // leaving an empty reply that costs three retries per question.
        max_tokens: 700,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: describe(question) },
        ],
      }),
    });
    body = await res.text();
  } catch (cause) {
    return { error: `fetch failed: ${String(cause).slice(0, 120)}` };
  }
  if (!res.ok) return { error: `HTTP ${res.status} ${body.slice(0, 140)}` };
  const message = JSON.parse(body).choices?.[0]?.message ?? {};
  const raw = String(message.content ?? "");
  const cleaned = raw.trim().replace(/^["'\s]+|["'.\s]+$/g, "");
  const match = TOPIC_SET.get(cleaned.toLowerCase());
  if (match) return { topic: match };

  // The model settled on an answer inside its reasoning but ran out of room
  // to state it. Take the last topic it named there rather than discarding
  // the whole call.
  const salvaged = TOPICS.filter((t) => String(message.reasoning ?? "").includes(t)).pop();
  if (salvaged) return { topic: salvaged };

  return { error: `off-list reply: ${(cleaned || "(empty)").slice(0, 60)}` };
}

async function classifyWithGemini(question) {
  let res;
  let body;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [{ text: describe(question) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 700,
            // A closed enum makes an off-list answer impossible by
            // construction, rather than something to detect afterwards.
            responseMimeType: "text/x.enum",
            responseSchema: { type: "STRING", enum: TOPICS },
          },
        }),
      },
    );
    body = await res.text();
  } catch (cause) {
    return { error: `fetch failed: ${String(cause).slice(0, 120)}` };
  }
  if (!res.ok) return { error: `HTTP ${res.status} ${body.slice(0, 140)}` };

  const raw = JSON.parse(body).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const match = TOPIC_SET.get(raw.trim().toLowerCase());
  return match ? { topic: match } : { error: `off-list reply: ${(raw || "(empty)").slice(0, 60)}` };
}

const classify = (question) =>
  provider === "gemini" ? classifyWithGemini(question) : classifyWithGroq(question);

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
    // A throttle reply says exactly how long to wait. Guessing shorter just
    // burns another request against the same limit.
    const hinted = result.error.match(/try again in ([\d.]+)\s*s/i);
    await sleep(hinted ? Number(hinted[1]) * 1000 + 1000 : attempt * 3000);
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

  try {
    await saveTopic(question.id, result.topic);
  } catch (cause) {
    failed += 1;
    if (failed <= 5) console.log(`  ! save ${question.id} -> ${String(cause).slice(0, 100)}`);
    continue;
  }
  counts.set(result.topic, (counts.get(result.topic) ?? 0) + 1);
  done += 1;
  if (done % 50 === 0) console.log(`  ${done}/${pending.length} tagged`);
}

console.log(`\ntagged ${done}, failed ${failed}`);
for (const [topic, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${topic}`);
}
