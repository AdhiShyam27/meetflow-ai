"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sparkles, Copy, Check, Clock, Mic2, Loader2,
  Trash2, Share2, Mail, Search, MessageSquare, FileText,
  Zap, StickyNote, Link2, Send, ChevronRight, Lock,
  Plus, ExternalLink, Bookmark, CheckSquare, HelpCircle,
  Lightbulb, Edit2, X, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionItem { task: string; owner: string | null; dueDate: string | null; }
interface Meeting {
  id: string; title: string; platform: string; duration: number;
  status: string; created_at: string; transcript?: string;
  summary?: {
    overview?: string; keyPoints?: string[]; actionItems?: ActionItem[];
    decisions?: string[]; questions?: string[];
  } | null;
  notes?: Note[];
}
interface ChatMessage { role: "user" | "assistant"; content: string; }
interface Note { id: string; text: string; createdAt: string; }
interface TranscriptLine { idx: number; speaker: string; text: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEAKER_COLORS = ["#4F46E5", "#F59E0B", "#14B8A6", "#EF4444", "#8B5CF6", "#EC4899"];

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  google_meet: { label: "Google Meet", color: "#4285F4" },
  zoom: { label: "Zoom", color: "#2D8CFF" },
  teams: { label: "MS Teams", color: "#5059C9" },
  other: { label: "Other", color: "#64748B" },
};

const PROMPT_TEMPLATES = [
  { icon: "✨", label: "Short summary", prompt: "Give me a short 3-5 sentence summary of this meeting." },
  { icon: "📝", label: "Detailed summary", prompt: "Provide a detailed summary of this meeting covering all key topics discussed." },
  { icon: "📋", label: "Summary & Action items", prompt: "Summarize this meeting and extract all action items with owners and deadlines in a clear checklist format." },
  { icon: "✨", label: "Detailed summary with citations", prompt: "Provide a detailed summary of this meeting, citing specific quotes from the transcript to support each point." },
  { icon: "🔄", label: "Team Sync updates", prompt: "What are the project updates, status changes, and blockers mentioned in this meeting?" },
  { icon: "🧠", label: "Smart AI Advice", prompt: "Based on this meeting, what are the most important things to follow up on? What risks, blockers, or dependencies were mentioned that need attention?", isNew: true },
  { icon: "⚡", label: "Generate tasks", prompt: "Extract all tasks and to-dos from this meeting. Format as a numbered checklist with owner and priority where mentioned.", isNew: true },
  { icon: "📊", label: "Prepare slides", prompt: "Create a structured outline for a presentation based on the key points from this meeting. Include slide titles and bullet points." },
];

const WORKFLOWS = [
  { icon: "💬", name: "Post-meeting summary to Slack", desc: "Auto-send summary to your Slack channel after each meeting", active: false },
  { icon: "📧", name: "Action items to email", desc: "Email action items to participants after meeting ends", active: true },
  { icon: "📝", name: "Meeting notes to Notion", desc: "Save formatted notes to a Notion page automatically", active: false },
  { icon: "✅", name: "Tasks to Linear", desc: "Create Linear tickets from extracted action items", active: false },
];

const TABS = [
  { id: "ai", label: "AI Chats", icon: MessageSquare },
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "workflows", label: "Workflows", icon: Zap },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "related", label: "Related", icon: Link2 },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function speakerColor(name: string, idx: number) {
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

function parseTranscript(raw: string): TranscriptLine[] {
  return raw.split("\n").filter(Boolean).map((line, idx) => {
    const colon = line.indexOf(":");
    return {
      idx,
      speaker: colon > 0 ? line.slice(0, colon).trim() : "Speaker",
      text: colon > 0 ? line.slice(colon + 1).trim() : line,
    };
  });
}

function getSpeakerStats(lines: TranscriptLine[]) {
  const counts: Record<string, number> = {};
  lines.forEach((l) => { counts[l.speaker] = (counts[l.speaker] ?? 0) + 1; });
  const total = lines.length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      count,
      pct: count / total,
      color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
      initials: name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
    }));
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function DonutChart({ speakers, duration }: { speakers: ReturnType<typeof getSpeakerStats>; duration: number }) {
  const R = 36, CX = 50, CY = 50, SW = 12;
  const circ = 2 * Math.PI * R;
  let cumulative = 0;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={SW} />
      {speakers.map((sp) => {
        const dashLen = sp.pct * circ;
        const offset = -cumulative * circ;
        cumulative += sp.pct;
        return (
          <circle
            key={sp.name}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={sp.color}
            strokeWidth={SW}
            strokeDasharray={`${dashLen} ${circ}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
      })}
      {/* Center */}
      <text x={CX} y={CY - 4} textAnchor="middle" fill="#1E293B" fontSize="11" fontWeight="700">
        {formatDuration(duration)}
      </text>
      <text x={CX} y={CY + 8} textAnchor="middle" fill="#94A3B8" fontSize="7">
        duration
      </text>
    </svg>
  );
}

// ── Markdown renderer (lightweight) ──────────────────────────────────────────

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm text-slate-700 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <p key={i} className="font-bold text-slate-800 mt-3 text-xs uppercase tracking-wide text-indigo-600">{line.slice(4)}</p>;
        if (line.startsWith("## ")) return <p key={i} className="font-bold text-slate-900 mt-3">{line.slice(3)}</p>;
        if (line.startsWith("# ")) return <p key={i} className="font-bold text-slate-900 text-base mt-3">{line.slice(2)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return (
          <div key={i} className="flex gap-2">
            <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          return (
            <div key={i} className="flex gap-2">
              <span className="text-indigo-400 flex-shrink-0 font-medium text-xs mt-0.5">{num}.</span>
              <span>{renderInline(line.replace(/^\d+\. /, ""))}</span>
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-slate-800">{line.slice(2, -2)}</p>;
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-slate-100 rounded px-1 text-xs font-mono">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("ai");

  // Transcript
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");

  // Actions
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Load meeting
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/meetings/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data);
          if (Array.isArray(data.notes)) setNotes(data.notes);
        }
      } catch { toast.error("Could not load meeting"); }
      finally { setLoading(false); }
    }
    load();
    fetch("/api/google/status").then((r) => r.json()).then((d) => setGoogleConnected(d.connected)).catch(() => {});
  }, [id]);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Cmd+Enter to send
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && activeTab === "ai") sendChat();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, chatInput, messages, streaming]);

  // Cmd+K to jump to search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setActiveTab("transcript");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sendChat = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? chatInput).trim();
    if (!content || streaming) return;
    setChatInput("");

    const userMsg: ChatMessage = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          transcript: meeting?.transcript ?? "",
          meetingTitle: meeting?.title ?? "Meeting",
        }),
      });

      if (!res.ok) throw new Error("API error");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: accumulated },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [chatInput, messages, meeting, streaming]);

  const copyTranscript = () => {
    if (!meeting?.transcript) return;
    navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Transcript copied!");
  };

  const emailSummary = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch("/api/google/send-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: id }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`Summary sent to ${data.sentTo}`);
      else toast.error(data.error ?? "Failed to send email");
    } catch { toast.error("Network error"); }
    finally { setSendingEmail(false); }
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
        await fetch(`/api/meetings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: data.summary }),
        });
        toast.success("Summary regenerated!");
      } else { toast.error("Failed — check Anthropic API key"); }
    } catch { toast.error("Network error"); }
    finally { setRegenerating(false); }
  };

  const addNote = async () => {
    if (!noteInput.trim()) return;
    const newNote: Note = { id: String(Date.now()), text: noteInput.trim(), createdAt: new Date().toISOString() };
    const updated = [newNote, ...notes];
    setNotes(updated);
    setNoteInput("");
    try {
      await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: updated }),
      });
    } catch { /* non-critical */ }
  };

  const deleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    try {
      await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: updated }),
      });
    } catch { /* non-critical */ }
  };

  const deleteMeeting = async () => {
    if (!confirm("Delete this meeting? This cannot be undone.")) return;
    const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Meeting deleted"); router.push("/dashboard"); }
    else toast.error("Failed to delete meeting");
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const transcriptLines = meeting?.transcript ? parseTranscript(meeting.transcript) : [];
  const speakerStats = getSpeakerStats(transcriptLines);
  const filteredLines = transcriptSearch
    ? transcriptLines.filter((l) => l.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || l.speaker.toLowerCase().includes(transcriptSearch.toLowerCase()))
    : transcriptLines;
  const plt = PLATFORM_LABELS[meeting?.platform ?? ""] ?? PLATFORM_LABELS.other;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Mic2 className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-slate-700 font-bold text-lg mb-2">Meeting not found</h2>
        <p className="text-slate-400 text-sm mb-5">This meeting may have been deleted.</p>
        <button onClick={() => router.push("/dashboard")} className="text-indigo-600 font-medium text-sm hover:underline">← Back to dashboard</button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden bg-white">

      {/* ── CENTER ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Meeting header */}
        <div className="border-b border-slate-200 flex-shrink-0">
          {/* Breadcrumb + title */}
          <div className="px-5 pt-4 pb-3 flex items-start gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors mt-0.5 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push("/dashboard")}>My Meetings</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-600 font-medium truncate">{meeting.title}</span>
              </div>
              <h1 className="text-slate-900 font-bold text-base leading-snug truncate">{meeting.title}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs font-medium" style={{ color: plt.color }}>{plt.label}</span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1 text-slate-400 text-xs">
                  <Clock className="w-3 h-3" /> {formatDuration(meeting.duration || 0)}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 text-xs">
                  {new Date(meeting.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={copyTranscript} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                {copied ? <Check className="w-3 h-3 text-teal-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button onClick={() => toast.success("Share link copied!")} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                <Share2 className="w-3 h-3" /> <span>Share</span>
              </button>
              {googleConnected && meeting?.summary && (
                <button onClick={emailSummary} disabled={sendingEmail} className="flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors disabled:opacity-60">
                  {sendingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  <span>{sendingEmail ? "Sending…" : "Email"}</span>
                </button>
              )}
              <button onClick={deleteMeeting} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex px-5 gap-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                    active
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === "related" && <span className="bg-slate-100 text-slate-500 text-xs px-1.5 rounded-full ml-0.5">0</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── TAB: AI Chats ──────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {activeTab === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
                {messages.length === 0 ? (
                  /* Empty state — prompt templates */
                  <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-xl mx-auto">
                      <div className="text-center mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-200">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-slate-800 font-bold text-lg">What will you create today?</h2>
                        <p className="text-slate-400 text-sm mt-1">Choose a prompt or type your own question below</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {PROMPT_TEMPLATES.map((t) => (
                          <button
                            key={t.label}
                            onClick={() => { setActiveTab("ai"); sendChat(t.prompt); }}
                            className="group text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-base flex-shrink-0 mt-0.5">{t.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">{t.label}</span>
                                  {t.isNew && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 rounded-full font-semibold">NEW</span>}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      <button className="mt-4 w-full text-center text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                        View all AI prompts ▾
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Chat messages */
                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                    {messages.map((msg, i) => (
                      <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex gap-3"}>
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[80%] ${msg.role === "user" ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm" : "flex-1"}`}>
                          {msg.role === "user" ? (
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          ) : (
                            <div className="relative group">
                              {msg.content ? <Markdown text={msg.content} /> : (
                                <div className="flex gap-1 items-center py-2">
                                  {[0, 1, 2].map((j) => (
                                    <motion.div key={j} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.12 }} className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                                  ))}
                                </div>
                              )}
                              {msg.content && !streaming && (
                                <button
                                  onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied!"); }}
                                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Chat input */}
                <div className="border-t border-slate-200 p-4 flex-shrink-0">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(); } }}
                      placeholder="Ask MeetFlow anything about the meeting…"
                      rows={2}
                      className="flex-1 resize-none text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
                    />
                    <button
                      onClick={() => sendChat()}
                      disabled={!chatInput.trim() || streaming}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
                    >
                      {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Ask AI</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 text-right">⌘ Enter to send</p>
                </div>
              </motion.div>
            )}

            {/* ── TAB: Transcript ──────────────────────────────────────────── */}
            {activeTab === "transcript" && (
              <motion.div key="transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
                {/* Search bar */}
                <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      placeholder="Search in transcript…"
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                    />
                    {transcriptSearch && (
                      <button onClick={() => setTranscriptSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {transcriptSearch && (
                    <p className="text-xs text-slate-400 mt-1.5">{filteredLines.length} result{filteredLines.length !== 1 ? "s" : ""}</p>
                  )}
                </div>

                {/* Transcript lines */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {filteredLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Mic2 className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-slate-400 text-sm">{transcriptSearch ? "No matches found" : "No transcript available"}</p>
                    </div>
                  ) : (
                    filteredLines.map((line) => {
                      const spIdx = speakerStats.findIndex((s) => s.name === line.speaker);
                      const color = speakerColor(line.speaker, spIdx);
                      const initials = line.speaker.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                      const isHovered = hoveredLine === line.idx;
                      return (
                        <motion.div
                          key={line.idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: line.idx * 0.015 }}
                          className="relative group flex gap-3"
                          onMouseEnter={() => setHoveredLine(line.idx)}
                          onMouseLeave={() => setHoveredLine(null)}
                        >
                          {/* Hover toolbar */}
                          <AnimatePresence>
                            {isHovered && (
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                className="absolute -top-8 left-8 flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl shadow-lg px-1 py-1 z-10"
                              >
                                {[
                                  { icon: <Bookmark className="w-3 h-3" />, tip: "Bookmark" },
                                  { icon: <CheckSquare className="w-3 h-3 text-emerald-500" />, tip: "Mark as action" },
                                  { icon: <HelpCircle className="w-3 h-3 text-red-400" />, tip: "Mark as question" },
                                  { icon: <Lightbulb className="w-3 h-3 text-amber-400" />, tip: "Insight" },
                                  { icon: <MessageSquare className="w-3 h-3" />, tip: "Comment" },
                                  { icon: <Edit2 className="w-3 h-3" />, tip: "Edit" },
                                  { icon: <Trash2 className="w-3 h-3 text-red-400" />, tip: "Delete" },
                                ].map((btn, i) => (
                                  <button key={i} title={btn.tip} onClick={() => toast.success(`${btn.tip} — coming soon!`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                                    {btn.icon}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Timestamp */}
                          <span className="text-slate-300 text-xs font-mono mt-0.5 w-10 flex-shrink-0 text-right">
                            {String(Math.floor(line.idx * 15 / 60)).padStart(2, "0")}:{String((line.idx * 15) % 60).padStart(2, "0")}
                          </span>

                          {/* Avatar */}
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: color }}>
                            {initials}
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <p className="text-xs font-semibold mb-0.5" style={{ color }}>{line.speaker}</p>
                            <p className={`text-slate-700 text-sm leading-relaxed ${transcriptSearch && (line.text.toLowerCase().includes(transcriptSearch.toLowerCase())) ? "bg-amber-50 rounded px-1 -mx-1" : ""}`}>
                              {line.text}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* Ask AI bar */}
                <div className="border-t border-slate-100 p-3 flex gap-2 flex-shrink-0">
                  <input
                    placeholder="Ask MeetFlow anything about the meeting…"
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-700 placeholder-slate-400"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) { setActiveTab("ai"); setTimeout(() => sendChat(val), 100); (e.target as HTMLInputElement).value = ""; }
                      }
                    }}
                  />
                  <button onClick={() => setActiveTab("ai")} className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
                    <Sparkles className="w-3 h-3" /> Ask AI
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── TAB: Workflows ───────────────────────────────────────────── */}
            {activeTab === "workflows" && (
              <motion.div key="workflows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto p-6">
                <div className="max-w-lg">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-slate-800 font-bold text-base">Meeting Workflows</h2>
                      <p className="text-slate-400 text-xs mt-0.5">Automate your post-meeting tasks</p>
                    </div>
                    <button onClick={() => toast.success("Custom workflows — coming in Pro!")} className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors">
                      <Plus className="w-3 h-3" /> New Workflow
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {WORKFLOWS.map((w, i) => (
                      <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors cursor-pointer" onClick={() => toast.success(`${w.name} — coming in Pro!`)}>
                        <span className="text-xl flex-shrink-0">{w.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{w.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full ${w.active ? "bg-emerald-400" : "bg-slate-300"}`} />
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    ))}

                    {/* Empty state card */}
                    <button
                      onClick={() => toast.success("Build your own workflow — coming in Pro!")}
                      className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-center"
                    >
                      <Plus className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-sm font-semibold text-slate-500">Build a custom workflow</p>
                      <p className="text-xs text-slate-400 mt-0.5">Connect any app and automate your tasks</p>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TAB: Notes ───────────────────────────────────────────────── */}
            {activeTab === "notes" && (
              <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex-shrink-0">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add a note or comment about this meeting…"
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-slate-800 placeholder-slate-400"
                  />
                  <button
                    onClick={addNote}
                    disabled={!noteInput.trim()}
                    className="mt-2 text-xs bg-indigo-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Add Note
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <StickyNote className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-slate-400 text-sm">No notes yet — add your first note above</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="flex gap-3 p-3.5 rounded-xl border border-slate-200 bg-white">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">Y</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-semibold text-slate-700">You</p>
                            <p className="text-xs text-slate-400">{new Date(note.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
                        </div>
                        <button onClick={() => deleteNote(note.id)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* ── TAB: Related ─────────────────────────────────────────────── */}
            {activeTab === "related" && (
              <motion.div key="related" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <Link2 className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-slate-600 font-semibold mb-1">No related meetings</h3>
                <p className="text-slate-400 text-sm">Related meetings will appear here based on participants and topics</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-l border-slate-200 flex flex-col overflow-hidden bg-slate-50">

        {/* Recording info */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">Y</div>
            <div>
              <p className="text-xs font-semibold text-slate-700">Recorded by you</p>
              <p className="text-xs text-slate-400">{new Date(meeting.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-1">
            {[
              { icon: <Lock className="w-3 h-3" />, label: "Private meeting" },
              { icon: <Share2 className="w-3 h-3" />, label: "Share this meeting" },
              { icon: <Plus className="w-3 h-3" />, label: "Link recording" },
            ].map((a) => (
              <button key={a.label} onClick={() => toast.success(`${a.label} — coming soon!`)} className="w-full flex items-center gap-2 text-xs text-slate-600 hover:text-indigo-700 hover:bg-white rounded-lg px-2 py-1.5 transition-colors">
                <span className="text-slate-400">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* External links */}
        <div className="px-4 py-3 border-b border-slate-200 space-y-1">
          {[
            "Install Google Workspace extension",
            "Learn about recordings",
            "Learn about screenshots",
          ].map((label) => (
            <button key={label} onClick={() => toast.success("Coming soon!")} className="w-full flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 py-1 transition-colors text-left">
              <ExternalLink className="w-3 h-3 flex-shrink-0" /> {label}
            </button>
          ))}
        </div>

        {/* Participants & Stats */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Participants & Stats</p>
            {speakerStats.length > 0 && (
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 rounded-full font-semibold">{speakerStats.length}</span>
            )}
            {meeting.summary && (
              <button onClick={regenerateSummary} disabled={regenerating} className="ml-auto text-slate-400 hover:text-indigo-600 transition-colors" title="Regenerate summary">
                {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </button>
            )}
          </div>

          {speakerStats.length > 0 ? (
            <>
              {/* Donut chart */}
              <div className="w-32 h-32 mx-auto mb-4">
                <DonutChart speakers={speakerStats} duration={meeting.duration || 0} />
              </div>

              {/* Speaker list */}
              <div className="space-y-2.5">
                {speakerStats.map((sp) => (
                  <div key={sp.name} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: sp.color }}>
                      {sp.initials[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-medium text-slate-700 truncate">{sp.name}</p>
                        <p className="text-xs text-slate-400 flex-shrink-0 ml-1">{Math.round(sp.pct * 100)}%</p>
                      </div>
                      <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${sp.pct * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          className="h-full rounded-full"
                          style={{ background: sp.color }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Mic2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No transcript — record a meeting to see speaker stats</p>
            </div>
          )}

          {/* AI Summary quick view */}
          {meeting.summary?.overview && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">AI Summary</p>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{meeting.summary.overview}</p>
              <button onClick={() => setActiveTab("ai")} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium mt-1.5">
                Chat with AI →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
