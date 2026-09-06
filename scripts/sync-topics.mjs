// Copies topic tags from one Supabase project to another, matching on
// question id. Tagging costs model calls, so it is done once — against a
// local copy of the library — and the result is carried up rather than paid
// for twice. Safe to re-run: it only fills tags that are missing or changed.
//
// Usage:
//   node scripts/sync-topics.mjs --from-url=... --from-key=... --to-url=... --to-key=...
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=")];
    }),
);

for (const required of ["from-url", "from-key", "to-url", "to-key"]) {
  if (!args[required]) {
    console.error(`missing --${required}`);
    process.exit(1);
  }
}

const headers = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
});
const source = { url: `${args["from-url"]}/rest/v1`, headers: headers(args["from-key"]) };
const target = { url: `${args["to-url"]}/rest/v1`, headers: headers(args["to-key"]) };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** PostgREST caps a response at 1000 rows regardless of `limit`. */
async function readAll(endpoint, query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await withRetry("read", async () => {
      const res = await fetch(`${endpoint.url}/${query}`, {
        headers: { ...endpoint.headers, Range: `${from}-${from + 999}` },
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
      return res.json();
    });
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const tagged = await readAll(source, "questions?topic=not.is.null&select=id,topic");
console.log(`source has ${tagged.length} tagged question(s)`);

const existing = await readAll(target, "questions?select=id,topic");
const current = new Map(existing.map((row) => [row.id, row.topic]));
console.log(`target has ${existing.length} question(s)`);

const pending = tagged.filter((row) => current.has(row.id) && current.get(row.id) !== row.topic);
const missing = tagged.filter((row) => !current.has(row.id)).length;
console.log(`${pending.length} to update, ${missing} source id(s) absent from the target`);

let done = 0;
let failed = 0;
for (const row of pending) {
  try {
    await withRetry("write", async () => {
      const res = await fetch(`${target.url}/questions?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { ...target.headers, Prefer: "return=minimal" },
        body: JSON.stringify({ topic: row.topic }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    });
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${pending.length}`);
  } catch (error) {
    failed += 1;
    if (failed <= 5) console.log(`  ! ${row.id} -> ${String(error).slice(0, 120)}`);
  }
}

const after = await readAll(target, "questions?topic=not.is.null&select=id");
console.log(`\nupdated ${done}, failed ${failed}`);
console.log(`target now has ${after.length} tagged question(s)`);
