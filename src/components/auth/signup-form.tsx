"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export interface BatchOption {
  id: string;
  name: string;
}

export function SignUpForm({ batches }: { batches: BatchOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim(), batch_id: batchId || undefined },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "An account with this email already exists — try signing in."
          : signUpError.message,
      );
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Email confirmation is enabled on this Supabase project.
    setAwaitingConfirm(true);
  }

  if (awaitingConfirm) {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <h2 className="mt-4 font-display text-lg text-ink">Confirm your email</h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
          Open it to activate your account, then sign in.
        </p>
      </div>
    );
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fdashboard`,
      },
    });
    setGoogleLoading(false);
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={googleLoading}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface text-sm font-medium text-ink shadow-sm transition-all hover:bg-raised hover:border-accent/30 hover:shadow-[0_0_12px_rgb(232,161,0,0.08)] disabled:opacity-60"
      >
        <GoogleIcon className="size-4.5" />
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-line via-accent/20 to-line" />
        <span className="text-xs font-medium text-faint">or sign up with email</span>
        <span className="h-px flex-1 bg-gradient-to-r from-line via-accent/20 to-line" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              placeholder="What should we call you?"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {batches.length > 0 && (
            <Field label="Batch" htmlFor="batch">
              <Select
                id="batch"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Email" htmlFor="email">
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
          <Field label="Password" htmlFor="password" hint="At least 8 characters.">
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
          <Field label="Confirm password" htmlFor="confirm">
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
        <Button type="submit" className="mt-6 w-full shadow-[0_0_20px_rgb(232,161,0,0.2)]" loading={loading}>
          Create account
        </Button>
      </form>
    </div>
  );
}
