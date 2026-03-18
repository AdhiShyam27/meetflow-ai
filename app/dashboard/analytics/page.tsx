"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart2, Clock, CheckSquare, Sparkles, TrendingUp,
  Calendar, Tag, Smile, Meh, Frown, Activity,
} from "lucide-react";

interface AnalyticsData {
  totalMeetings: number;
  totalHours: number;
  avgDuration: number;
  totalActionItems: number;
  completedActionItems: number;
  avgHealthScore: number | null;
  platformCounts: Record<string, number>;
  sentimentCounts: { positive: number; neutral: number; negative: number };
  weeklyActivity: Array<{ label: string; count: number }>;
  byDay: Array<{ day: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  durationTrend: Array<{ title: string; minutes: number; date: string }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  google_meet: "#4285F4",
  zoom: "#2D8CFF",
  teams: "#5059C9",
  other: "#64748B",
};
const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "MS Teams",
  other: "Other",
};

function StatCard({
  icon, label, value, sub, color, delay = 0,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}15`, color }}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>{value}</p>
      <p className="text-slate-500 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </motion.div>
  );
}

function BarGraph({ data, color = "#4F46E5", label }: { data: Array<{ label: string; count: number }>; color?: string; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.count / max) * 100}%` }}
              transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
              className="w-full rounded-t-md min-h-[4px]"
              style={{ background: d.count > 0 ? color : "#F1F5F9" }}
              title={`${d.count} meeting${d.count !== 1 ? "s" : ""}`}
            />
            <span className="text-slate-400 text-[9px] truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutSegment({ pct, color, offset }: { pct: number; color: string; offset: number }) {
  const R = 36, circ = 2 * Math.PI * R;
  return (
    <circle
      cx={50} cy={50} r={R}
      fill="none"
      stroke={color}
      strokeWidth={14}
      strokeDasharray={`${pct * circ} ${circ}`}
      strokeDashoffset={-offset * circ}
      transform="rotate(-90 50 50)"
      style={{ transition: "stroke-dasharray 0.8s ease" }}
    />
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200/60 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-52 bg-white rounded-2xl border border-slate-200/60 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data || data.totalMeetings === 0) {
    return (
      <div className="p-6 max-w-6xl flex flex-col items-center justify-center py-32">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <BarChart2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-slate-700 font-semibold mb-2">No analytics yet</h3>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          Complete a few meetings to see your productivity insights, sentiment trends, and topic analysis.
        </p>
      </div>
    );
  }

  const completionRate = data.totalActionItems > 0
    ? Math.round((data.completedActionItems / data.totalActionItems) * 100)
    : 0;

  const totalSentiment = data.sentimentCounts.positive + data.sentimentCounts.neutral + data.sentimentCounts.negative || 1;
  const platformEntries = Object.entries(data.platformCounts);
  const totalPlatform = platformEntries.reduce((s, [, c]) => s + c, 0) || 1;

  // Platform donut data
  let offset = 0;
  const donutSegments = platformEntries.map(([p, count]) => {
    const pct = count / totalPlatform;
    const seg = { platform: p, pct, offset, color: PLATFORM_COLORS[p] || "#94A3B8" };
    offset += pct;
    return seg;
  });

  return (
    <div className="p-6 max-w-6xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          Meeting Analytics
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Your productivity insights across all completed meetings
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<BarChart2 className="w-4 h-4" />} label="Total Meetings" value={data.totalMeetings} color="#4F46E5" delay={0} />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Hours Transcribed" value={`${data.totalHours}h`} sub={`~${data.avgDuration}m avg`} color="#14B8A6" delay={0.07} />
        <StatCard icon={<CheckSquare className="w-4 h-4" />} label="Action Items" value={data.totalActionItems} sub={`${completionRate}% completed`} color="#10B981" delay={0.14} />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Avg Health Score"
          value={data.avgHealthScore !== null ? `${data.avgHealthScore}/100` : "—"}
          sub="meeting quality"
          color="#F59E0B"
          delay={0.21}
        />
      </div>

      {/* Row 1: Weekly activity + Day of week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Weekly activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">Weekly Activity</h2>
            <span className="text-xs text-slate-400 ml-1">last 12 weeks</span>
          </div>
          <BarGraph data={data.weeklyActivity} color="#4F46E5" label="" />
        </motion.div>

        {/* Day of week */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-teal-500" />
            <h2 className="text-sm font-bold text-slate-700">Most Active Days</h2>
          </div>
          <BarGraph data={data.byDay.map((d) => ({ label: d.day, count: d.count }))} color="#14B8A6" label="" />
        </motion.div>
      </div>

      {/* Row 2: Sentiment + Platform + Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Sentiment */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-700">Meeting Sentiment</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "Positive", count: data.sentimentCounts.positive, color: "#10B981", icon: <Smile className="w-3.5 h-3.5" /> },
              { label: "Neutral", count: data.sentimentCounts.neutral, color: "#6B7280", icon: <Meh className="w-3.5 h-3.5" /> },
              { label: "Negative", count: data.sentimentCounts.negative, color: "#EF4444", icon: <Frown className="w-3.5 h-3.5" /> },
            ].map(({ label, count, color, icon }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5" style={{ color }}>
                    {icon}
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / totalSentiment) * 100}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Platform breakdown donut */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.43 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">By Platform</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx={50} cy={50} r={36} fill="none" stroke="#F1F5F9" strokeWidth={14} />
                {donutSegments.map((seg) => (
                  <DonutSegment key={seg.platform} pct={seg.pct} color={seg.color} offset={seg.offset} />
                ))}
                <text x={50} y={53} textAnchor="middle" fill="#1E293B" fontSize="11" fontWeight="700">
                  {data.totalMeetings}
                </text>
              </svg>
            </div>
            <div className="flex-1 space-y-2">
              {donutSegments.map((seg) => (
                <div key={seg.platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                    <span className="text-xs text-slate-600">{PLATFORM_LABELS[seg.platform] || seg.platform}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{data.platformCounts[seg.platform]}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Top topics */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-teal-500" />
            <h2 className="text-sm font-bold text-slate-700">Top Topics</h2>
          </div>
          {data.topTopics.length === 0 ? (
            <p className="text-slate-400 text-xs">No topics yet — generate summaries to see topics.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.topTopics.map(({ topic, count }) => (
                <div
                  key={topic}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "#EEF2FF", color: "#4F46E5" }}
                >
                  <span>{topic}</span>
                  <span className="bg-indigo-200 text-indigo-700 rounded-full px-1.5 py-0 text-[10px] font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 3: Duration trend + Action items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Duration trend */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.53 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">Meeting Duration Trend</h2>
            <span className="text-xs text-slate-400 ml-1">last 10 meetings</span>
          </div>
          {data.durationTrend.length === 0 ? (
            <p className="text-slate-400 text-xs">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.durationTrend.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20 flex-shrink-0 truncate">{d.date}</span>
                  <div className="flex-1 h-5 bg-slate-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((d.minutes / 120) * 100, 100)}%` }}
                      transition={{ delay: i * 0.05, duration: 0.5 }}
                      className="h-full rounded-full flex items-center px-2"
                      style={{ background: "linear-gradient(90deg, #4F46E5, #14B8A6)", minWidth: 28 }}
                    >
                      <span className="text-white text-[10px] font-semibold">{d.minutes}m</span>
                    </motion.div>
                  </div>
                  <span className="text-xs text-slate-500 w-24 flex-shrink-0 truncate text-right">{d.title}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Action item completion */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckSquare className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-bold text-slate-700">Action Item Completion</h2>
          </div>

          {/* Big circular progress */}
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx={50} cy={50} r={38} fill="none" stroke="#F1F5F9" strokeWidth={12} />
                <motion.circle
                  cx={50} cy={50} r={38}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={`${(completionRate / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                  initial={{ strokeDasharray: `0 ${2 * Math.PI * 38}` }}
                  animate={{ strokeDasharray: `${(completionRate / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {completionRate}%
                </span>
                <span className="text-slate-400 text-[10px]">done</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs text-slate-500 mb-1">Completed</p>
                <p className="text-xl font-bold text-green-600">{data.completedActionItems}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Remaining</p>
                <p className="text-xl font-bold text-slate-700">{data.totalActionItems - data.completedActionItems}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Total assigned</p>
                <p className="text-xl font-bold text-slate-700">{data.totalActionItems}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
