"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      aria-label="Sign out"
      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fill/60 disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden />
    </button>
  );
}
