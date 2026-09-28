"use client";

import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ListChecks,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Difficulty, QuestionType } from "@/lib/types";
import { cn, plural } from "@/lib/utils";

export interface SearchResult {
  id: string;
  stem: string;
  type: QuestionType;
  difficulty: Difficulty;
  topic: string | null;
  examYear: number | null;
  examName: string | null;
  setId: string;
  setTitle: string;
}

interface QuestionSearchProps {
  results: SearchResult[];
  topics: string[];
  examYears: number[];
  total: number;
  page: number;
  pageSize: number;
}

const TYPE_OPTIONS: { value: QuestionType; label: string; icon: typeof CircleDot }[] = [
  { value: "mcq", label: "MCQ", icon: CircleDot },
  { value: "msq", label: "MSQ", icon: ListChecks },
  { value: "match", label: "Match", icon: ArrowLeftRight },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; dot: string }[] = [
  { value: "easy", label: "Easy", dot: "bg-success" },
  { value: "medium", label: "Medium", dot: "bg-warn" },
  { value: "hard", label: "Hard", dot: "bg-danger" },
];

const difficultyTone: Record<Difficulty, BadgeTone> = {
  easy: "success",
  medium: "neutral",
  hard: "warn",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-accent-fill bg-accent-fill text-on-accent shadow-sm"
          : "border-line-strong bg-raised/60 text-muted hover:bg-raised hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function QuestionSearch({
  results,
  topics,
  examYears,
  total,
  page,
  pageSize,
}: QuestionSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const buildUrl = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (overrides.page === undefined && !("page" in overrides)) {
        params.delete("page");
      }
      return `/questions?${params.toString()}`;
    },
    [searchParams],
  );

  function navigate(overrides: Record<string, string | null>) {
    startTransition(() => {
      router.push(buildUrl(overrides));
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: query.trim() || null, page: null });
  }

  const activeType = searchParams.get("type") as QuestionType | null;
  const activeDifficulty = searchParams.get("difficulty") as Difficulty | null;
  const activeTopic = searchParams.get("topic");
  const activeYear = searchParams.get("year");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("type") ||
    searchParams.has("difficulty") ||
    searchParams.has("topic") ||
    searchParams.has("year");

  return (
    <div className={cn("space-y-4", isPending && "pointer-events-none opacity-60")}>
      {/* Search + clear */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <label className="flex h-11 flex-1 items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 focus-within:border-accent-fill/50 focus-within:ring-2 focus-within:ring-accent-fill/40">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by question text…"
            aria-label="Search questions"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              startTransition(() => router.push("/questions"));
            }}
            className="flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-raised/60 px-4 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X className="size-3.5" aria-hidden /> Clear
          </button>
        )}
      </form>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <span className="flex h-8 items-center text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          Type
        </span>
        {TYPE_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            active={activeType === opt.value}
            onClick={() =>
              navigate({
                type: activeType === opt.value ? null : opt.value,
                page: null,
              })
            }
          >
            <opt.icon className="size-3.5" aria-hidden />
            {opt.label}
          </Chip>
        ))}

        <span className="ml-2 flex h-8 items-center text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          Difficulty
        </span>
        {DIFFICULTY_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            active={activeDifficulty === opt.value}
            onClick={() =>
              navigate({
                difficulty: activeDifficulty === opt.value ? null : opt.value,
                page: null,
              })
            }
          >
            <span className={cn("size-2 rounded-full", opt.dot)} aria-hidden />
            {opt.label}
          </Chip>
        ))}
      </div>

      {(topics.length > 0 || examYears.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {topics.length > 0 && (
            <>
              <span className="flex h-8 items-center text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                Topic
              </span>
              <select
                value={activeTopic ?? ""}
                onChange={(e) =>
                  navigate({ topic: e.target.value || null, page: null })
                }
                className="h-8 rounded-full border border-line-strong bg-raised/60 px-3 text-xs font-medium text-ink outline-none focus:border-accent-fill/50"
              >
                <option value="">All topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </>
          )}
          {examYears.length > 0 && (
            <>
              <span className="ml-2 flex h-8 items-center text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                Year
              </span>
              <select
                value={activeYear ?? ""}
                onChange={(e) =>
                  navigate({ year: e.target.value || null, page: null })
                }
                className="h-8 rounded-full border border-line-strong bg-raised/60 px-3 text-xs font-medium text-ink outline-none focus:border-accent-fill/50"
              >
                <option value="">All years</option>
                {examYears.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* Result count */}
      <p className="text-sm text-muted" data-testid="search-count">
        {total === 0
          ? "No questions match those filters."
          : `${total} ${plural(total, "question")} found`}
      </p>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((q, i) => (
            <Link
              key={q.id}
              href={`/sets/${q.setId}`}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-accent-fill/40 hover:shadow-sm"
            >
              <span className="mt-0.5 font-display text-sm text-faint tabular-nums">
                {String((page - 1) * pageSize + i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed text-ink">{q.stem}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">
                    {q.type === "mcq" ? "MCQ" : q.type === "msq" ? "MSQ" : "Match"}
                  </Badge>
                  <Badge tone={difficultyTone[q.difficulty]}>{q.difficulty}</Badge>
                  {q.topic && <Badge>{q.topic}</Badge>}
                  {q.examYear && (
                    <Badge tone="neutral">
                      {q.examName ? `${q.examName} ${q.examYear}` : String(q.examYear)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  From <span className="font-medium text-ink">{q.setTitle}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => navigate({ page: String(page - 1) })}
            className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-raised/60 text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="px-2 text-sm text-muted tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => navigate({ page: String(page + 1) })}
            className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-raised/60 text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
