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

const ref = process.argv.slice(2).find((a) => !a.startsWith("--"));
const token = process.env.SUPABASE_ACCESS_TOKEN;
// A management token can mint the service key itself, but a service key on
// its own is enough for everything below — rows go through PostgREST either
// way. Accepting one avoids needing the higher-privileged credential.
const directKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.argv.find((a) => a.startsWith("--key="))?.slice(6);

// Provider is chosen by which key is present, or forced with AI_PROVIDER.
// Groq is fast but its free tier caps tokens per DAY (~100k, so roughly 125
// questions); Gemini's free daily allowance is far larger, which matters when
// filling a whole library in one sitting.
const provider = (process.env.AI_PROVIDER ?? (process.env.GEMINI_API_KEY ? "gemini" : "groq"))
  .trim()
  .toLowerCase();
const groqKey = process.env.GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
// Groq's free tier meters tokens per DAY per model, so the good 70B model
// runs out after roughly 125 questions. Rather than stop there, fall back to
// a model with its own budget and keep going — a slightly plainer
// explanation beats no explanation.
let model =
  process.env.AI_MODEL ??
  (provider === "gemini" ? "gemini-flash-latest" : "openai/gpt-oss-120b");
const fallbackModel =
  process.env.AI_FALLBACK_MODEL ?? (provider === "groq" ? "openai/gpt-oss-20b" : null);
let usedFallback = false;

if (!ref || (!token && !directKey) || (provider === "gemini" ? !geminiKey : !groqKey)) {
  console.error(
    "need <ref>, a provider key, and either SUPABASE_ACCESS_TOKEN or --key=<service_role>",
  );
  process.exit(1);
}

// Gemini free tier allows ~15 requests a minute; Groq ~30. Stay under.
const PACE_MS = Number(process.env.PACE_MS ?? (provider === "gemini" ? 4200 : 2100));
console.log(`provider: ${provider} · model: ${model} · pace: ${PACE_MS}ms`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retries transient failures. A long run should not die because one request
 *  blipped — an earlier version lost a whole backfill to a single 500. */
async function withRetry(label, attempt) {
  let lastError;
  for (let i = 1; i <= 4; i++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (i < 4) await sleepMs(i * 2000);
    }
  }
  throw new Error(`${label} failed after retries: ${String(lastError).slice(0, 200)}`);
}

async function sql(query) {
  return withRetry("sql", async () => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    return res.json();
  });
}

// Row reads and writes go through PostgREST (the data API) rather than the
// management endpoint: it is the right tool for the job and is not subject to
// the management API's tighter limits.
const serviceKey =
  directKey ??
  (await withRetry("api-keys", async () => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const keys = await res.json();
    return keys.find((k) => k.name === "service_role").api_key;
  }));
const restHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};
const restUrl = `https://${ref}.supabase.co/rest/v1`;

async function saveExplanation(id, value, usedModel) {
  return withRetry("save", async () => {
    const res = await fetch(`${restUrl}/questions?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...restHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        ai_explanation: value.explanation,
        ai_tip: value.tip,
        ai_model: usedModel,
        ai_generated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  });
}

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

async function askGemini(question) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: describeQuestion(question) }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { explanation: { type: "STRING" }, tip: { type: "STRING" } },
            required: ["explanation", "tip"],
          },
        },
      }),
    },
  );
  const body = await res.text();
  if (!res.ok) return { error: `HTTP ${res.status} ${body.slice(0, 160)}` };
  const content = JSON.parse(body).candidates?.[0]?.content?.parts?.[0]?.text;
  const value = content ? parsePayload(content) : null;
  return value ? { value } : { error: "unparsable reply" };
}

async function askGroq(question, useJsonMode = true) {
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
      return askGroq(question, false);
    }
    return { error: `HTTP ${res.status} ${body.slice(0, 160)}` };
  }
  const content = JSON.parse(body).choices?.[0]?.message?.content;
  const value = content ? parsePayload(content) : null;
  return value ? { value } : { error: "unparsable reply" };
}

const ask = (question) => (provider === "gemini" ? askGemini(question) : askGroq(question));

// --limit N processes only the first N, for sampling a model's quality
// before committing to a whole library.
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const all = await withRetry("load", async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${restUrl}/questions?status=eq.active&ai_explanation=is.null` +
        `&select=id,type,stem,options,correct,explanation&order=created_at.asc,position.asc`,
      { headers: { ...restHeaders, Range: `${from}-${from + 999}` } },
    );
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
});
const pending = Number.isFinite(limit) ? all.slice(0, limit) : all;
console.log(
  `${all.length} questions need explanations` +
    (Number.isFinite(limit) ? ` — processing ${pending.length}` : ""),
);

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

  // Exhausted the day's budget for this model? Switch to the fallback and
  // retry this same question rather than abandoning the run.
  if (result.error && fallbackModel && !usedFallback && /HTTP 429/.test(result.error)) {
    console.log(`\n${model} is out of daily budget — continuing on ${fallbackModel}\n`);
    model = fallbackModel;
    usedFallback = true;
    result = await ask(question);
  }

  if (result.error) {
    failed += 1;
    if (failed <= 5) console.log(`  ! ${question.stem.slice(0, 60)} -> ${result.error}`);
    if (/401|403|invalid.?api.?key|permission/i.test(result.error)) {
      console.log("fatal provider error; stopping");
      break;
    }
    continue;
  }

  await saveExplanation(question.id, result.value, model);
  done += 1;
  if (done % 25 === 0) console.log(`  ${done}/${pending.length} done`);
}

const [totals] = await sql(
  "select count(*) filter (where ai_explanation is not null) as done, count(*) as total from public.questions where status='active';",
);
console.log(`\ngenerated ${done}, failed ${failed}`);
console.log(`library now: ${totals.done}/${totals.total} questions have explanations`);
