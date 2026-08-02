import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/signin-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await props.searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your question bank."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm
        next={safeNext}
        initialError={
          error === "link" ? "That sign-in link was invalid or expired. Try again." : null
        }
      />
    </AuthCard>
  );
}
