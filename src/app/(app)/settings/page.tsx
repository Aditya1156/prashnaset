import { redirect } from "next/navigation";
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
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
        Settings
      </h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Telegram</h2>
        <p className="mt-1 text-sm text-muted">
          Connect your Telegram account to receive daily BPSC questions
          automatically.
        </p>

        <div className="mt-4">
          <TelegramConnect
            linked={!!linked}
            username={linked?.username ?? null}
          />
        </div>
      </section>
    </>
  );
}
