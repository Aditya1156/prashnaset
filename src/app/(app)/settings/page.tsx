import { Send } from "lucide-react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TelegramConnect } from "./telegram-connect";

export const metadata = { title: "Settings · RattaMaro" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const { data: linked } = await supabase
    .from("telegram_subscribers")
    .select("chat_id, username")
    .eq("user_id", session.user.id)
    .eq("subscribed", true)
    .maybeSingle();

  return (
    <>
      <PageHeader overline="Account" title="Settings" description="Manage your profile and connected services." />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink">
            <Send className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg text-ink">Telegram</h2>
            <p className="mt-0.5 text-sm text-muted">Connect your Telegram account to receive daily BPSC questions.</p>
          </div>
        </div>
        <div className="mt-4">
          <TelegramConnect
            linked={!!linked}
            username={linked?.username ?? null}
          />
        </div>
      </Card>
    </>
  );
}
