import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warn" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-raised text-muted",
  accent: "bg-accent-soft text-accent-soft-ink",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
