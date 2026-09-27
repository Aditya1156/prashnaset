const API = "https://api.telegram.org";

function botUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `${API}/bot${token}/${method}`;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  extra?: {
    parseMode?: "Markdown" | "HTML";
    replyMarkup?: unknown;
  },
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };
  if (extra?.parseMode) body.parse_mode = extra.parseMode;
  if (extra?.replyMarkup) body.reply_markup = extra.replyMarkup;

  const res = await fetch(botUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; result?: unknown }>;
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  await fetch(botUrl("answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export function buildQuestionMessage(
  index: number,
  total: number,
  stem: string,
  options: string[],
  questionId: string,
): { text: string; replyMarkup: unknown } {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const optionLines = options
    .map((opt, i) => `${letters[i]}. ${opt}`)
    .join("\n");

  const text = `📚 *Q${index}/${total}*\n\n${escapeMd(stem)}\n\n${escapeMd(optionLines)}`;

  const inlineKeyboard = options.map((opt, i) => [
    {
      text: `${letters[i]}. ${opt.length > 40 ? opt.slice(0, 37) + "..." : opt}`,
      callback_data: `ans:${questionId}:${i}`,
    },
  ]);

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboard },
  };
}

function escapeMd(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
