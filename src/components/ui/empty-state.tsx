import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-accent-soft/30 via-transparent to-transparent" />
      <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
