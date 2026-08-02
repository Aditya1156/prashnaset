// Runs a SQL file against a Supabase project via the Management API.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/mgmt-query.mjs <project-ref> <sql-file>
import { readFileSync } from "node:fs";

const [ref, file] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !file || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/mgmt-query.mjs <ref> <sql-file>");
  process.exit(1);
}

const query = readFileSync(file, "utf8").replace(/^﻿/, "");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
