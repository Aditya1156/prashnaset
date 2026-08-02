import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  /** Dark navy feature variant — use for at most one stat per row. */
  inverted?: boolean;
}

export function StatCard({ label, value, hint, inverted = false }: StatCardProps) {
  return (
    <Card
      className={cn(
        "p-4 sm:p-5",
        inverted && "border-transparent bg-navy shadow-md",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold tracking-[0.14em] uppercase",
          inverted ? "text-on-navy-muted" : "text-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2.5 font-display text-4xl tabular-nums sm:text-[2.6rem] sm:leading-none",
          inverted ? "text-on-navy" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cn(
            "mt-2 text-xs leading-relaxed",
            inverted ? "text-on-navy-muted" : "text-muted",
          )}
        >
          {hint}
        </p>
      )}
    </Card>
  );
}
