import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildQuestionMessage, sendMessage } from "@/lib/telegram";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
);

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  const { data: subscribers } = await supabase
    .from("telegram_subscribers")
    .select("chat_id")
    .eq("subscribed", true);

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: "No subscribers" });
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, stem, options, correct, type, explanation, topic")
    .eq("status", "active")
    .eq("type", "mcq")
    .limit(200);

  if (!questions || questions.length === 0) {
    return NextResponse.json({ sent: 0, message: "No questions available" });
  }

  let sentCount = 0;

  for (const sub of subscribers) {
    const picked = shuffle(questions).slice(0, 5);

    try {
      const intro = `🌅 *Good morning\\!*\n\nHere are your 5 daily BPSC practice questions\\.`;
      await sendMessage(sub.chat_id as string, intro, { parseMode: "Markdown" });

      for (let i = 0; i < picked.length; i++) {
        const q = picked[i];
        const options = q.options as string[];
        if (!Array.isArray(options) || options.length < 2) continue;

        const { text, replyMarkup } = buildQuestionMessage(
          i + 1,
          picked.length,
          q.stem as string,
          options,
          q.id as string,
        );

        await sendMessage(sub.chat_id as string, text, {
          parseMode: "Markdown",
          replyMarkup,
        });
      }
      sentCount++;
    } catch (err) {
      console.error(`Failed to send to ${sub.chat_id}:`, err);
    }
  }

  return NextResponse.json({ sent: sentCount, total: subscribers.length });
}
