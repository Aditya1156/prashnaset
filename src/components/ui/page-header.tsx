import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  overline?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, overline, description, actions, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      {/* Two rules keep a long title readable next to a row of buttons:
          flex-1 makes this block claim the leftover space instead of sizing to
          its content, and a wide basis means a crowded row of (shrink-0) actions wraps onto
          their own line rather than squeezing the title into a one-word-per-
          line column. */}
      <div className="min-w-0 flex-1 sm:basis-[32rem]">
        {overline && (
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
            <span className="h-0.5 w-6 rounded-full bg-ink" aria-hidden />
            {overline}
          </p>
        )}
        <h1 className="font-display text-3xl tracking-tight break-words text-ink sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
