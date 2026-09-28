"use client";

import { BookOpen, ClipboardList, Play, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

const DISMISSED_KEY = "rattamaro:onboarding-dismissed";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return true;
}

const steps = [
  {
    icon: BookOpen,
    title: "Browse the library",
    body: "Colour-coded folders, filterable by topic, type, and difficulty.",
    href: "/sets",
    cta: "Open library",
  },
  {
    icon: Play,
    title: "Take your first test",
    body: "Pick folders or sets, choose length, and start — timed or untimed, with real negative marking.",
    href: "/test/new",
    cta: "Build a test",
  },
  {
    icon: ClipboardList,
    title: "Review your answers",
    body: "See which you got right, read explanations, and ask AI for more detail on any question.",
    href: "/history",
    cta: "History",
  },
  {
    icon: TrendingUp,
    title: "Track your progress",
    body: "Topic-wise accuracy, difficulty breakdowns, streaks — all from your own attempts.",
    href: "/progress",
    cta: "Progress",
  },
];

export function WelcomeBanner({ name }: { name: string }) {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // private browsing — best-effort
    }
    window.dispatchEvent(new StorageEvent("storage"));
  }, []);

  if (dismissed) return null;

  return (
    <div className="relative mb-6 rounded-3xl border border-accent/30 bg-gradient-to-br from-accent-soft/60 via-accent-soft/30 to-surface p-6 shadow-sm sm:p-8">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome guide"
        className="absolute top-3 right-3 rounded-full bg-surface/50 p-2 text-muted shadow-sm transition-colors hover:bg-surface hover:text-ink"
      >
        <X className="size-4" />
      </button>

      <h2 className="font-display text-xl text-ink sm:text-2xl">
        Welcome, {name}!
      </h2>
      <p className="mt-1 max-w-lg text-sm text-muted">
        Here&apos;s how to get started with RattaMaro in four quick steps.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <Link
            key={step.title}
            href={step.href}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface/90 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-ink transition-all group-hover:bg-accent-fill group-hover:text-on-accent group-hover:scale-105">
                <step.icon className="size-4" aria-hidden />
              </div>
              <span className="flex size-6 items-center justify-center rounded-full bg-navy text-on-navy font-display text-[10px]">0{i + 1}</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">{step.body}</p>
            <span className="mt-3 text-xs font-semibold tracking-wide text-accent group-hover:underline">
              {step.cta} &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
