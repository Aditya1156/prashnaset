// Creates throwaway accounts for scripts, and guarantees they are removed
// even if the script is interrupted.
//
// Earlier scripts deleted their accounts on the last line, which meant a
// Ctrl+C or a killed session left real-looking admins sitting in the
// production user list. Cleanup is now registered with the process, so exit,
// SIGINT, SIGTERM and uncaught errors all trigger it.
//
// SIGKILL still cannot be caught — scripts/purge-test-accounts.mjs is the
// safety net for that case.

const TEST_DOMAIN = "@prashnaset.test";

export async function createThrowawayFactory(ref, token) {
  const keys = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const serviceKey = keys.find((k) => k.name === "service_role").api_key;
  const url = `https://${ref}.supabase.co`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const created = new Set();
  let cleaning = false;

  async function cleanup() {
    if (cleaning) return;
    cleaning = true;
    for (const id of created) {
      try {
        await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers });
      } catch {
        // Best effort: the purge script covers anything that slips through.
      }
    }
    if (created.size > 0) console.log(`cleaned up ${created.size} throwaway account(s)`);
    created.clear();
  }

  // Synchronous exit can't await, so also handle the signals that precede it.
  process.on("exit", () => {
    if (created.size > 0) {
      console.log(`WARNING: ${created.size} throwaway account(s) may remain; run purge-test-accounts.mjs`);
    }
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    process.on(signal, async () => {
      await cleanup();
      process.exit(130);
    });
  }
  process.on("uncaughtException", async (error) => {
    console.error(error);
    await cleanup();
    process.exit(1);
  });

  return {
    /** Creates a confirmed account, optionally promoted to admin. */
    async create(tag, { admin = false } = {}) {
      const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${TEST_DOMAIN}`;
      const password = `Tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      const user = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: `Temp ${tag}` },
        }),
      }).then((r) => r.json());
      if (!user?.id) throw new Error(`could not create throwaway: ${JSON.stringify(user).slice(0, 200)}`);
      created.add(user.id);

      if (admin) {
        await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ role: "admin" }),
        });
      }
      return { id: user.id, email, password };
    },
    cleanup,
  };
}
