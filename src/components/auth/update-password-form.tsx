"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionState, setSessionState] = useState<"checking" | "ok" | "missing">("checking");

  useEffect(() => {
    // Capture the URL credentials before anything can strip them.
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "",
    );
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code = new URLSearchParams(window.location.search).get("code");

    const supabase = createClient();
    let active = true;

    /** A reset link can arrive three ways; accept all of them.
     *  @supabase/ssr is PKCE-only, so fragment tokens (what Supabase sends
     *  when the link wasn't started in this browser — e.g. mail opened on a
     *  phone) must be exchanged by hand. */
    async function establishSession(): Promise<boolean> {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) return true;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) return true;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return true;
      }

      return false;
    }

    void establishSession().then((ok) => {
      if (!active) return;
      if (ok) {
        // Keep the one-time credentials out of the address bar and history.
        window.history.replaceState(null, "", window.location.pathname);
      }
      setSessionState(ok ? "ok" : "missing");
    });

    return () => {
      active = false;
    };
  }, []);

  if (sessionState === "checking") {
    return <p className="py-4 text-center text-sm text-muted">Checking your reset link…</p>;
  }

  if (sessionState === "missing") {
    return (
      <div className="py-2 text-center">
        <p className="text-sm text-muted">
          This page only works right after opening a valid reset link. The link may have
          expired.
        </p>
        <ButtonLink href="/reset" variant="secondary" className="mt-4">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <ErrorBanner message={error} />}
      <div className="space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" className="mt-5 w-full" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
