"use client";

import { LinkIcon, Loader2, Send, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateLinkCode, unlinkTelegram } from "@/lib/actions/telegram";

const BOT_USERNAME = "Rattamaro_bot";

interface Props {
  linked: boolean;
  username: string | null;
}

export function TelegramConnect({ linked, username }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      const result = await generateLinkCode();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setCode(result.code!);
    });
  }

  function handleUnlink() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkTelegram();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  if (linked) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
            <Send className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              Connected
              {username ? (
                <span className="ml-1 text-muted">@{username}</span>
              ) : null}
            </p>
            <p className="text-xs text-muted">
              You receive daily questions on Telegram.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:hover:border-red-700 dark:hover:text-red-400"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Unlink className="size-3.5" />
            )}
            Disconnect
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (code) {
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${code}`;
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
            <LinkIcon className="size-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              Tap the button below to open Telegram
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Then tap <strong>Start</strong> in the chat — your account will be
              linked automatically. Code expires in 10 minutes.
            </p>
          </div>
        </div>

        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#2AABEE] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Send className="size-4" />
          Open in Telegram
        </a>

        <p className="mt-3 text-center text-xs text-muted">
          After tapping Start in Telegram,{" "}
          <button
            type="button"
            onClick={() => {
              setCode(null);
              router.refresh();
            }}
            className="font-medium text-accent underline underline-offset-2"
          >
            refresh this page
          </button>{" "}
          to see your connection status.
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised">
            <Send className="size-5 text-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Not connected</p>
            <p className="text-xs text-muted">
              Link your Telegram to get daily practice questions.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleConnect}
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LinkIcon className="size-4" />
          )}
          Connect Telegram
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
