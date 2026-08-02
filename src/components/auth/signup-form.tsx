"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
        data: { display_name: name.trim() },
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

  return (
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
      <Button type="submit" className="mt-5 w-full" loading={loading}>
        Create account
      </Button>
    </form>
  );
}
