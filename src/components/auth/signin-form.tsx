"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ next, initialError }: { next: string; initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password."
          : signInError.message,
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
        <span className="text-xs font-medium text-faint">or sign in with email</span>
        <span className="h-px flex-1 bg-gradient-to-r from-line via-accent/20 to-line" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                Password
              </label>
              <Link
                href="/reset"
                className="-my-2 inline-block py-2 text-xs text-accent underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" className="mt-6 w-full shadow-[0_0_20px_rgb(232,161,0,0.2)]" loading={loading}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
