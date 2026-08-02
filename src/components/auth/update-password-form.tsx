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
    const supabase = createClient();
    let active = true;
    let settled = false;

    const accept = () => {
      if (!active || settled) return;
      settled = true;
      setSessionState("ok");
    };

    // A recovery link delivers the session in the URL fragment, which the
    // client parses just after mount — so watch for it rather than reading
    // once and giving up.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) accept();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        accept();
        return;
      }
      // Fragment parsing hasn't finished yet; re-check before declaring the
      // link dead.
      setTimeout(() => {
        void supabase.auth.getSession().then(({ data: retry }) => {
          if (!active || settled) return;
          if (retry.session) accept();
          else {
            settled = true;
            setSessionState("missing");
          }
        });
      }, 2000);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
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
