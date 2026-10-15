// Reports which sign-in methods a Supabase project actually has enabled.
//
// /auth/v1/settings is public (it is what the client reads to decide which
// buttons to show), so this needs only the publishable key — no service role,
// no dashboard login.
//
// Usage: node scripts/check-auth-providers.mjs
//        node scripts/check-auth-providers.mjs <supabase-url> <publishable-key>
import { readFileSync } from "node:fs";

function fromEnvFile() {
  try {
    const text = readFileSync(".env.local", "utf8");
    const url = text.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
    const key =
      text.match(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)$/m)?.[1]?.trim() ??
      text.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();
    return { url, key };
  } catch {
    return {};
  }
}

const [argUrl, argKey] = process.argv.slice(2);
const { url: envUrl, key: envKey } = fromEnvFile();
const url = argUrl ?? envUrl;
const key = argKey ?? envKey;

if (!url || !key) {
  console.error("usage: node scripts/check-auth-providers.mjs [supabase-url] [publishable-key]");
  console.error("(reads .env.local when arguments are omitted)");
  process.exit(1);
}

const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
if (!response.ok) {
  console.error(`Couldn't read auth settings: HTTP ${response.status}`);
  process.exit(1);
}

const settings = await response.json();
const external = settings.external ?? {};
const enabled = Object.entries(external)
  .filter(([, on]) => on)
  .map(([name]) => name);

console.log(`project:            ${new URL(url).host.split(".")[0]}`);
console.log(`email sign-in:      ${external.email ? "on" : "OFF"}`);
console.log(`google sign-in:     ${external.google ? "on" : "OFF"}`);
console.log(`signups allowed:    ${settings.disable_signup ? "NO" : "yes"}`);
console.log(`email autoconfirm:  ${settings.mailer_autoconfirm ? "yes" : "no"}`);
console.log(`all providers on:   ${enabled.join(", ") || "(none)"}`);

if (!external.google) {
  console.log(
    "\nGoogle is off. The app already renders a “Continue with Google” button and\n" +
      "handles the callback, so the button will fail until the provider is enabled in\n" +
      "Supabase → Authentication → Providers → Google.",
  );
}

// Non-zero when Google is off, so this can gate a deploy check if wanted.
process.exit(external.google ? 0 : 2);
