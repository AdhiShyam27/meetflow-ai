"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Copy, Check, Clock, Mic2,
  Loader2, Trash2, Share2, Mail,
} from "lucide-react";
import { toast } from "sonner";

interface ActionItem {
  task: string;
  owner: string | null;
  dueDate: string | null;
}

interface Meeting {
  id: string;
  title: string;
  platform: string;
  duration: number;
  status: string;
  created_at: string;
  transcript?: string;
  summary?: {
    overview?: string;
    keyPoints?: string[];
    actionItems?: ActionItem[];
    decisions?: string[];
    questions?: string[];
  } | null;
}


const platformLabels: Record<string, { label: string; color: string }> = {
  google_meet: { label: "Google Meet", color: "#4285F4" },
  zoom: { label: "Zoom", color: "#2D8CFF" },
  teams: { label: "MS Teams", color: "#5059C9" },
  other: { label: "Other", color: "#64748B" },
};

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/meetings/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data);
        }
      } catch {
        toast.error("Could not load meeting");
      } finally {
        setLoading(false);
      }
    }
    load();
    // Check Google connection
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setGoogleConnected(d.connected))
      .catch(() => {});
  }, [id]);

  const emailSummary = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch("/api/google/send-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Summary sent to ${data.sentTo}`);
      } else {
        toast.error(data.error ?? "Failed to send email");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSendingEmail(false);
    }
  };

  const copyTranscript = () => {
    if (!meeting?.transcript) return;
    navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Transcript copied!");
  };

  const regenerateSummary = async () => {
    if (!meeting?.transcript) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: meeting.transcript, meetingTitle: meeting.title }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeeting((m) => m ? { ...m, summary: data.summary } : m);

        // Persist the new summary to DB
        await fetch(`/api/meetings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: data.summary }),
        });

        toast.success("Summary regenerated!");
      } else {
        toast.error("Failed to regenerate — check your Anthropic API key");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Mic2 className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-slate-700 font-bold text-lg mb-2">Meeting not found</h2>
        <p className="text-slate-400 text-sm mb-5">This meeting may have been deleted or doesn&apos;t exist.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-indigo-600 font-medium text-sm hover:underline"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const plt = platformLabels[meeting.platform] || platformLabels.other;

  return (
    <div className="flex h-full">
      {/* Left: Transcript */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors mt-0.5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h1 className="text-slate-900 font-bold text-lg leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                {meeting.title}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-medium" style={{ color: plt.color }}>{plt.label}</span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1 text-slate-400 text-xs">
                  <Clock className="w-3 h-3" />
                  {formatDuration(meeting.duration || 0)}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 text-xs">
                  {new Date(meeting.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyTranscript}
                className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-teal-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => toast.success("Share link copied! (Pro feature)")}
                className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <Share2 className="w-3 h-3" />
                Share
              </button>
              {googleConnected && meeting?.summary && (
                <button
                  onClick={emailSummary}
                  disabled={sendingEmail}
                  className="flex items-center gap-1.5 text-xs border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 text-indigo-600 transition-colors disabled:opacity-60"
                >
                  {sendingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  {sendingEmail ? "Sending…" : "Email Summary"}
                </button>
              )}
              <button
                onClick={async () => {
                  if (!confirm("Delete this meeting? This cannot be undone.")) return;
                  const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
                  if (res.ok) {
                    toast.success("Meeting deleted");
                    router.push("/dashboard");
                  } else {
                    toast.error("Failed to delete meeting");
                  }
                }}
                className="flex items-center gap-1.5 text-xs border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 text-red-500 transition-colors"
                title="Delete meeting"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {meeting.transcript ? (
            <div className="space-y-4">
              {meeting.transcript.split("\n").filter(Boolean).map((line, i) => {
                const colonIdx = line.indexOf(":");
                const speaker = colonIdx > 0 ? line.slice(0, colonIdx).trim() : null;
                const text = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line;
                const colors = ["#4F46E5", "#14B8A6", "#F59E0B", "#8B5CF6", "#EC4899"];
                const speakerColor = speaker ? colors[Math.abs([...speaker].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length] : "#64748B";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex gap-3"
                  >
                    {speaker && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: speakerColor }}
                      >
                        {speaker[0]}
                      </div>
                    )}
                    <div>
                      {speaker && (
                        <p className="text-xs font-semibold mb-0.5" style={{ color: speakerColor }}>
                          {speaker}
                        </p>
                      )}
                      <p className="text-slate-700 text-sm leading-relaxed">{text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Mic2 className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">No transcript available for this meeting</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: AI Summary */}
      <div className="w-96 flex flex-col bg-slate-50 border-l border-slate-200 overflow-hidden">
        <div
          className="flex items-center gap-2 px-5 py-4 border-b flex-shrink-0"
          style={{ background: "rgba(20,184,166,0.06)", borderColor: "rgba(20,184,166,0.2)" }}
        >
          <Sparkles className="w-4 h-4 text-teal-500" />
          <span className="text-slate-800 font-bold text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
            AI Summary
          </span>
          <button
            onClick={regenerateSummary}
            disabled={regenerating}
            className="ml-auto text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Regenerate
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {meeting.summary ? (
            <>
              {meeting.summary.overview && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Overview</p>
                  <p className="text-slate-700 text-sm leading-relaxed">{meeting.summary.overview}</p>
                </div>
              )}

              {meeting.summary.keyPoints && meeting.summary.keyPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Points</p>
                  <ul className="space-y-2">
                    {meeting.summary.keyPoints.map((kp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {meeting.summary.actionItems && meeting.summary.actionItems.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">✅ Action Items</p>
                  <div className="space-y-2">
                    {meeting.summary.actionItems.map((item, i) => (
                      <div key={i} className="rounded-xl p-3 bg-white border border-slate-200 shadow-sm">
                        <p className="text-slate-800 text-xs font-semibold leading-snug">{item.task}</p>
                        <div className="flex gap-3 mt-1.5">
                          {item.owner && <span className="text-indigo-600 text-xs">👤 {item.owner}</span>}
                          {item.dueDate && <span className="text-slate-400 text-xs">📅 {item.dueDate}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {meeting.summary.decisions && meeting.summary.decisions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">🔖 Decisions</p>
                  <ul className="space-y-1.5">
                    {meeting.summary.decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {meeting.summary.questions && meeting.summary.questions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">❓ Open Questions</p>
                  <ul className="space-y-1.5">
                    {meeting.summary.questions.map((q, i) => (
                      <li key={i} className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No summary yet</p>
              <button
                onClick={regenerateSummary}
                className="mt-3 text-xs text-teal-600 font-semibold hover:underline"
              >
                Generate with AI →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
