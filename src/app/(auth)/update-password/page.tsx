import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Set a new password" subtitle="You're signed in via your reset link.">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
