"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic2, Clock, Sparkles, Plus, Search,
  MoreHorizontal, Calendar, ChevronRight, Zap, Trash2,
  ExternalLink, Radio,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Meeting {
  id: string;
  title: string;
  platform: string;
  duration: number;
  status: "done" | "recording" | "processing" | "error";
  created_at: string;
  transcript?: string;
  summary?: Record<string, unknown> | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  platform: string;
  meetLink: string | null;
  attendees: Array<{ email: string; name: string }>;
}

const platformLabels: Record<string, { label: string; color: string; bg: string }> = {
  google_meet: { label: "Google Meet", color: "#4285F4", bg: "#EBF3FE" },
  zoom: { label: "Zoom", color: "#2D8CFF", bg: "#E8F3FF" },
  teams: { label: "MS Teams", color: "#5059C9", bg: "#EEEFFC" },
  other: { label: "Other", color: "#64748B", bg: "#F1F5F9" },
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${timeStr}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ` ${timeStr}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const fetchMeetings = async () => {
    try {
      const res = await fetch("/api/meetings");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMeetings(data.meetings || []);
    } catch {
      toast.error("Could not load meetings");
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = useCallback(() => {
    fetch("/api/google/calendar")
      .then((r) => r.json())
      .then((d) => { if (d.events) setCalendarEvents(d.events); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMeetings();
    fetchCalendar();

    // Re-fetch calendar every 60 seconds
    const calendarInterval = setInterval(fetchCalendar, 60_000);
    // Tick every 30 seconds so countdown badges stay accurate
    const tickInterval = setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      clearInterval(calendarInterval);
      clearInterval(tickInterval);
    };
  }, [fetchCalendar]);

  // Derive active + soon meetings from current time
  const activeMeeting = calendarEvents.find((e) => {
    const start = new Date(e.start).getTime();
    const end = new Date(e.end).getTime();
    return start <= now && now <= end;
  }) ?? null;

  const soonEventIds = new Set(
    calendarEvents
      .filter((e) => {
        const ms = new Date(e.start).getTime() - now;
        return ms > 0 && ms <= 5 * 60 * 1000;
      })
      .map((e) => e.id)
  );

  const handleJoinAndRecord = (event: CalendarEvent) => {
    localStorage.setItem(
      "meetflow_pending_meeting",
      JSON.stringify({ title: event.title, platform: event.platform })
    );
    if (event.meetLink) {
      window.open(event.meetLink, "_blank", "noopener,noreferrer");
    }
    const params = new URLSearchParams({
      title: event.title,
      platform: event.platform,
      autostart: "true",
    });
    router.push(`/dashboard/new?${params.toString()}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this meeting? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      toast.success("Meeting deleted");
    } catch {
      toast.error("Failed to delete meeting");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = meetings.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalMinutes = Math.floor(meetings.reduce((s, m) => s + (m.duration || 0), 0) / 60);
  const totalWords = meetings.reduce((s, m) => {
    const words = m.transcript ? m.transcript.split(/\s+/).length : 0;
    return s + words;
  }, 0);

  const stats = [
    {
      label: "Total Meetings",
      value: meetings.length,
      icon: <Calendar className="w-4 h-4" />,
      color: "#4F46E5",
    },
    {
      label: "Minutes Transcribed",
      value: totalMinutes > 0 ? `${totalMinutes}m` : "0m",
      icon: <Clock className="w-4 h-4" />,
      color: "#14B8A6",
    },
    {
      label: "AI Summaries",
      value: meetings.filter((m) => m.summary).length,
      icon: <Sparkles className="w-4 h-4" />,
      color: "#F59E0B",
    },
    {
      label: "Words Transcribed",
      value: totalWords > 0 ? `${(totalWords / 1000).toFixed(1)}k` : "0",
      icon: <Sparkles className="w-4 h-4" />,
      color: "#14B8A6",
    },
  ];

  return (
    <div className="p-6 max-w-6xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Active meeting banner */}
      <AnimatePresence>
        {activeMeeting && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-6 rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)", boxShadow: "0 4px 20px rgba(220,38,38,0.3)" }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Radio className="w-4 h-4 text-white animate-pulse flex-shrink-0" />
              <span className="text-white font-semibold text-sm truncate">
                {activeMeeting.title}
              </span>
              <span className="text-red-200 text-xs flex-shrink-0">is live now</span>
            </div>
            <button
              onClick={() => handleJoinAndRecord(activeMeeting)}
              className="flex-shrink-0 bg-white text-red-600 font-bold text-xs px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              Join & Record →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Your Meetings
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link href="/dashboard/new">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-amber-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Meeting
          </motion.button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${stat.color}15`, color: stat.color }}
            >
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
              {stat.value}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Upcoming from Google Calendar */}
      {calendarEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">Upcoming Meetings</h2>
            <span className="text-xs text-slate-400 ml-1">from Google Calendar</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {calendarEvents.slice(0, 6).map((event) => {
              const plt = platformLabels[event.platform] || platformLabels.other;
              const isSoon = soonEventIds.has(event.id);
              const isActive = activeMeeting?.id === event.id;
              const minsUntil = Math.ceil((new Date(event.start).getTime() - now) / 60_000);
              return (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all"
                  style={{ borderColor: isActive ? "#DC2626" : isSoon ? "#F59E0B" : "#E2E8F0" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-slate-800 font-semibold text-sm leading-tight line-clamp-2">{event.title}</p>
                    {isActive ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-red-100 text-red-600 animate-pulse">
                        Live
                      </span>
                    ) : isSoon ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-100 text-amber-700 animate-pulse">
                        {minsUntil}m
                      </span>
                    ) : (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: plt.bg, color: plt.color }}
                      >
                        {plt.label}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mb-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatEventTime(event.start)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleJoinAndRecord(event)}
                      className="flex-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg transition-colors"
                    >
                      Join & Record
                    </button>
                    {event.meetLink && (
                      <a
                        href={event.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium border border-slate-200 text-slate-600 py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Join
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
          />
        </div>
      </div>

      {/* Meeting list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200/60 animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Mic2 className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-slate-700 font-semibold mb-2">
            {search ? "No meetings match your search" : "No meetings yet"}
          </h3>
          <p className="text-slate-400 text-sm mb-5">
            {search ? "Try a different search term" : "Start your first live transcription session"}
          </p>
          {!search && (
            <Link href="/dashboard/new">
              <button className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                + Start New Meeting
              </button>
            </Link>
          )}
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filtered.map((meeting, i) => {
            const plt = platformLabels[meeting.platform] || platformLabels.other;
            return (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/dashboard/meeting/${meeting.id}`}>
                  <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200/60 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group flex items-center gap-4">
                    {/* Platform icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ background: plt.bg, color: plt.color }}
                    >
                      {plt.label[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-slate-800 font-semibold text-sm truncate group-hover:text-indigo-700 transition-colors">
                          {meeting.title}
                        </h3>
                        {meeting.summary && (
                          <span className="flex items-center gap-0.5 text-xs text-teal-600 font-medium bg-teal-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <Sparkles className="w-3 h-3" /> AI Summary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="font-medium" style={{ color: plt.color }}>
                          {plt.label}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(meeting.duration || 0)}
                        </span>
                        <span>·</span>
                        <span>{formatDate(meeting.created_at)}</span>
                      </div>
                    </div>

                    {/* Status + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {meeting.status === "done" && (
                        <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-full font-medium">
                          Complete
                        </span>
                      )}
                      {meeting.status === "processing" && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                          Processing
                        </span>
                      )}
                      {meeting.status === "recording" && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium animate-pulse">
                          Recording
                        </span>
                      )}
                      <button
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        onClick={(e) => handleDelete(e, meeting.id)}
                        disabled={deletingId === meeting.id}
                        title="Delete meeting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="text-slate-300 hover:text-slate-600 transition-colors"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Start new meeting CTA */}
      {meetings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 rounded-2xl p-5 flex items-center gap-4 border border-dashed border-indigo-200 bg-indigo-50/40"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-slate-800 font-semibold text-sm">Ready to transcribe your next meeting?</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Open any Google Meet, Zoom, or Teams call and start MeetFlow AI.
            </p>
          </div>
          <Link href="/dashboard/new" className="ml-auto flex-shrink-0">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
              Start Now →
            </button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
