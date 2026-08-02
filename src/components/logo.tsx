import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Logo({ href = "/", size = "md", className }: LogoProps) {
  const mark = (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("shrink-0", size === "md" ? "size-8" : "size-7")}
    >
      <rect width="64" height="64" rx="14" className="fill-accent-fill" />
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontFamily="Nirmala UI, Noto Sans Devanagari, Mangal, sans-serif"
        fontSize="30"
        fontWeight="600"
        fill="#ffffff"
      >
        {"प्र"}
      </text>
    </svg>
  );

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fill/60",
        className,
      )}
    >
      {mark}
      <span
        className={cn(
          "font-display font-semibold tracking-tight text-ink",
          size === "md" ? "text-xl" : "text-lg",
        )}
      >
        Prashna<span className="text-accent">Set</span>
      </span>
    </Link>
  );
}
