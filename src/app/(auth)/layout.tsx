import { BookOpenCheck, ClipboardCheck, Flame, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const perks = [
  { icon: BookOpenCheck, text: "Curated question bank with real BPSC material" },
  { icon: ClipboardCheck, text: "Timed tests with 1/3 negative marking" },
  { icon: Target, text: "Spaced repetition locks in weak topics" },
  { icon: Flame, text: "Streaks, drills, and honest progress tracking" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* ── Branding panel (desktop only) ─────────────────────── */}
      <div className="relative hidden w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-navy p-8 lg:flex xl:w-[480px]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[400px] rounded-full bg-accent-fill/10 blur-3xl"
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-32 size-[300px] rounded-full bg-accent-fill/10 blur-3xl" />
        <div className="relative">
          <Logo href="/" size="md" className="text-on-navy [&_span]:text-on-navy" />
          <div className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.2em] text-on-navy-muted uppercase">
            <span className="h-px w-6 bg-accent/50" aria-hidden />
            Practice. Remember. Master.
            <span className="h-px w-6 bg-accent/50" aria-hidden />
          </div>
          <h2 className="mt-10 font-display text-2xl leading-tight tracking-tight text-on-navy">
            Practice smarter.
            <br />
            <span className="text-accent">Score higher.</span>
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-on-navy-muted">
            Focused BPSC test practice — curated questions, real marking, and scores that mean something.
          </p>
        </div>
        <ul className="relative mt-auto space-y-3 pt-10">
          {perks.map((perk) => (
            <li key={perk.text} className="flex items-center gap-3 text-sm text-on-navy-muted">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                <perk.icon className="size-4 text-accent" aria-hidden />
              </div>
              {perk.text}
            </li>
          ))}
        </ul>
        <div aria-hidden className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent/30 to-transparent" />
      </div>

      {/* ── Form panel ────────────────────────────────────────── */}
      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-10 sm:pt-8 lg:items-center lg:pt-0">
          <div className="w-full max-w-md animate-scale-in">{children}</div>
        </main>
        <footer className="pb-6 text-center text-xs text-muted max-lg:hidden">
          Your questions stay yours — every row is scoped to your account.
        </footer>
      </div>
    </div>
  );
}
