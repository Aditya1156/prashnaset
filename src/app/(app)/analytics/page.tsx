import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all";
import type { ProfileRow, TestSessionRow } from "@/lib/types";
import { formatDate, scorePercent, scoreTone, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

function accuracyTone(percent: number): BadgeTone {
  if (percent >= 75) return "success";
  if (percent >= 50) return "warn";
  return "danger";
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const session = await getSessionProfile(supabase);
  if (!session?.isAdmin) redirect("/dashboard");

  // ---------- parallel data fetches ----------
  const [profilesRes, sessionsRes, attemptsRes] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("test_sessions").select("*").not("completed_at", "is", null),
    readAllRows<{ id: string; is_correct: boolean; questions: { topic: string | null }[] }>(
      (from, to) =>
        supabase
          .from("attempts")
          .select("id, is_correct, questions(topic)")
          .range(from, to),
    ),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const sessions = (sessionsRes.data ?? []) as TestSessionRow[];
  const attempts = attemptsRes.rows;

  // ---------- 1. Summary stats ----------
  const learners = profiles.filter((p) => p.role !== "admin");
  const totalLearners = learners.length;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const recentSessions = sessions.filter(
    (s) => s.completed_at && s.completed_at >= sevenDaysAgoIso,
  );
  const activeLearners = new Set(recentSessions.map((s) => s.owner_id)).size;

  const totalCompleted = sessions.length;

  let avgScore = 0;
  if (sessions.length > 0) {
    const totalPercent = sessions.reduce(
      (sum, s) => sum + scorePercent(s.correct_count, s.question_count),
      0,
    );
    avgScore = Math.round(totalPercent / sessions.length);
  }

  // ---------- 2. Activity over time (last 14 days) ----------
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

  // Build a map of date string -> count from completed sessions
  const dateCountMap = new Map<string, number>();
  for (const s of sessions) {
    if (!s.completed_at) continue;
    const d = new Date(s.completed_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dateCountMap.set(key, (dateCountMap.get(key) ?? 0) + 1);
  }

  // Generate 14 days of entries (today down to 13 days ago)
  const activityDays: { date: string; iso: string; count: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    activityDays.push({
      date: formatDate(d.toISOString()),
      iso: key,
      count: dateCountMap.get(key) ?? 0,
    });
  }
  activityDays.reverse(); // oldest first
  const maxDayCount = Math.max(1, ...activityDays.map((d) => d.count));

  // ---------- 3. Topic performance ----------
  const topicMap = new Map<string, { attempted: number; correct: number }>();
  for (const a of attempts) {
    const q = a.questions as unknown;
    const qObj = Array.isArray(q) ? q[0] as { topic: string | null } | undefined : q as { topic: string | null } | null;
    const topic = qObj?.topic ?? "Untagged";
    const entry = topicMap.get(topic) ?? { attempted: 0, correct: 0 };
    entry.attempted++;
    if (a.is_correct) entry.correct++;
    topicMap.set(topic, entry);
  }

  const topicRows = Array.from(topicMap.entries())
    .map(([topic, { attempted, correct }]) => ({
      topic,
      attempted,
      correct,
      accuracy: scorePercent(correct, attempted),
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // weakest first

  // ---------- 4. Per-learner table ----------
  // Build per-learner aggregates from sessions
  const learnerMap = new Map<
    string,
    { tests: number; totalPercent: number; lastActive: string }
  >();
  for (const s of sessions) {
    const entry = learnerMap.get(s.owner_id) ?? {
      tests: 0,
      totalPercent: 0,
      lastActive: "",
    };
    entry.tests++;
    entry.totalPercent += scorePercent(s.correct_count, s.question_count);
    if (s.completed_at && s.completed_at > entry.lastActive) {
      entry.lastActive = s.completed_at;
    }
    learnerMap.set(s.owner_id, entry);
  }

  const learnerRows = learners
    .map((p) => {
      const stats = learnerMap.get(p.id);
      return {
        id: p.id,
        name: p.display_name?.trim() || p.email?.split("@")[0] || "Unnamed",
        email: p.email ?? "—",
        tests: stats?.tests ?? 0,
        avgScore: stats && stats.tests > 0 ? Math.round(stats.totalPercent / stats.tests) : null,
        lastActive: stats?.lastActive ?? null,
      };
    })
    .sort((a, b) => {
      // Sort by last active descending, nulls last
      if (!a.lastActive && !b.lastActive) return 0;
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return b.lastActive.localeCompare(a.lastActive);
    });

  // ---------- render ----------
  return (
    <>
      <PageHeader
        overline="Admin"
        title="Analytics"
        description="Learner activity and performance across the platform. All numbers are computed from real data — nothing is estimated."
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total learners"
          value={String(totalLearners)}
          hint={`${plural(totalLearners, "account")} with role "user"`}
        />
        <StatCard
          label="Active (7 days)"
          value={String(activeLearners)}
          hint="Distinct learners who completed a test"
          inverted
        />
        <StatCard
          label="Tests completed"
          value={String(totalCompleted)}
        />
        <StatCard
          label="Avg score"
          value={totalCompleted > 0 ? `${avgScore}%` : "—"}
          hint={totalCompleted > 0 ? `Across ${plural(totalCompleted, "test")}` : "No tests yet"}
        />
      </div>

      {/* Activity over time */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Activity (last 14 days)</h2>
        <p className="mt-1 text-sm text-muted">Tests completed per day.</p>

        <Card className="mt-4 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-raised/30 text-left text-[11px] tracking-[0.14em] text-faint uppercase">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Tests</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {activityDays.map((day) => (
                  <tr key={day.iso} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{day.date}</td>
                    <td className="px-4 py-2.5 font-medium text-ink tabular-nums w-16">
                      {day.count}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
                        <div
                          className="h-full rounded-full bg-accent-fill transition-[width] duration-300"
                          style={{ width: `${Math.round((day.count / maxDayCount) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Topic performance */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Topic performance</h2>
        <p className="mt-1 text-sm text-muted">
          Accuracy across all learners, weakest topics first.
        </p>

        {topicRows.length === 0 ? (
          <Card className="mt-4 p-5">
            <p className="text-sm text-muted">
              No attempt data yet. Once learners start taking tests, topic-level accuracy
              appears here.
            </p>
          </Card>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="bg-raised/30 text-left text-[11px] tracking-[0.14em] text-faint uppercase">
                  <th className="px-4 pb-1 font-semibold">Topic</th>
                  <th className="px-4 pb-1 font-semibold">Attempted</th>
                  <th className="px-4 pb-1 font-semibold">Correct</th>
                  <th className="px-4 pb-1 font-semibold">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {topicRows.map((row) => (
                  <tr key={row.topic} className="bg-surface">
                    <td className="rounded-l-xl border-y border-l border-line px-4 py-3 font-medium text-ink">
                      {row.topic}
                    </td>
                    <td className="border-y border-line px-4 py-3 text-muted tabular-nums">
                      {row.attempted}
                    </td>
                    <td className="border-y border-line px-4 py-3 text-muted tabular-nums">
                      {row.correct}
                    </td>
                    <td className="rounded-r-xl border-y border-r border-line px-4 py-3">
                      <Badge tone={accuracyTone(row.accuracy)}>{row.accuracy}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-learner table */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Learners</h2>
        <p className="mt-1 text-sm text-muted">
          {learnerRows.length} {plural(learnerRows.length, "learner")} sorted by last activity.
        </p>

        {learnerRows.length === 0 ? (
          <Card className="mt-4 p-5">
            <p className="text-sm text-muted">No learners have signed up yet.</p>
          </Card>
        ) : (
          <Card className="mt-4 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line bg-raised/30 text-left text-[11px] tracking-[0.14em] text-faint uppercase">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Tests</th>
                    <th className="px-4 py-3 font-semibold">Avg Score</th>
                    <th className="px-4 py-3 font-semibold">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerRows.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-medium text-ink">{row.name}</td>
                      <td className="px-4 py-2.5 text-muted">{row.email}</td>
                      <td className="px-4 py-2.5 text-muted tabular-nums">{row.tests}</td>
                      <td className="px-4 py-2.5">
                        {row.avgScore !== null ? (
                          <Badge tone={scoreTone(row.avgScore)}>{row.avgScore}%</Badge>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                        {row.lastActive ? formatDate(row.lastActive) : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </>
  );
}
