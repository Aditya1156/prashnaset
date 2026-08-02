"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "@/components/auth/error-banner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ next, initialError }: { next: string; initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

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

  return (
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
              className="text-xs text-accent underline-offset-4 hover:underline"
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
      <Button type="submit" className="mt-5 w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}
