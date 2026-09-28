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
        src="/6183675720312230173.jpg"
        alt=""
        width={size === "md" ? 32 : 28}
        height={size === "md" ? 32 : 28}
        className={cn("shrink-0 rounded-xl", size === "md" ? "size-8" : "size-7")}
      />
      <span
        className={cn(
          "font-display font-semibold tracking-tight text-ink",
          size === "md" ? "text-xl" : "text-lg",
        )}
      >
        Ratta<span className="text-gold-gradient">Maro</span>
      </span>
    </Link>
  );
}
