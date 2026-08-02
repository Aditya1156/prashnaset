import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerOutline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fill/60 focus-visible:ring-offset-2 ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent-fill text-on-accent hover:bg-accent-fill-hover shadow-sm",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-raised",
  ghost: "text-muted hover:text-ink hover:bg-raised",
  danger: "bg-danger text-on-danger hover:bg-danger-hover shadow-sm",
  dangerOutline: "border border-danger/40 text-danger hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm sm:text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
