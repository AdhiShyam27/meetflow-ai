import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("meetings")
    .select("id, title, platform, duration, status, created_at, summary")
    .eq("user_id", user.id)
    .eq("status", "done")
    .order("created_at", { ascending: true });

  const meetings = rows ?? [];

  // ── Basic counts ────────────────────────────────────────────────────────────
  const totalMeetings = meetings.length;
  const totalSeconds = meetings.reduce((s, m) => s + (m.duration ?? 0), 0);
  const totalHours = +(totalSeconds / 3600).toFixed(1);
  const avgDuration = totalMeetings > 0 ? Math.round(totalSeconds / totalMeetings / 60) : 0;

  // ── Platform breakdown ──────────────────────────────────────────────────────
  const platformCounts: Record<string, number> = {};
  for (const m of meetings) {
    const p = m.platform || "other";
    platformCounts[p] = (platformCounts[p] ?? 0) + 1;
  }

  // ── Action item stats ───────────────────────────────────────────────────────
  let totalActionItems = 0;
  let completedActionItems = 0;
  const topicFreq: Record<string, number> = {};

  for (const m of meetings) {
    const s = m.summary as Record<string, unknown> | null;
    if (!s) continue;

    const items = s.actionItems as Array<{ completed?: boolean }> | undefined;
    if (Array.isArray(items)) {
      totalActionItems += items.length;
      completedActionItems += items.filter((i) => i.completed).length;
    }

    const topics = s.topics as string[] | undefined;
    if (Array.isArray(topics)) {
      for (const t of topics) topicFreq[t] = (topicFreq[t] ?? 0) + 1;
    }
  }

  // ── Health score average ─────────────────────────────────────────────────────
  const scoresArr = meetings
    .map((m) => (m.summary as Record<string, unknown> | null)?.healthScore as number | undefined)
    .filter((s): s is number => typeof s === "number");
  const avgHealthScore = scoresArr.length > 0
    ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length)
    : null;

  // ── Sentiment breakdown ──────────────────────────────────────────────────────
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  for (const m of meetings) {
    const s = m.summary as Record<string, unknown> | null;
    const label = (s?.sentiment as { label?: string } | undefined)?.label;
    if (label === "positive" || label === "neutral" || label === "negative") {
      sentimentCounts[label]++;
    }
  }

  // ── Meetings by week (last 12 weeks) ─────────────────────────────────────────
  const weeks: Array<{ label: string; count: number }> = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7 - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const count = meetings.filter((m) => {
      const d = new Date(m.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;

    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeks.push({ label, count });
  }

  // ── Meetings by day of week ──────────────────────────────────────────────────
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay = dayNames.map((day, i) => ({
    day,
    count: meetings.filter((m) => new Date(m.created_at).getDay() === i).length,
  }));

  // ── Top topics ───────────────────────────────────────────────────────────────
  const topTopics = Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  // ── Duration trend (last 10 meetings) ────────────────────────────────────────
  const durationTrend = meetings.slice(-10).map((m) => ({
    title: m.title.slice(0, 20),
    minutes: Math.round((m.duration ?? 0) / 60),
    date: new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return NextResponse.json({
    totalMeetings,
    totalHours,
    avgDuration,
    totalActionItems,
    completedActionItems,
    avgHealthScore,
    platformCounts,
    sentimentCounts,
    weeklyActivity: weeks,
    byDay,
    topTopics,
    durationTrend,
  });
}
