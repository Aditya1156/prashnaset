const API = "https://api.telegram.org";

function botUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `${API}/bot${token}/${method}`;
}

export function esc(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  extra?: {
    parseMode?: "MarkdownV2" | "HTML";
    replyMarkup?: unknown;
  },
) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
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

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DIFF_ICON: Record<string, string> = {
  easy: "🟢",
  medium: "🟡",
  hard: "🔴",
};
const TYPE_LABEL: Record<string, string> = {
  mcq: "Single correct",
  msq: "Multi correct",
  match: "Match the following",
};

interface QuestionData {
  id: string;
  stem: string;
  options: unknown;
  correct: unknown;
  type: string;
  topic?: string | null;
  difficulty?: string;
  explanation?: string | null;
}

function header(index: number, total: number, q: QuestionData): string {
  const topic = q.topic ? esc(q.topic) : "General";
  const diff = DIFF_ICON[q.difficulty ?? "medium"] ?? "🟡";
  const typeLabel = TYPE_LABEL[q.type] ?? q.type;

  return (
    `📚 *Question ${index} of ${total}*\n` +
    `${diff} ${esc(typeLabel)}  ·  🏷 ${topic}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n`
  );
}

export function buildMcqMessage(
  index: number,
  total: number,
  q: QuestionData,
): { text: string; replyMarkup: unknown } {
  const options = q.options as string[];
  const optionLines = options.map((opt, i) => `*${LETTERS[i]}\\.* ${esc(opt)}`).join("\n");

  const text = header(index, total, q) + `${esc(q.stem)}\n\n${optionLines}`;

  const inlineKeyboard = options.map((opt, i) => [
    {
      text: `${LETTERS[i]}. ${opt.length > 50 ? opt.slice(0, 47) + "..." : opt}`,
      callback_data: `mcq:${q.id}:${i}`,
    },
  ]);

  return { text, replyMarkup: { inline_keyboard: inlineKeyboard } };
}

export function buildMsqMessage(
  index: number,
  total: number,
  q: QuestionData,
): { text: string; replyMarkup: unknown } {
  const options = q.options as string[];
  const optionLines = options.map((opt, i) => `*${LETTERS[i]}\\.* ${esc(opt)}`).join("\n");

  const text =
    header(index, total, q) +
    `${esc(q.stem)}\n\n${optionLines}\n\n` +
    `_Tap each option to check if it's correct_`;

  const inlineKeyboard = options.map((opt, i) => [
    {
      text: `${LETTERS[i]}. ${opt.length > 50 ? opt.slice(0, 47) + "..." : opt}`,
      callback_data: `msq:${q.id}:${i}`,
    },
  ]);
  inlineKeyboard.push([
    { text: "📋 Show all correct answers", callback_data: `msa:${q.id}:0` },
  ]);

  return { text, replyMarkup: { inline_keyboard: inlineKeyboard } };
}

export function buildMatchMessage(
  index: number,
  total: number,
  q: QuestionData,
): { text: string; replyMarkup: unknown } {
  const opts = q.options as { left: string[]; right: string[] };

  let table = "";
  for (let i = 0; i < opts.left.length; i++) {
    table += `${i + 1}\\. ${esc(opts.left[i])}  →  ❓\n`;
  }
  table += "\n*Options:*\n";
  for (let i = 0; i < opts.right.length; i++) {
    table += `${LETTERS[i]}\\. ${esc(opts.right[i])}\n`;
  }

  const text =
    header(index, total, q) +
    `${esc(q.stem)}\n\n${table}\n` +
    `_Think of your answer, then tap below_`;

  const inlineKeyboard = [
    [{ text: "👀 Show correct matching", callback_data: `mat:${q.id}:0` }],
  ];

  return { text, replyMarkup: { inline_keyboard: inlineKeyboard } };
}

export function buildQuestionMessage(
  index: number,
  total: number,
  q: QuestionData,
): { text: string; replyMarkup: unknown } {
  if (q.type === "msq") return buildMsqMessage(index, total, q);
  if (q.type === "match") return buildMatchMessage(index, total, q);
  return buildMcqMessage(index, total, q);
}

export function formatMcqAnswer(
  q: QuestionData,
  selectedIdx: number,
): { text: string; toast: string } {
  const options = q.options as string[];
  const selectedOption = options[selectedIdx];
  const isCorrect = selectedOption === q.correct;
  const correctIdx = options.indexOf(q.correct as string);
  const correctLetter = correctIdx >= 0 ? LETTERS[correctIdx] : "?";

  let text: string;
  if (isCorrect) {
    text = `✅ *Correct\\!*  You chose *${LETTERS[selectedIdx]}*`;
  } else {
    text =
      `❌ *Wrong\\!*  You chose *${LETTERS[selectedIdx]}*\n\n` +
      `✅ Correct answer: *${correctLetter}\\. ${esc(options[correctIdx] ?? "")}*`;
  }

  if (q.explanation) {
    text += `\n\n━━━━━━━━━━━━━━━━━━━━\n💡 *Explanation:*\n${esc(q.explanation)}`;
  }

  return { text, toast: isCorrect ? "✅ Correct!" : "❌ Wrong" };
}

export function formatMsqOptionCheck(
  q: QuestionData,
  selectedIdx: number,
): { text: string; toast: string } {
  const options = q.options as string[];
  const correctArr = q.correct as string[];
  const selectedOption = options[selectedIdx];
  const isCorrect = correctArr.includes(selectedOption);

  const toast = isCorrect
    ? `✅ ${LETTERS[selectedIdx]} is correct!`
    : `❌ ${LETTERS[selectedIdx]} is not correct`;

  const text = isCorrect
    ? `✅ *${LETTERS[selectedIdx]}\\. ${esc(selectedOption)}* — Yes, this is one of the correct answers`
    : `❌ *${LETTERS[selectedIdx]}\\. ${esc(selectedOption)}* — No, this is not a correct answer`;

  return { text, toast };
}

export function formatMsqAllAnswers(q: QuestionData): string {
  const options = q.options as string[];
  const correctArr = q.correct as string[];

  let text = `📋 *All correct answers:*\n\n`;
  for (let i = 0; i < options.length; i++) {
    const mark = correctArr.includes(options[i]) ? "✅" : "❌";
    text += `${mark} *${LETTERS[i]}\\.* ${esc(options[i])}\n`;
  }

  if (q.explanation) {
    text += `\n━━━━━━━━━━━━━━━━━━━━\n💡 *Explanation:*\n${esc(q.explanation)}`;
  }

  return text;
}

export function formatMatchAnswer(q: QuestionData): string {
  const opts = q.options as { left: string[]; right: string[] };
  const correctMapping = q.correct as string[];

  let text = `✅ *Correct matching:*\n\n`;
  for (let i = 0; i < opts.left.length; i++) {
    text += `${i + 1}\\. ${esc(opts.left[i])}  →  *${esc(correctMapping[i] ?? "?")}*\n`;
  }

  if (q.explanation) {
    text += `\n━━━━━━━━━━━━━━━━━━━━\n💡 *Explanation:*\n${esc(q.explanation)}`;
  }

  return text;
}
