import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Logo({ href = "/", size = "md", className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fill/60",
        className,
      )}
    >
      <Image
        src="/logo-mark.svg"
        alt=""
        width={size === "md" ? 32 : 28}
        height={size === "md" ? 32 : 28}
        priority
        className={cn("shrink-0", size === "md" ? "size-8" : "size-7")}
      />
      {/* The mark already carries the "t", so the wordmark is set lowercase
          to match it rather than title-cased against it. */}
      <span
        className={cn(
          "font-display font-semibold lowercase tracking-tight text-ink",
          size === "md" ? "text-xl" : "text-lg",
        )}
      >
        taiyaria<span className="text-accent">ada</span>
      </span>
    </Link>
  );
}
