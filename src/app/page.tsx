import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileJson2,
  Flame,
  Shield,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    icon: FileJson2,
    title: "Curated question bank",
    body: "MCQ, multi-select and match-the-following — colour-coded by subject, filterable by type and difficulty.",
  },
  {
    icon: ClipboardCheck,
    title: "Exam-like practice",
    body: "Timed tests with negative marking, instant explanations, and server-graded answers — question by question.",
  },
  {
    icon: Target,
    title: "Spaced repetition",
    body: "Leitner-box scheduling surfaces weak topics at the right interval so you lock them in long-term.",
  },
  {
    icon: Zap,
    title: "Mistake drills",
    body: "Auto-generated drills from your recent wrong answers. Practice what you actually get wrong, not everything.",
  },
  {
    icon: Flame,
    title: "Streaks & progress",
    body: "Daily streak tracking, topic-wise accuracy, and difficulty breakdowns — all computed from your own attempts.",
  },
  {
    icon: Shield,
    title: "Row-level security",
    body: "Your sessions, notes, and bookmarks are yours alone. Every query is scoped to your account at the database level.",
  },
];

const highlights = [
  { value: "BPSC", label: "Focused prep" },
  { value: "1/3", label: "Real negative marking" },
  { value: "100%", label: "Your own data" },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <ButtonLink href="/signin" variant="ghost" size="sm" className="hidden h-9 px-3 text-sm sm:inline-flex">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm" className="h-9 px-3.5 text-sm">
            Get started
          </ButtonLink>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-accent-soft/60 via-background to-background"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[800px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl"
          />

          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            <div>
              <Badge tone="accent" className="px-3 py-1 text-xs font-semibold">
                <Sparkles className="size-3" aria-hidden /> Built for BPSC aspirants
              </Badge>
              <h1 className="mt-4 font-display text-[2rem] leading-[1.08] tracking-tight text-ink sm:mt-5 sm:text-5xl lg:text-[3.5rem]">
                Practice smarter.
                <br />
                <span className="text-accent">Score higher.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted sm:mt-5 sm:text-lg">
                PrashnaSet is focused test practice with a curated question
                bank, real negative marking, spaced repetition, and scores that mean
                something — no filler, no invented stats.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-wrap">
                <ButtonLink href="/signup" size="lg" className="col-span-2 sm:col-span-1">
                  Start practicing free <ArrowRight className="ml-1 size-4" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/signin" variant="secondary" size="lg" className="col-span-2 sm:col-span-1">
                  Sign in
                </ButtonLink>
              </div>

              <div className="mt-10 flex items-center gap-6 border-t border-line pt-6 sm:gap-8">
                {highlights.map((stat) => (
                  <div key={stat.label}>
                    <p className="font-display text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted sm:text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-accent/10 via-transparent to-accent/5 blur-xl"
              />
              <Card className="relative p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="accent">MCQ</Badge>
                  <span className="text-xs text-muted">Sample question</span>
                </div>
                <p className="mt-3 font-medium text-ink">
                  Which article of the Indian Constitution abolishes untouchability?
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {["Article 14", "Article 17", "Article 19", "Article 21"].map((option) => {
                    const correct = option === "Article 17";
                    return (
                      <li
                        key={option}
                        className={
                          correct
                            ? "flex items-center justify-between rounded-xl border border-success/40 bg-success-soft px-3.5 py-2.5 font-medium text-ink"
                            : "flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-muted"
                        }
                      >
                        {option}
                        {correct && <Check className="size-4 text-success" aria-hidden />}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 rounded-xl bg-raised px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                  <span className="font-medium text-ink">Explanation: </span>
                  Article 17 abolishes &ldquo;untouchability&rdquo; and forbids its practice in any
                  form.
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
            <div className="text-center">
              <Badge tone="neutral" className="px-3 py-1">
                <BookOpen className="size-3" aria-hidden /> How it works
              </Badge>
              <h2 className="mt-4 font-display text-2xl tracking-tight text-ink sm:text-3xl">
                Three steps to real practice
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted sm:text-base">
                Your admin curates the library — you focus entirely on practice.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-5">
              {[
                {
                  icon: FileJson2,
                  step: "01",
                  title: "Browse the library",
                  body: "Question sets organised in colour-coded subject folders. MCQ, multi-select, and match-the-following.",
                },
                {
                  icon: ClipboardCheck,
                  step: "02",
                  title: "Take a test",
                  body: "Pick folders or sets, filter by type and difficulty, choose length — timed or untimed, with real negative marking.",
                },
                {
                  icon: Upload,
                  step: "03",
                  title: "Review & repeat",
                  body: "Instant explanations, score breakdowns, mistake drills, and spaced repetition keep you improving.",
                },
              ].map((item) => (
                <Card
                  key={item.step}
                  className="group relative overflow-hidden p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink transition-colors group-hover:bg-accent-fill group-hover:text-on-accent">
                      <item.icon className="size-5" aria-hidden />
                    </div>
                    <span className="font-display text-sm tabular-nums text-faint">{item.step}</span>
                  </div>
                  <h3 className="mt-4 font-display text-lg text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="text-center">
            <h2 className="font-display text-xl tracking-tight text-ink sm:text-3xl">
              Everything you need, nothing you don&rsquo;t
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted sm:text-base">
              Deliberately small, honestly built — every number is computed from your own attempts.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-3">
            {features.map((feat) => (
              <Card
                key={feat.title}
                className="group p-4 transition-shadow hover:shadow-md sm:p-6"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink transition-colors group-hover:bg-accent-fill group-hover:text-on-accent sm:size-10">
                  <feat.icon className="size-4 sm:size-5" aria-hidden />
                </div>
                <h3 className="mt-3 font-display text-sm text-ink sm:mt-4 sm:text-base">{feat.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-1.5 sm:text-sm">{feat.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ── CTA banner ────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-20">
          <div className="relative overflow-hidden rounded-2xl bg-navy px-5 py-10 text-center sm:rounded-3xl sm:px-10 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 left-1/2 size-[500px] -translate-x-1/2 rounded-full bg-accent-fill/10 blur-3xl"
            />
            <h2 className="relative font-display text-2xl tracking-tight text-on-navy sm:text-3xl lg:text-4xl">
              Start your BPSC prep today
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-on-navy-muted sm:text-base">
              Free to use. No credit card. Practice from a curated library and track real
              progress from day one.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" size="lg" variant="primary">
                Create your free account <ArrowRight className="ml-1 size-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
          <span>
            <span className="font-display text-ink">PrashnaSet</span> — प्रश्न set, your question
            sets.
          </span>
          <a
            href="/question-import-example.json"
            download
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            question-import-example.json
          </a>
        </div>
      </footer>
    </div>
  );
}
