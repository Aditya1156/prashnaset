// Removes every throwaway account created by scripts or e2e runs.
//
// Test accounts always use the @prashnaset.test domain, which cannot receive
// real mail, so matching on it is safe. Deleting the auth user cascades
// through profiles to anything it owned.
//
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/purge-test-accounts.mjs <ref> [--dry-run]
const ref = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/purge-test-accounts.mjs <ref> [--dry-run]");
  process.exit(1);
}

const keys = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const serviceKey = keys.find((k) => k.name === "service_role").api_key;
const url = `https://${ref}.supabase.co`;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

const targets = [];
for (let page = 1; page <= 20; page++) {
  const { users } = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
    headers,
  }).then((r) => r.json());
  if (!users?.length) break;
  targets.push(...users.filter((u) => u.email?.endsWith("@prashnaset.test")));
  if (users.length < 200) break;
}

if (targets.length === 0) {
  console.log("no test accounts found");
  process.exit(0);
}

console.log(`${dryRun ? "would remove" : "removing"} ${targets.length} test account(s):`);
for (const user of targets) {
  console.log(`  ${user.email}`);
  if (!dryRun) {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers });
  }
}

if (!dryRun) {
  const remaining = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers }).then((r) =>
    r.json(),
  );
  console.log(`\nremaining accounts: ${remaining.users.length}`);
  for (const user of remaining.users) console.log(`  ${user.email}`);
}
