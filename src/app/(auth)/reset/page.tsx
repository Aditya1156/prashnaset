import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link
          href="/signin"
          className="-my-2 inline-block py-2 text-accent underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <ResetForm />
    </AuthCard>
  );
}
