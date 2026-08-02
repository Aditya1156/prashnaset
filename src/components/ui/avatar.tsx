import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + second).toUpperCase();
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-ink",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
