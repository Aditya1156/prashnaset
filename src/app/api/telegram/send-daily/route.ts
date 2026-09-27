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

async function getDailyCount(): Promise<number> {
  const { data } = await supabase
    .from("telegram_config")
    .select("value")
    .eq("key", "daily_count")
    .single();
  if (data?.value) return parseInt(data.value as string, 10) || 10;
  return parseInt(process.env.TELEGRAM_DAILY_COUNT ?? "10", 10);
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

  const [{ data: subscribers }, dailyCount] = await Promise.all([
    supabase
      .from("telegram_subscribers")
      .select("chat_id")
      .eq("subscribed", true),
    getDailyCount(),
  ]);

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: "No subscribers" });
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, stem, options, correct, type, explanation, topic, difficulty")
    .eq("status", "active")
    .limit(500);

  if (!questions || questions.length === 0) {
    return NextResponse.json({ sent: 0, message: "No questions available" });
  }

  let sentCount = 0;

  for (const sub of subscribers) {
    const picked = shuffle(questions).slice(0, dailyCount);

    try {
      await sendMessage(
        sub.chat_id as string,
        `🌅 *Good morning\\!*\n\n` +
          `Here are your ${picked.length} daily BPSC practice questions\\.\n` +
          `Tap an answer to check — good luck\\! 💪`,
        { parseMode: "MarkdownV2" },
      );

      for (let i = 0; i < picked.length; i++) {
        const q = picked[i];
        const qData = {
          id: q.id as string,
          stem: q.stem as string,
          options: q.options,
          correct: q.correct,
          type: q.type as string,
          topic: q.topic as string | null,
          difficulty: q.difficulty as string,
          explanation: q.explanation as string | null,
        };

        if (qData.type === "match") {
          const opts = qData.options as { left?: string[]; right?: string[] } | null;
          if (!opts?.left || !opts?.right) continue;
        } else {
          const opts = qData.options;
          if (!Array.isArray(opts) || opts.length < 2) continue;
        }

        const { text, replyMarkup } = buildQuestionMessage(i + 1, picked.length, qData);
        await sendMessage(sub.chat_id as string, text, {
          parseMode: "MarkdownV2",
          replyMarkup,
        });
      }
      sentCount++;
    } catch (err) {
      console.error(`Failed to send to ${sub.chat_id}:`, err);
    }
  }

  return NextResponse.json({
    sent: sentCount,
    total: subscribers.length,
    dailyCount,
  });
}
