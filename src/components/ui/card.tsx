import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Flat: a hairline border carries the edge, so the drop shadow and
        // the large radius are both gone.
        "rounded-xl border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}
