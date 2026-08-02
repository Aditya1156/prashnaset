import {
  Check,
  ClipboardCheck,
  FileJson2,
  MoonStar,
  RotateCcw,
  Upload,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const steps = [
  {
    icon: FileJson2,
    title: "Convert",
    body: "Turn your PDFs and notes into a simple JSON file with any tool you like. We publish the exact format and a working example file.",
  },
  {
    icon: Upload,
    title: "Import",
    body: "Drop the file. Good rows land instantly; anything unreadable is skipped with a per-question reason, shown to you honestly.",
  },
  {
    icon: ClipboardCheck,
    title: "Test",
    body: "Build a test from any of your sets, answer MCQ, multi-select and match questions, and get your score with explanations.",
  },
];

const included = [
  "One-drop JSON import with per-row error reasons",
  "MCQ, multi-select (MSQ) and match-the-following",
  "Explanations revealed after every answer",
  "Score history with resumable tests",
  "Your questions stay yours — row-level security per account",
  "Light and dark, built mobile-first",
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ButtonLink href="/signin" variant="ghost" size="sm" className="h-9 px-3 text-sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm" className="h-9 px-3.5 text-sm">
            Get started
          </ButtonLink>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge tone="accent">Bring your own questions</Badge>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Your notes. Your questions.
              <br />
              Real test practice.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              PrashnaSet is a focused question bank for exam aspirants. Import the questions
              you already have as a JSON file and take an honest test on them tonight — no
              OCR queues, no AI guesswork, no filler.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href="/signup" size="lg">
                Create your free account
              </ButtonLink>
              <ButtonLink href="/question-import-example.json" variant="secondary" size="lg" download>
                Download example JSON
              </ButtonLink>
            </div>
          </div>

          {/* A real question from the bundled example file — not invented data. */}
          <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <Badge tone="accent">MCQ</Badge>
            <span className="text-xs text-muted">From the example file</span>
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
                      ? "flex items-center justify-between rounded-lg border border-success/40 bg-success-soft px-3 py-2 font-medium text-ink"
                      : "flex items-center justify-between rounded-lg border border-line px-3 py-2 text-muted"
                  }
                >
                  {option}
                  {correct && <Check className="size-4 text-success" aria-hidden />}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-lg bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
            Article 17 abolishes “untouchability” and forbids its practice in any form.
          </p>
          </Card>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
              The whole loop, three steps
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {steps.map((step, index) => (
                <Card key={step.title} className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink">
                      <step.icon className="size-5" aria-hidden />
                    </div>
                    <span className="font-display text-sm text-faint">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-lg text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
                Deliberately small, honestly built
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
                Version one does exactly one thing excellently: your questions, imported and
                testable in minutes. No invented stats, no fake streaks — every number you
                see in the app is computed from your own attempts.
              </p>
              <div className="mt-6 flex items-center gap-4 text-muted">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <MoonStar className="size-4" aria-hidden /> Dark mode
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <RotateCcw className="size-4" aria-hidden /> Resume tests
                </span>
              </div>
            </div>
            <ul className="space-y-3">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-ink">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
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
