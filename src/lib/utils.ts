import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle that retries a few times to avoid returning the original order,
 *  so a match question's right column doesn't accidentally line up. */
export function shuffleAvoidingOrder<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const distinct = new Set(items).size;
  if (items.length < 2 || distinct < 2) return [...items];
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = shuffle(items, rng);
    if (candidate.some((value, i) => value !== items[i])) return candidate;
  }
  return shuffle(items, rng);
}

/** Pinned to IST rather than the runtime's zone. Without it, a date rendered
 *  on the server (UTC on Vercel) and re-rendered in the browser (IST) can
 *  disagree, which React reports as a hydration mismatch — and the audience
 *  for this product is in India, so IST is also the right answer to show. */
const TIME_ZONE = "Asia/Kolkata";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso));
}

export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export type ScoreTone = "success" | "warn" | "danger";

export function scoreTone(percent: number): ScoreTone {
  if (percent >= 80) return "success";
  if (percent >= 50) return "warn";
  return "danger";
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}
