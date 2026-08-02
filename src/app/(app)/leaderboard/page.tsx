import { Medal, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, plural } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = { title: "Leaderboard" };

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  tests_taken: number;
  questions_answered: number;
  average_score: number | null;
  best_score: number | null;
}

const RANGES = [
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 0, label: "All time" },
];

const medalColors = ["text-amber-500", "text-slate-400", "text-amber-700"];

export default async function LeaderboardPage(props: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await props.searchParams;
  const days = RANGES.some((r) => String(r.days) === range) ? Number(range) : 7;

  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session) redirect("/signin");

  const { data } = await supabase.rpc("leaderboard", { days, max_rows: 50 });
  const rows = (data ?? []) as LeaderboardRow[];
  const myIndex = rows.findIndex((row) => row.user_id === session.user.id);

  return (
    <>
      <PageHeader
        overline="Standings"
        title="Leaderboard"
        description="Ranked by average score across completed tests. Only real attempts count — there is nothing to pad here."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {RANGES.map((option) => (
          <Link
            key={option.days}
            href={`/leaderboard?range=${option.days}`}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              days === option.days
                ? "border-navy bg-navy text-on-navy"
                : "border-line-strong text-muted hover:bg-raised hover:text-ink",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No results in this period"
          body="Complete a test and the standings fill up. Scores are computed from real attempts only."
        />
      ) : (
        <>
          {myIndex >= 0 && (
            <Card className="mb-4 border-transparent bg-navy p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-on-navy-muted uppercase">
                Your standing
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-3xl text-on-navy tabular-nums">
                  #{myIndex + 1}
                </span>
                <span className="text-sm text-on-navy-muted">
                  of {rows.length} {plural(rows.length, "learner")} ·{" "}
                  {rows[myIndex].average_score ?? 0}% average across{" "}
                  {rows[myIndex].tests_taken} {plural(rows[myIndex].tests_taken, "test")}
                </span>
              </div>
            </Card>
          )}

          <Card data-testid="leaderboard-list">
            <div className="hidden grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-3 border-b border-line px-5 py-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase sm:grid">
              <span>Rank</span>
              <span>Learner</span>
              <span className="text-right">Tests</span>
              <span className="text-right">Best</span>
              <span className="text-right">Average</span>
            </div>
            <div className="divide-y divide-line">
              {rows.map((row, i) => {
                const isMe = row.user_id === session.user.id;
                return (
                  <div
                    key={row.user_id}
                    className={cn(
                      "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[3rem_1fr_6rem_6rem_6rem] sm:px-5",
                      isMe && "bg-accent-soft/50",
                    )}
                  >
                    <span className="flex items-center font-display text-lg text-ink tabular-nums">
                      {i < 3 ? (
                        <Medal className={cn("size-5", medalColors[i])} aria-label={`Rank ${i + 1}`} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={row.display_name} className="size-8" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {row.display_name}
                          {isMe && <span className="ml-1.5 text-xs text-accent">you</span>}
                        </span>
                        <span className="block text-xs text-muted sm:hidden">
                          {row.tests_taken} {plural(row.tests_taken, "test")} ·{" "}
                          {row.average_score ?? 0}% avg
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-right text-sm text-muted tabular-nums sm:block">
                      {row.tests_taken}
                    </span>
                    <span className="hidden text-right text-sm text-muted tabular-nums sm:block">
                      {row.best_score ?? 0}%
                    </span>
                    <span className="text-right font-display text-lg text-ink tabular-nums">
                      {row.average_score ?? 0}%
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
