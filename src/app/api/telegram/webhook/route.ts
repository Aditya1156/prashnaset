import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  answerCallbackQuery,
  buildQuestionMessage,
  sendMessage,
} from "@/lib/telegram";

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

async function sendPractice(chatId: string | number, count = 5) {
  const { data: questions } = await supabase
    .from("questions")
    .select("id, stem, options, correct, type, explanation, topic, difficulty")
    .eq("status", "active")
    .eq("type", "mcq")
    .limit(200);

  if (!questions || questions.length === 0) {
    await sendMessage(chatId, "No questions available yet. Check back later!");
    return;
  }

  const picked = shuffle(questions).slice(0, count);

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

    await sendMessage(chatId, text, {
      parseMode: "Markdown",
      replyMarkup,
    });
  }
}

async function handleCallback(callbackQuery: {
  id: string;
  data?: string;
  message?: { chat: { id: number } };
}) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat.id;
  if (!data || !chatId) return;

  const parts = data.split(":");
  if (parts[0] !== "ans" || parts.length !== 3) return;

  const questionId = parts[1];
  const selectedIdx = parseInt(parts[2], 10);

  const { data: question } = await supabase
    .from("questions")
    .select("options, correct, explanation")
    .eq("id", questionId)
    .single();

  if (!question) {
    await answerCallbackQuery(callbackQuery.id, "Question not found");
    return;
  }

  const options = question.options as string[];
  const selectedOption = options[selectedIdx];
  const isCorrect = selectedOption === question.correct;

  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const correctIdx = options.indexOf(question.correct as string);
  const correctLetter = correctIdx >= 0 ? letters[correctIdx] : "?";

  let reply: string;
  if (isCorrect) {
    reply = "✅ *Correct\\!*";
  } else {
    reply = `❌ *Wrong\\!*\n\nCorrect answer: *${correctLetter}*`;
  }

  if (question.explanation) {
    const escaped = (question.explanation as string).replace(
      /([_*[\]()~`>#+\-=|{}.!])/g,
      "\\$1",
    );
    reply += `\n\n💡 ${escaped}`;
  }

  await sendMessage(chatId, reply, { parseMode: "Markdown" });
  await answerCallbackQuery(callbackQuery.id, isCorrect ? "✅ Correct!" : "❌ Wrong");
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.callback_query) {
      await handleCallback(
        body.callback_query as {
          id: string;
          data?: string;
          message?: { chat: { id: number } };
        },
      );
      return NextResponse.json({ ok: true });
    }

    const message = body.message as
      | { chat: { id: number }; text?: string; from?: { username?: string } }
      | undefined;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text === "/start") {
      await supabase.from("telegram_subscribers").upsert(
        {
          chat_id: String(chatId),
          username: message.from?.username ?? null,
          subscribed: true,
        },
        { onConflict: "chat_id" },
      );

      await sendMessage(
        chatId,
        "🙏 *Welcome to PrashnaSet\\!*\n\n" +
          "You'll receive daily BPSC practice questions here\\.\n\n" +
          "Commands:\n" +
          "/practice — Get 5 random questions now\n" +
          "/quiz10 — Get 10 questions\n" +
          "/stop — Unsubscribe from daily questions\n\n" +
          "Tap an answer to see if you're right\\!",
        { parseMode: "Markdown" },
      );
    } else if (text === "/practice") {
      await sendPractice(chatId, 5);
    } else if (text === "/quiz10") {
      await sendPractice(chatId, 10);
    } else if (text === "/stop") {
      await supabase
        .from("telegram_subscribers")
        .update({ subscribed: false })
        .eq("chat_id", String(chatId));

      await sendMessage(
        chatId,
        "You've been unsubscribed from daily questions\\. Send /start to re\\-subscribe anytime\\.",
        { parseMode: "Markdown" },
      );
    } else {
      await sendMessage(
        chatId,
        "Send /practice for 5 questions or /quiz10 for 10\\.",
        { parseMode: "Markdown" },
      );
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
