import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max: number;
  className?: string;
  label?: string;
  tone?: "accent" | "success" | "warn" | "danger";
}

export function Progress({ value, max, className, label, tone }: ProgressProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barClass = { accent: "bg-accent-fill", success: "bg-success", warn: "bg-warn", danger: "bg-danger" }[tone ?? "accent"];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label ?? "Progress"}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-raised", className)}
    >
      <div
        className={`h-full rounded-full ${barClass} transition-[width] duration-300`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
