#!/usr/bin/env node
// Register the Telegram webhook after deploying to Vercel.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=<token> WEBHOOK_URL=https://prashnaset.vercel.app node scripts/register-telegram-webhook.mjs
//
// Or for local testing with ngrok:
//   TELEGRAM_BOT_TOKEN=<token> WEBHOOK_URL=https://<ngrok-id>.ngrok.io node scripts/register-telegram-webhook.mjs

const token = process.env.TELEGRAM_BOT_TOKEN;
const baseUrl = process.env.WEBHOOK_URL;

if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN env var");
  process.exit(1);
}
if (!baseUrl) {
  console.error("Set WEBHOOK_URL env var (e.g. https://prashnaset.vercel.app)");
  process.exit(1);
}

const webhookUrl = `${baseUrl}/api/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: webhookUrl }),
});

const data = await res.json();
console.log("setWebhook response:", JSON.stringify(data, null, 2));

if (data.ok) {
  console.log(`\n✓ Webhook registered: ${webhookUrl}`);
} else {
  console.error("\n✗ Failed to register webhook");
  process.exit(1);
}
