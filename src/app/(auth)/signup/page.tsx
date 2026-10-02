import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/signup-form";
import { createClient } from "@/lib/supabase/server";
import type { BatchRow } from "@/lib/types";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data: batchRows } = await supabase
    .from("batches")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const batches = (batchRows ?? []) as Pick<BatchRow, "id" | "name">[];

  return (
    <AuthCard
      title="Create your account"
      subtitle="Import your questions and take your first test tonight."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/signin"
            className="-my-2 inline-block py-2 text-accent underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm batches={batches} />
    </AuthCard>
  );
}
