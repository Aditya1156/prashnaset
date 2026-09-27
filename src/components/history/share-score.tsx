"use client";

import { Share2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { ScoreTone } from "@/lib/utils";

interface ShareScoreProps {
  label: string;
  percent: number;
  correct: number;
  total: number;
  tone: ScoreTone;
  date: string;
}

const TONE_BG = {
  success: "#059669",
  warn: "#d97706",
  danger: "#dc2626",
} as const;

function drawCard(
  canvas: HTMLCanvasElement,
  { label, percent, correct, total, tone, date }: ShareScoreProps,
) {
  const w = 600;
  const h = 340;
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 20);
  ctx.fill();

  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.roundRect(16, 16, w - 32, h - 32, 12);
  ctx.fill();

  ctx.fillStyle = "#e8a100";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.fillText("RattaMaro", 36, 50);

  ctx.fillStyle = "#64748b";
  ctx.font = "400 12px Inter, system-ui, sans-serif";
  const dateW = ctx.measureText(date).width;
  ctx.fillText(date, w - 36 - dateW, 50);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 18px Inter, system-ui, sans-serif";
  const titleText = label.length > 40 ? label.slice(0, 37) + "..." : label;
  ctx.fillText(titleText, 36, 90);

  const cx = w / 2;
  const cy = 190;
  const r = 60;
  ctx.lineWidth = 10;

  ctx.strokeStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const fraction = percent / 100;
  ctx.strokeStyle = TONE_BG[tone];
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 36px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${percent}%`, cx, cy + 13);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 13px Inter, system-ui, sans-serif";
  ctx.fillText(`${correct} of ${total} correct`, cx, cy + r + 30);
  ctx.textAlign = "start";

  ctx.fillStyle = "#475569";
  ctx.font = "400 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("rattamaro.in", cx, h - 28);
  ctx.textAlign = "start";
}

export function ShareScoreButton(props: ShareScoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);

    try {
      drawCard(canvas, props);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png"),
      );
      const file = new File([blob], "rattamaro-score.png", { type: "image/png" });

      const text = `${props.label} — ${props.percent}% (${props.correct}/${props.total})\nPractice on RattaMaro`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ text });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "rattamaro-score.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }
    } catch {
      // User cancelled or share failed — nothing to do
    } finally {
      setBusy(false);
    }
  }, [props, busy]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-medium text-accent-soft-ink transition-colors hover:bg-accent-fill hover:text-on-accent disabled:opacity-50"
      >
        <Share2 className="size-4" aria-hidden />
        {busy ? "Sharing..." : "Share score"}
      </button>
    </>
  );
}
