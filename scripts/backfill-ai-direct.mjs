// Bulk-fills AI explanations for a whole library.
//
// The in-app button is the right tool for topping up a set, but it runs as a
// serverless action with a 60s ceiling — too short for hundreds of questions
// against a 70B model. This script has no such ceiling. It imports the app's
// own prompt module so the text it sends can never drift from the app's.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... GROQ_API_KEY=... \
//     node --experimental-strip-types scripts/backfill-ai-direct.mjs <ref>
import { SYSTEM_PROMPT, describeQuestion } from "../src/lib/ai/prompt.ts";

const ref = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const groqKey = process.env.GROQ_API_KEY;
const model = process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
if (!ref || !token || !groqKey) {
  console.error("need <ref>, SUPABASE_ACCESS_TOKEN and GROQ_API_KEY");
  process.exit(1);
}

// Groq's free tier allows roughly 30 requests a minute; stay just under it.
const PACE_MS = Number(process.env.PACE_MS ?? 2100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`sql failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const esc = (value) => String(value).replace(/'/g, "''");

function trimToCompleteSentence(text) {
  const trimmed = text.trim();
  if (/[.!?]["')\]]?$/.test(trimmed)) return trimmed;
  const last = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf("?"),
  );
  return last > 0 ? trimmed.slice(0, last + 1) : trimmed;
}

function parsePayload(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed.explanation?.trim() || !parsed.tip?.trim()) return null;
    return {
      explanation: trimToCompleteSentence(parsed.explanation.trim()).slice(0, 4000),
      tip: trimToCompleteSentence(parsed.tip.trim()).slice(0, 1000),
    };
  } catch {
    return null;
  }
}

async function ask(question, useJsonMode = true) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 1200,
      ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: describeQuestion(question) },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    if (useJsonMode && /json_validate_failed|response_format/i.test(body)) {
      return ask(question, false);
    }
    return { error: `HTTP ${res.status} ${body.slice(0, 160)}` };
  }
  const content = JSON.parse(body).choices?.[0]?.message?.content;
  const value = content ? parsePayload(content) : null;
  return value ? { value } : { error: "unparsable reply" };
}

const pending = await sql(
  "select id, type, stem, options, correct, explanation from public.questions where status='active' and ai_explanation is null order by created_at, position;",
);
console.log(`${pending.length} questions need explanations`);

let done = 0;
let failed = 0;
for (const [i, question] of pending.entries()) {
  if (i > 0) await sleep(PACE_MS);

  let result = await ask(question);
  for (let attempt = 1; result.error && attempt <= 3; attempt++) {
    // Retry throttling, server errors, and malformed replies alike: a model
    // that emitted unparsable JSON once will usually get it right on a
    // second pass, and the row would otherwise be left empty.
    if (!/HTTP 429|HTTP 5\d\d|fetch failed|unparsable/i.test(result.error)) break;
    await sleep(attempt * 3000);
    result = await ask(question);
  }

  if (result.error) {
    failed += 1;
    if (failed <= 3) console.log(`  ! ${question.stem.slice(0, 60)} -> ${result.error}`);
    if (/401|403|invalid.?api.?key|permission/i.test(result.error)) {
      console.log("fatal provider error; stopping");
      break;
    }
    continue;
  }

  await sql(
    `update public.questions set ai_explanation='${esc(result.value.explanation)}', ai_tip='${esc(
      result.value.tip,
    )}', ai_model='${esc(model)}', ai_generated_at=now() where id='${question.id}';`,
  );
  done += 1;
  if (done % 25 === 0) console.log(`  ${done}/${pending.length} done`);
}

const [totals] = await sql(
  "select count(*) filter (where ai_explanation is not null) as done, count(*) as total from public.questions where status='active';",
);
console.log(`\ngenerated ${done}, failed ${failed}`);
console.log(`library now: ${totals.done}/${totals.total} questions have explanations`);
