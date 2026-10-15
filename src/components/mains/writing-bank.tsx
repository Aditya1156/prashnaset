"use client";

import { MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, plural } from "@/lib/utils";

export interface MainsCard {
  id: string;
  source: "PYQ" | "USER" | "MOCK";
  examLabel: string | null;
  examYear: number | null;
  paper: string;
  section: number | null;
  type: string;
  marks: number;
  textEn: string | null;
  textHi: string | null;
  directive: string | null;
  biharAngle: boolean;
  topic: string | null;
  bestPercent: number | null;
}

interface ProgressRow {
  paper: string;
  section: number | null;
  attempts: number;
  avg_percent: number | null;
  best_percent: number | null;
  avg_minutes: number | null;
}

const PAPERS = ["All", "GS1", "GS2", "ESSAY"] as const;

function bandTone(percent: number | null) {
  if (percent === null) return "neutral" as const;
  if (percent >= 64) return "success" as const;
  if (percent >= 44) return "warn" as const;
  return "danger" as const;
}

export function WritingBank({
  cards,
  progress,
}: {
  cards: MainsCard[];
  progress: ProgressRow[];
}) {
  const [paper, setPaper] = useState<(typeof PAPERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [biharOnly, setBiharOnly] = useState(false);
  const [year, setYear] = useState<number | "All">("All");

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const c of cards) if (c.examYear) set.add(c.examYear);
    return [...set].sort((a, b) => b - a);
  }, [cards]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (paper !== "All" && c.paper !== paper) return false;
      if (biharOnly && !c.biharAngle) return false;
      if (year !== "All" && c.examYear !== year) return false;
      if (!needle) return true;
      return (
        (c.textEn ?? "").toLowerCase().includes(needle) ||
        (c.textHi ?? "").includes(query.trim()) ||
        (c.topic ?? "").toLowerCase().includes(needle)
      );
    });
  }, [cards, paper, biharOnly, year, query]);

  const attempted = cards.filter((c) => c.bestPercent !== null).length;

  return (
    <div className="space-y-5">
      {progress.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {progress.slice(0, 4).map((p) => (
            <Card key={`${p.paper}-${p.section ?? 0}`} className="p-4">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                {p.paper}
                {p.section ? ` · Sec ${p.section}` : ""}
              </p>
              <p className="mt-1.5 font-display text-2xl text-ink tabular-nums">
                {p.avg_percent ?? "—"}%
              </p>
              <p className="text-xs text-muted">
                {p.attempts} {plural(p.attempts, "attempt")}
                {p.avg_minutes ? ` · ${p.avg_minutes} min avg` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <label className="flex h-11 items-center gap-2.5 rounded-lg border border-line-strong bg-background px-3 focus-within:border-accent-fill/50">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions and topics…"
            aria-label="Search mains questions"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-faint sm:text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          {PAPERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaper(p)}
              aria-pressed={paper === p}
              className={cn(
                "h-9 rounded-lg border px-3.5 text-xs font-medium transition-colors",
                paper === p
                  ? "border-transparent bg-accent-fill text-on-accent"
                  : "border-line-strong text-muted hover:text-ink",
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBiharOnly((v) => !v)}
            aria-pressed={biharOnly}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-medium transition-colors",
              biharOnly
                ? "border-transparent bg-accent-fill text-on-accent"
                : "border-line-strong text-muted hover:text-ink",
            )}
          >
            <MapPin className="size-3.5" aria-hidden /> Bihar
          </button>
          {years.length > 0 && (
            <select
              value={String(year)}
              onChange={(e) => setYear(e.target.value === "All" ? "All" : Number(e.target.value))}
              aria-label="Filter by year"
              className="h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-xs text-ink"
            >
              <option value="All">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="text-xs text-muted tabular-nums">
          {visible.length} of {cards.length} · {attempted} attempted
        </p>
      </Card>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">
          No questions match those filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <li key={c.id}>
              <Link
                href={`/writing/${c.id}`}
                className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent-fill/40 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{c.paper}</Badge>
                  {c.section && <Badge>Sec {c.section}</Badge>}
                  <Badge>{c.marks} marks</Badge>
                  {c.biharAngle && (
                    <Badge tone="warn">
                      <MapPin className="size-3" aria-hidden /> Bihar
                    </Badge>
                  )}
                  {c.source === "USER" && <Badge tone="neutral">Mine</Badge>}
                  {c.examYear && <span className="text-xs text-muted">{c.examYear}</span>}
                  {c.bestPercent !== null && (
                    <Badge tone={bandTone(c.bestPercent)} className="ml-auto">
                      best {c.bestPercent}%
                    </Badge>
                  )}
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-ink">
                  {c.textEn ?? c.textHi}
                </p>
                {c.topic && <p className="mt-1.5 text-xs text-muted">{c.topic}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
