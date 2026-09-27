"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TelegramLinkStatus {
  linked: boolean;
  username?: string | null;
  chatId?: string;
}

export async function getTelegramStatus(): Promise<TelegramLinkStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { linked: false };

  const { data } = await supabase
    .from("telegram_subscribers")
    .select("chat_id, username")
    .eq("user_id", user.id)
    .eq("subscribed", true)
    .maybeSingle();

  if (!data) return { linked: false };
  return { linked: true, username: data.username, chatId: data.chat_id };
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function generateLinkCode(): Promise<{
  ok: boolean;
  code?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("telegram_subscribers")
    .select("id")
    .eq("user_id", user.id)
    .eq("subscribed", true)
    .maybeSingle();
  if (existing) return { ok: false, error: "Already linked." };

  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);

  const code = randomCode();
  const { error } = await supabase
    .from("telegram_link_codes")
    .insert({ code, user_id: user.id });

  if (error) return { ok: false, error: "Could not generate code." };
  return { ok: true, code };
}

export async function unlinkTelegram(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("telegram_subscribers")
    .update({ user_id: null })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Could not unlink." };
  revalidatePath("/settings");
  return { ok: true };
}
