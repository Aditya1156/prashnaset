// Configures production auth: stateless token_hash email links + signup that
// works without a custom SMTP provider.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/configure-auth.mjs <project-ref> <site-url>
const [ref, site] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !site || !token) {
  console.error("usage: SUPABASE_ACCESS_TOKEN=... node scripts/configure-auth.mjs <ref> <site-url>");
  process.exit(1);
}

const recovery = `<h2>Reset your password</h2>

<p>We received a request to reset your PrashnaSet password. Follow the link below to choose a new one.</p>
<p><a href="${site}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>

<p>This link works once and expires in an hour. If you didn't request it, you can safely ignore this email.</p>`;

const confirmation = `<h2>Confirm your email address</h2>

<p>Follow the link below to confirm this address and finish signing up for PrashnaSet.</p>
<p><a href="${site}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard">Confirm email address</a></p>`;

// Template overrides need a paid plan or custom SMTP; opt in with --templates
// once an SMTP provider is configured (the built-in mailer also only delivers
// to project team members, so real learners never receive its email).
const withTemplates = process.argv.includes("--templates");

const body = {
  site_url: site,
  uri_allow_list: `${site}/**,http://localhost:3000/**`,
  // Without a custom SMTP provider, requiring confirmation silently locks out
  // every real learner. Flip back to false once SMTP is configured.
  mailer_autoconfirm: true,
  ...(withTemplates
    ? {
        mailer_templates_recovery_content: recovery,
        mailer_templates_confirmation_content: confirmation,
      }
    : {}),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await res.json();
console.log(`HTTP ${res.status}`);
if (!res.ok) {
  console.log(JSON.stringify(json, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      site_url: json.site_url,
      uri_allow_list: json.uri_allow_list,
      mailer_autoconfirm: json.mailer_autoconfirm,
      recovery_uses_token_hash: String(json.mailer_templates_recovery_content ?? "").includes(
        "token_hash",
      ),
      confirmation_uses_token_hash: String(
        json.mailer_templates_confirmation_content ?? "",
      ).includes("token_hash"),
    },
    null,
    2,
  ),
);
process.exit(res.ok ? 0 : 1);
