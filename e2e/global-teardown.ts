import { createClient } from "@supabase/supabase-js";

/** Deletes every e2e account (…@prashnaset.test) after a run. The library
 *  is shared product-wide, so leftover test content would otherwise show up
 *  for real local users. Local stacks only. */

const LOCAL_DEMO_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return;

  const service = createClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_DEMO_SERVICE_ROLE,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let removed = 0;
  // Deleting an auth user cascades through profiles to their content.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    const targets = data.users.filter((u) => u.email?.endsWith("@prashnaset.test"));
    for (const user of targets) {
      const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
      if (!deleteError) removed += 1;
    }
    if (data.users.length < 200) break;
  }
  if (removed > 0) console.log(`[teardown] removed ${removed} e2e account(s)`);
}
