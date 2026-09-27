import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  answerCallbackQuery,
  buildQuestionMessage,
  formatMatchAnswer,
  formatMcqAnswer,
  formatMsqAllAnswers,
  formatMsqOptionCheck,
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

async function sendPractice(chatId: string | number, count: number) {
  const { data: questions } = await supabase
    .from("questions")
    .select("id, stem, options, correct, type, explanation, topic, difficulty")
    .eq("status", "active")
    .limit(500);

  if (!questions || questions.length === 0) {
    await sendMessage(chatId, "No questions available yet\\. Check back later\\!", {
      parseMode: "MarkdownV2",
    });
    return;
  }

  const picked = shuffle(questions).slice(0, count);

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

    await sendMessage(chatId, text, { parseMode: "MarkdownV2", replyMarkup });
  }
}

async function fetchQuestion(questionId: string) {
  const { data } = await supabase
    .from("questions")
    .select("id, stem, options, correct, type, explanation, topic, difficulty")
    .eq("id", questionId)
    .single();
  if (!data) return null;
  return {
    id: data.id as string,
    stem: data.stem as string,
    options: data.options,
    correct: data.correct,
    type: data.type as string,
    topic: data.topic as string | null,
    difficulty: data.difficulty as string,
    explanation: data.explanation as string | null,
  };
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
  if (parts.length < 3) return;

  const [action, questionId, idxStr] = parts;
  const question = await fetchQuestion(questionId);

  if (!question) {
    await answerCallbackQuery(callbackQuery.id, "Question not found");
    return;
  }

  if (action === "mcq") {
    const { text, toast } = formatMcqAnswer(question, parseInt(idxStr, 10));
    await sendMessage(chatId, text, { parseMode: "MarkdownV2" });
    await answerCallbackQuery(callbackQuery.id, toast);
  } else if (action === "msq") {
    const { text, toast } = formatMsqOptionCheck(question, parseInt(idxStr, 10));
    await sendMessage(chatId, text, { parseMode: "MarkdownV2" });
    await answerCallbackQuery(callbackQuery.id, toast);
  } else if (action === "msa") {
    const text = formatMsqAllAnswers(question);
    await sendMessage(chatId, text, { parseMode: "MarkdownV2" });
    await answerCallbackQuery(callbackQuery.id, "All answers shown");
  } else if (action === "mat") {
    const text = formatMatchAnswer(question);
    await sendMessage(chatId, text, { parseMode: "MarkdownV2" });
    await answerCallbackQuery(callbackQuery.id, "Answer revealed");
  }
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

    if (text === "/start" || text.startsWith("/start ")) {
      const linkCode = text.length > 7 ? text.slice(7).trim() : null;
      let linkedUserId: string | null = null;

      if (linkCode) {
        const { data: codeRow } = await supabase
          .from("telegram_link_codes")
          .select("user_id, created_at")
          .eq("code", linkCode)
          .single();

        if (codeRow) {
          const age =
            Date.now() - new Date(codeRow.created_at as string).getTime();
          if (age < 10 * 60 * 1000) {
            linkedUserId = codeRow.user_id as string;
          }
          await supabase
            .from("telegram_link_codes")
            .delete()
            .eq("code", linkCode);
        }
      }

      const { data: existingRow } = await supabase
        .from("telegram_subscribers")
        .select("id, user_id")
        .eq("chat_id", String(chatId))
        .maybeSingle();

      if (existingRow) {
        await supabase
          .from("telegram_subscribers")
          .update({
            username: message.from?.username ?? null,
            subscribed: true,
            ...(linkedUserId ? { user_id: linkedUserId } : {}),
          })
          .eq("chat_id", String(chatId));
      } else {
        await supabase.from("telegram_subscribers").insert({
          chat_id: String(chatId),
          username: message.from?.username ?? null,
          subscribed: true,
          ...(linkedUserId ? { user_id: linkedUserId } : {}),
        });
      }

      const welcome = linkedUserId
        ? `🔗 *Account linked\\!*\n\n` +
          `Your RattaMaro account is now connected\\.\n` +
          `You'll receive daily practice questions here at 9 AM\\.\n\n`
        : `🙏 *Welcome to RattaMaro\\!*\n\n` +
          `Practice BPSC questions right here in Telegram\\.\n` +
          `MCQ, Multi\\-select, and Match\\-the\\-following — all supported\\.\n\n`;

      await sendMessage(
        chatId,
        welcome +
          `*Commands:*\n` +
          `📝 /practice — 5 random questions\n` +
          `📚 /quiz10 — 10 questions\n` +
          `🎯 /quiz20 — 20 questions\n` +
          `🔕 /stop — Unsubscribe from daily sends\n\n` +
          `You'll also receive daily questions automatically at 9 AM\\!`,
        { parseMode: "MarkdownV2" },
      );
    } else if (text === "/practice") {
      await sendPractice(chatId, 5);
    } else if (text === "/quiz10") {
      await sendPractice(chatId, 10);
    } else if (text === "/quiz20") {
      await sendPractice(chatId, 20);
    } else if (text.startsWith("/setdaily")) {
      const adminKey = process.env.TELEGRAM_ADMIN_KEY;
      const args = text.split(/\s+/);
      if (!adminKey || args.length < 3 || args[2] !== adminKey) {
        await sendMessage(chatId, `Usage: /setdaily <count> <admin\\-key>`, {
          parseMode: "MarkdownV2",
        });
      } else {
        const count = Math.min(50, Math.max(1, parseInt(args[1], 10) || 10));
        await supabase
          .from("telegram_config")
          .upsert({ key: "daily_count", value: String(count) }, { onConflict: "key" });
        await sendMessage(chatId, `✅ Daily question count set to *${count}*`, {
          parseMode: "MarkdownV2",
        });
      }
    } else if (text === "/stop") {
      await supabase
        .from("telegram_subscribers")
        .update({ subscribed: false })
        .eq("chat_id", String(chatId));

      await sendMessage(
        chatId,
        `🔕 Unsubscribed from daily questions\\.\n\nSend /start anytime to re\\-subscribe\\.`,
        { parseMode: "MarkdownV2" },
      );
    } else {
      await sendMessage(
        chatId,
        `📝 /practice — 5 questions\n📚 /quiz10 — 10 questions\n🎯 /quiz20 — 20 questions`,
        { parseMode: "MarkdownV2" },
      );
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
