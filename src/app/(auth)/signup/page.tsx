import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Import your questions and take your first test tonight."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
