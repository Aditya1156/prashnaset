"use client";

import { MailCheck } from "lucide-react";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <h2 className="mt-4 font-display text-lg text-ink">Check your inbox</h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted">
          If an account exists for <span className="font-medium text-ink">{email}</span>, a
          password reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <ErrorBanner message={error} />}
      <Field
        label="Email"
        htmlFor="email"
        hint="We'll send a link that lets you set a new password."
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Button type="submit" className="mt-5 w-full" loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
