"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // False during SSR/hydration, true right after — avoids a theme-icon
  // hydration mismatch without an effect.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className="size-9 rounded-lg" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fill/60"
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
