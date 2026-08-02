import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-[0_2px_10px_rgb(35_41_70/0.05)]",
        className,
      )}
      {...props}
    />
  );
}
