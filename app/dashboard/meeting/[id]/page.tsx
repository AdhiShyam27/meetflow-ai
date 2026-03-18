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

interface ActionItem {
  task: string; owner: string | null; dueDate: string | null;
  priority?: "high" | "medium" | "low"; completed?: boolean;
}
interface WorkflowRunResult { status: string; error?: string; at: string; }
interface Meeting {
  id: string; title: string; platform: string; duration: number;
  status: string; created_at: string; transcript?: string;
  summary?: {
    overview?: string; keyPoints?: string[]; actionItems?: ActionItem[];
    decisions?: string[]; questions?: string[];
    speakerNames?: Record<string, string>;
    sentiment?: { label: "positive" | "neutral" | "negative"; score: number };
    healthScore?: number;
    topics?: string[];
    followUpEmail?: { subject: string; body: string };
    nextAgenda?: string[];
  } | null;
  notes?: Note[];
  workflow_runs?: Record<string, WorkflowRunResult>;
}
interface WorkflowConfig {
  slack: { enabled: boolean; webhookUrl: string };
  email: { enabled: boolean; recipients: string };
  notion: { enabled: boolean; apiKey: string; databaseId: string };
  linear: { enabled: boolean; apiKey: string; teamId: string };
  webhook: { enabled: boolean; url: string };
}
interface ChatMessage { role: "user" | "assistant"; content: string; }
interface Note { id: string; text: string; createdAt: string; }
interface TranscriptLine { idx: number; speaker: string; text: string; }
interface CustomPrompt { id: string; label: string; prompt: string; }
interface SpeakerWordStat {
  name: string; words: number; pct: number; color: string; initials: string;
}

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

const WORKFLOW_DEFS: Array<{
  key: keyof WorkflowConfig;
  icon: string;
  name: string;
  desc: string;
}> = [
  { key: "slack",   icon: "💬", name: "Slack",          desc: "Post meeting summary to a Slack channel" },
  { key: "email",   icon: "📧", name: "Email",           desc: "Send summary to recipients via Gmail" },
  { key: "notion",  icon: "📝", name: "Notion",          desc: "Save notes and action items to Notion" },
  { key: "linear",  icon: "✅", name: "Linear",          desc: "Create Linear issues from action items" },
  { key: "webhook", icon: "🔗", name: "Custom Webhook",  desc: "POST meeting data to any HTTP endpoint" },
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

function getSpeakerWordStats(lines: TranscriptLine[]): SpeakerWordStat[] {
  const wordCounts: Record<string, number> = {};
  lines.forEach((l) => {
    const words = l.text.trim().split(/\s+/).filter(Boolean).length;
    wordCounts[l.speaker] = (wordCounts[l.speaker] ?? 0) + words;
  });
  const totalWords = Object.values(wordCounts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, words], i) => ({
      name,
      words,
      pct: words / totalWords,
      color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
      initials: name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
    }));
}

const CUSTOM_PROMPTS_KEY = "meetflow_custom_prompts";

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

  // Speaker name editing (Feature 4)
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editingSpeakerValue, setEditingSpeakerValue] = useState("");

  // Export (Feature 5) — no extra state needed beyond meeting data

  // Custom AI prompts (Feature 7)
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [newPromptLabel, setNewPromptLabel] = useState("");
  const [newPromptText, setNewPromptText] = useState("");

  // Email team modal (Feature 8)
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [sendingTeamEmail, setSendingTeamEmail] = useState(false);

  // Workflows
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Load meeting + custom prompts from localStorage
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
    fetch("/api/workflows/config").then((r) => r.ok ? r.json() : null).then((cfg: WorkflowConfig | null) => { if (cfg) setWorkflowConfig(cfg); }).catch(() => {});

    // Load custom prompts from localStorage
    try {
      const stored = localStorage.getItem(CUSTOM_PROMPTS_KEY);
      if (stored) setCustomPrompts(JSON.parse(stored) as CustomPrompt[]);
    } catch { /* ignore */ }
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

  const toggleActionItem = async (idx: number) => {
    if (!meeting?.summary?.actionItems) return;
    const updated = meeting.summary.actionItems.map((item, i) =>
      i === idx ? { ...item, completed: !item.completed } : item
    );
    const updatedSummary = { ...meeting.summary, actionItems: updated };
    setMeeting((m) => m ? { ...m, summary: updatedSummary } : m);
    try {
      await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: updatedSummary }),
      });
    } catch { /* non-critical */ }
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

  // ── Feature 4: Speaker name editing ──────────────────────────────────────
  const saveSpeakerName = async (original: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === original) { setEditingSpeaker(null); return; }
    const updatedNames = {
      ...(meeting?.summary?.speakerNames ?? {}),
      [original]: trimmed,
    };
    const updatedSummary = { ...(meeting?.summary ?? {}), speakerNames: updatedNames };
    setMeeting((m) => m ? { ...m, summary: updatedSummary } : m);
    setEditingSpeaker(null);
    try {
      await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: updatedSummary }),
      });
      toast.success(`Speaker renamed to "${trimmed}"`);
    } catch { toast.error("Failed to save speaker name"); }
  };

  // ── Export helpers ────────────────────────────────────────────────────────
  const [showExportMenu, setShowExportMenu] = useState(false);

  const buildTextContent = () => {
    if (!meeting) return "";
    const date = new Date(meeting.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const s = meeting.summary;
    const lines: string[] = [
      `MEETING SUMMARY — ${meeting.title}`,
      `Date: ${date}   Duration: ${formatDuration(meeting.duration || 0)}   Platform: ${plt.label}`,
      "",
    ];
    if (s?.overview) { lines.push("OVERVIEW", s.overview, ""); }
    if (s?.keyPoints?.length) { lines.push("KEY POINTS", ...s.keyPoints.map((k) => `• ${k}`), ""); }
    if (s?.actionItems?.length) {
      lines.push("ACTION ITEMS");
      s.actionItems.forEach((a) => {
        let line = `• ${a.task}`;
        if (a.owner) line += ` [${a.owner}]`;
        if (a.dueDate) line += ` (${a.dueDate})`;
        lines.push(line);
      });
      lines.push("");
    }
    if (s?.decisions?.length) { lines.push("DECISIONS", ...s.decisions.map((d) => `• ${d}`), ""); }
    if (s?.questions?.length) { lines.push("OPEN QUESTIONS", ...s.questions.map((q) => `• ${q}`), ""); }
    if (meeting.transcript) {
      lines.push("─".repeat(60), "FULL TRANSCRIPT", "─".repeat(60), "", meeting.transcript);
    }
    return lines.join("\n");
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeFilename = (ext: string) =>
    `${meeting!.title.replace(/[^a-z0-9]/gi, "_")}_${new Date(meeting!.created_at).toISOString().slice(0, 10)}.${ext}`;

  const exportText = () => {
    if (!meeting) return;
    downloadBlob(buildTextContent(), safeFilename("txt"), "text/plain;charset=utf-8");
    toast.success("Text file downloaded");
    setShowExportMenu(false);
  };

  const exportMarkdown = () => {
    if (!meeting) return;
    const date = new Date(meeting.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const s = meeting.summary;
    const lines: string[] = [
      `# ${meeting.title}`,
      `**Date:** ${date} · **Duration:** ${formatDuration(meeting.duration || 0)} · **Platform:** ${plt.label}`,
      "",
    ];
    if (s?.overview) { lines.push("## Overview", s.overview, ""); }
    if (s?.keyPoints?.length) {
      lines.push("## Key Points");
      s.keyPoints.forEach((k) => lines.push(`- ${k}`));
      lines.push("");
    }
    if (s?.actionItems?.length) {
      lines.push("## Action Items");
      s.actionItems.forEach((a) => {
        let line = `- [ ] ${a.task}`;
        if (a.owner) line += ` *(${a.owner})*`;
        if (a.dueDate) line += ` — due ${a.dueDate}`;
        lines.push(line);
      });
      lines.push("");
    }
    if (s?.decisions?.length) {
      lines.push("## Decisions");
      s.decisions.forEach((d) => lines.push(`- ${d}`));
      lines.push("");
    }
    if (s?.questions?.length) {
      lines.push("## Open Questions");
      s.questions.forEach((q) => lines.push(`- ${q}`));
      lines.push("");
    }
    if (meeting.transcript) {
      lines.push("## Transcript", "");
      meeting.transcript.split("\n").forEach((line) => {
        const match = line.match(/^(.+?):\s(.+)$/);
        if (match) lines.push(`**${resolveName(match[1])}:** ${match[2]}`);
        else if (line.trim()) lines.push(line);
      });
    }
    downloadBlob(lines.join("\n"), safeFilename("md"), "text/markdown;charset=utf-8");
    toast.success("Markdown file downloaded");
    setShowExportMenu(false);
  };

  const exportJson = () => {
    if (!meeting) return;
    const payload = {
      id: meeting.id,
      title: meeting.title,
      platform: meeting.platform,
      date: meeting.created_at,
      duration: meeting.duration,
      status: meeting.status,
      summary: meeting.summary,
      transcript: meeting.transcript,
    };
    downloadBlob(JSON.stringify(payload, null, 2), safeFilename("json"), "application/json;charset=utf-8");
    toast.success("JSON file downloaded");
    setShowExportMenu(false);
  };

  const exportCsv = () => {
    if (!meeting) return;
    const items = meeting.summary?.actionItems ?? [];
    if (!items.length) { toast.error("No action items to export"); return; }
    const rows = [["Task", "Owner", "Due Date", "Meeting", "Date"]];
    items.forEach((a) => {
      rows.push([
        `"${a.task.replace(/"/g, '""')}"`,
        `"${(a.owner ?? "").replace(/"/g, '""')}"`,
        `"${(a.dueDate ?? "").replace(/"/g, '""')}"`,
        `"${meeting.title.replace(/"/g, '""')}"`,
        new Date(meeting.created_at).toISOString().slice(0, 10),
      ]);
    });
    downloadBlob(rows.map((r) => r.join(",")).join("\n"), safeFilename("csv"), "text/csv;charset=utf-8");
    toast.success("CSV downloaded — open in Excel or Google Sheets");
    setShowExportMenu(false);
  };

  const exportDocx = async () => {
    if (!meeting) return;
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const s = meeting.summary;
      const date = new Date(meeting.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [];

      const h = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]) =>
        new Paragraph({ text, heading: level, spacing: { before: 240, after: 80 } });
      const bullet = (text: string) =>
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] });
      const body = (text: string) =>
        new Paragraph({ children: [new TextRun(text)], spacing: { after: 80 } });

      children.push(h(meeting.title, HeadingLevel.HEADING_1));
      children.push(body(`Date: ${date}   •   Duration: ${formatDuration(meeting.duration || 0)}   •   Platform: ${plt.label}`));

      if (s?.overview) {
        children.push(h("Overview", HeadingLevel.HEADING_2));
        children.push(body(s.overview));
      }
      if (s?.keyPoints?.length) {
        children.push(h("Key Points", HeadingLevel.HEADING_2));
        s.keyPoints.forEach((k) => children.push(bullet(k)));
      }
      if (s?.actionItems?.length) {
        children.push(h("Action Items", HeadingLevel.HEADING_2));
        s.actionItems.forEach((a) => {
          let text = a.task;
          if (a.owner) text += ` [${a.owner}]`;
          if (a.dueDate) text += ` (${a.dueDate})`;
          children.push(bullet(text));
        });
      }
      if (s?.decisions?.length) {
        children.push(h("Decisions", HeadingLevel.HEADING_2));
        s.decisions.forEach((d) => children.push(bullet(d)));
      }
      if (s?.questions?.length) {
        children.push(h("Open Questions", HeadingLevel.HEADING_2));
        s.questions.forEach((q) => children.push(bullet(q)));
      }
      if (meeting.transcript) {
        children.push(h("Full Transcript", HeadingLevel.HEADING_2));
        meeting.transcript.split("\n").forEach((line) => {
          const match = line.match(/^(.+?):\s(.+)$/);
          if (match) {
            children.push(new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: resolveName(match[1]) + ": ", bold: true }),
                new TextRun(match[2]),
              ],
            }));
          } else if (line.trim()) {
            children.push(body(line));
          }
        });
      }

      const doc = new Document({
        sections: [{ properties: {}, children }],
        creator: "MeetFlow AI",
        title: meeting.title,
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename("docx");
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document downloaded");
      setShowExportMenu(false);
    } catch (err) {
      console.error("[exportDocx]", err);
      toast.error("Failed to generate Word document");
    }
  };

  const exportPdf = () => {
    if (!meeting) return;
    const s = meeting.summary;
    const date = new Date(meeting.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const section = (title: string, items: string[]) => items.length
      ? `<h2>${title}</h2><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
      : "";

    const actionHtml = s?.actionItems?.length
      ? `<h2>Action Items</h2><ul>${s.actionItems.map((a) => {
          let t = a.task;
          if (a.owner) t += ` <em>[${a.owner}]</em>`;
          if (a.dueDate) t += ` <span class="due">Due: ${a.dueDate}</span>`;
          return `<li>${t}</li>`;
        }).join("")}</ul>`
      : "";

    const transcriptHtml = meeting.transcript
      ? `<h2>Transcript</h2><div class="transcript">${meeting.transcript.split("\n").map((line) => {
          const match = line.match(/^(.+?):\s(.+)$/);
          return match
            ? `<p><strong>${resolveName(match[1])}:</strong> ${match[2]}</p>`
            : line.trim() ? `<p>${line}</p>` : "";
        }).join("")}</div>`
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${meeting.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 48px; max-width: 800px; margin: 0 auto; font-size: 14px; line-height: 1.6; }
  h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 32px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
  h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4f46e5; margin: 28px 0 10px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; color: #334155; }
  .transcript p { margin-bottom: 8px; }
  .transcript strong { color: #4f46e5; }
  .due { background: #fef3c7; color: #92400e; font-size: 11px; padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-style: normal; }
  em { color: #64748b; }
  @media print { body { padding: 24px; } }
</style>
</head><body>
<h1>${meeting.title}</h1>
<p class="meta">${date} &nbsp;·&nbsp; ${formatDuration(meeting.duration || 0)} &nbsp;·&nbsp; ${plt.label}</p>
${s?.overview ? `<h2>Overview</h2><p>${s.overview}</p>` : ""}
${section("Key Points", s?.keyPoints ?? [])}
${actionHtml}
${section("Decisions", s?.decisions ?? [])}
${section("Open Questions", s?.questions ?? [])}
${transcriptHtml}
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (w) { w.document.write(html); w.document.close(); }
    setShowExportMenu(false);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/dashboard/meeting/${meeting?.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied to clipboard"));
    setShowExportMenu(false);
  };

  // ── Feature 7: Custom prompts ─────────────────────────────────────────────
  const saveCustomPrompt = () => {
    if (!newPromptLabel.trim() || !newPromptText.trim()) return;
    const np: CustomPrompt = { id: String(Date.now()), label: newPromptLabel.trim(), prompt: newPromptText.trim() };
    const updated = [...customPrompts, np];
    setCustomPrompts(updated);
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(updated));
    setNewPromptLabel("");
    setNewPromptText("");
    setShowAddPrompt(false);
    toast.success("Prompt saved");
  };

  const deleteCustomPrompt = (promptId: string) => {
    const updated = customPrompts.filter((p) => p.id !== promptId);
    setCustomPrompts(updated);
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(updated));
  };

  // ── Feature 8: Email team ─────────────────────────────────────────────────
  const sendTeamEmail = async () => {
    const emails = emailRecipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (!emails.length) { toast.error("Enter at least one email address"); return; }
    const invalid = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid.length) { toast.error(`Invalid email(s): ${invalid.join(", ")}`); return; }
    if (emails.length > 20) { toast.error("Maximum 20 recipients"); return; }
    setSendingTeamEmail(true);
    try {
      const res = await fetch("/api/google/send-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: id, recipientEmails: emails }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Summary sent to ${emails.length} recipient${emails.length > 1 ? "s" : ""}`);
        setShowEmailModal(false);
        setEmailRecipients("");
      } else {
        toast.error(data.error ?? "Failed to send email");
      }
    } catch { toast.error("Network error"); }
    finally { setSendingTeamEmail(false); }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const speakerNames: Record<string, string> = meeting?.summary?.speakerNames ?? {};
  const resolveName = (raw: string) => speakerNames[raw] ?? raw;

  const transcriptLines = meeting?.transcript ? parseTranscript(meeting.transcript) : [];
  // Apply speaker name overrides to transcript lines for display
  const resolvedLines = transcriptLines.map((l) => ({ ...l, speaker: resolveName(l.speaker) }));
  const speakerStats = getSpeakerStats(resolvedLines);
  const speakerWordStats = getSpeakerWordStats(resolvedLines);
  const filteredLines = transcriptSearch
    ? resolvedLines.filter((l) => l.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || l.speaker.toLowerCase().includes(transcriptSearch.toLowerCase()))
    : resolvedLines;
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

      {/* ── Email Team Modal (Feature 8) ──────────────────────────────────── */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowEmailModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-900 font-bold text-base">Email Meeting Summary</h2>
                <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recipients <span className="text-slate-400 font-normal">(comma-separated, max 20)</span></label>
              <input
                type="text"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-slate-800 placeholder-slate-400 mb-4"
              />

              {/* Email preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Preview</p>
                <p className="text-sm font-bold text-slate-800 mb-1">{meeting.title}</p>
                {meeting.summary?.overview && (
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">{meeting.summary.overview}</p>
                )}
                {meeting.summary?.actionItems && meeting.summary.actionItems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-1">Action Items:</p>
                    <ul className="space-y-0.5">
                      {meeting.summary.actionItems.slice(0, 5).map((a, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                          <span className="text-indigo-400 flex-shrink-0">•</span>
                          <span>{a.task}{a.owner ? ` — ${a.owner}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl py-2.5 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendTeamEmail}
                  disabled={sendingTeamEmail || !emailRecipients.trim()}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl py-2.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {sendingTeamEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {sendingTeamEmail ? "Sending…" : "Send Email"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                >
                  <FileText className="w-3 h-3" /> <span>Export</span>
                  <ChevronRight className="w-3 h-3 rotate-90" />
                </button>
                <AnimatePresence>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]"
                      >
                        {[
                          { label: "PDF (Print)", icon: "🖨️", action: exportPdf },
                          { label: "Word (.docx)", icon: "📄", action: exportDocx },
                          { label: "Plain Text", icon: "📝", action: exportText },
                          { label: "Markdown", icon: "⬇️", action: exportMarkdown },
                          { label: "JSON", icon: "{ }", action: exportJson },
                          { label: "Action Items CSV", icon: "📊", action: exportCsv },
                        ].map((item) => (
                          <button
                            key={item.label}
                            onClick={item.action}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
                          >
                            <span className="text-sm">{item.icon}</span> {item.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={copyTranscript} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                {copied ? <Check className="w-3 h-3 text-teal-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button onClick={copyShareLink} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                <Share2 className="w-3 h-3" /> <span>Share</span>
              </button>
              {googleConnected && meeting?.summary && (
                <>
                  <button onClick={emailSummary} disabled={sendingEmail} className="flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors disabled:opacity-60">
                    {sendingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    <span>{sendingEmail ? "Sending…" : "Email Me"}</span>
                  </button>
                  <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-1 text-xs text-teal-600 border border-teal-200 rounded-lg px-2.5 py-1.5 hover:bg-teal-50 transition-colors">
                    <Mail className="w-3 h-3" /> <span>Email Team</span>
                  </button>
                </>
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

                      {/* ── Feature 3: Speaker Analytics card ────────── */}
                      {speakerWordStats.length >= 2 && (
                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Speaker Breakdown</p>
                          <div className="space-y-2.5">
                            {speakerWordStats.map((sp) => (
                              <div key={sp.name} className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sp.color }} />
                                <span className="text-xs font-medium text-slate-700 w-20 truncate flex-shrink-0">{sp.name}</span>
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${sp.pct * 100}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="h-full rounded-full"
                                    style={{ background: sp.color }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400 flex-shrink-0 w-20 text-right">
                                  {sp.words.toLocaleString()}w · {Math.round(sp.words / 130)}m
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Action Item Completion Tracker ───────────── */}
                      {meeting.summary?.actionItems && meeting.summary.actionItems.length > 0 && (
                        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Action Items</p>
                            <span className="text-xs text-slate-400">
                              {meeting.summary.actionItems.filter((a) => a.completed).length}/{meeting.summary.actionItems.length} done
                            </span>
                          </div>
                          <div className="space-y-2">
                            {meeting.summary.actionItems.map((item, i) => (
                              <div
                                key={i}
                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${item.completed ? "opacity-60" : ""}`}
                                onClick={() => toggleActionItem(i)}
                              >
                                <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${item.completed ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                                  {item.completed && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs text-slate-700 leading-relaxed ${item.completed ? "line-through text-slate-400" : ""}`}>
                                    {item.task}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {item.owner && <span className="text-[10px] text-slate-400">{item.owner}</span>}
                                    {item.dueDate && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0 rounded-full">{item.dueDate}</span>}
                                    {item.priority && (
                                      <span className={`text-[10px] px-1.5 rounded-full font-medium ${
                                        item.priority === "high" ? "bg-red-50 text-red-600" :
                                        item.priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                                      }`}>{item.priority}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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

                      {/* ── Feature 7: Custom saved prompts ──────────── */}
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Saved Prompts</p>
                          <button
                            onClick={() => setShowAddPrompt((v) => !v)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add Prompt
                          </button>
                        </div>

                        {showAddPrompt && (
                          <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                            <input
                              type="text"
                              value={newPromptLabel}
                              onChange={(e) => setNewPromptLabel(e.target.value)}
                              placeholder="Label (e.g. Risk summary)"
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white text-slate-800 placeholder-slate-400"
                            />
                            <textarea
                              value={newPromptText}
                              onChange={(e) => setNewPromptText(e.target.value)}
                              placeholder="Prompt text…"
                              rows={2}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white text-slate-800 placeholder-slate-400"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveCustomPrompt}
                                disabled={!newPromptLabel.trim() || !newPromptText.trim()}
                                className="text-xs bg-indigo-600 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setShowAddPrompt(false); setNewPromptLabel(""); setNewPromptText(""); }}
                                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {customPrompts.length === 0 && !showAddPrompt && (
                          <p className="text-xs text-slate-400 text-center py-2">No saved prompts yet — add your own reusable prompts above</p>
                        )}

                        {customPrompts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {customPrompts.map((cp) => (
                              <div key={cp.id} className="flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg pl-2.5 pr-1 py-1 group transition-colors">
                                <button
                                  onClick={() => { setChatInput(cp.prompt); inputRef.current?.focus(); }}
                                  className="text-xs text-slate-700 group-hover:text-indigo-700 font-medium transition-colors"
                                >
                                  {cp.label}
                                </button>
                                <button
                                  onClick={() => deleteCustomPrompt(cp.id)}
                                  className="ml-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                                  title="Remove prompt"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                            {/* Speaker name — click to rename (Feature 4) */}
                            <div className="flex items-center gap-1 mb-0.5 group/name">
                              {editingSpeaker === line.speaker ? (
                                <input
                                  autoFocus
                                  value={editingSpeakerValue}
                                  onChange={(e) => setEditingSpeakerValue(e.target.value)}
                                  onBlur={() => saveSpeakerName(line.speaker, editingSpeakerValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveSpeakerName(line.speaker, editingSpeakerValue);
                                    if (e.key === "Escape") setEditingSpeaker(null);
                                  }}
                                  className="text-xs font-semibold border-b border-indigo-400 bg-transparent focus:outline-none w-28"
                                  style={{ color }}
                                />
                              ) : (
                                <>
                                  <p className="text-xs font-semibold" style={{ color }}>{line.speaker}</p>
                                  <button
                                    onClick={() => { setEditingSpeaker(line.speaker); setEditingSpeakerValue(line.speaker); }}
                                    className="opacity-0 group-hover/name:opacity-100 transition-opacity text-slate-300 hover:text-slate-500 flex-shrink-0"
                                    title="Rename speaker"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                </>
                              )}
                            </div>
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
                    <button
                      disabled={runningAll || !workflowConfig}
                      onClick={async () => {
                        if (!meeting?.id) return;
                        setRunningAll(true);
                        try {
                          const res = await fetch("/api/workflows/run", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ meetingId: meeting.id }),
                          });
                          const data = await res.json() as { results?: Record<string, WorkflowRunResult>; error?: string };
                          if (!res.ok) { toast.error(data.error ?? "Workflow run failed"); return; }
                          // Merge new run results into meeting state
                          setMeeting((m) => m ? { ...m, workflow_runs: { ...(m.workflow_runs ?? {}), ...(data.results ?? {}) } } : m);
                          const ran = Object.keys(data.results ?? {});
                          const failed = ran.filter((k) => data.results![k].status === "error");
                          if (failed.length === 0) toast.success(`All workflows ran successfully`);
                          else toast.error(`${failed.length} workflow(s) failed: ${failed.join(", ")}`);
                        } catch { toast.error("Failed to run workflows"); }
                        finally { setRunningAll(false); }
                      }}
                      className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {runningAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      {runningAll ? "Running…" : "Run All"}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {WORKFLOW_DEFS.map((w) => {
                      const enabled = workflowConfig?.[w.key]?.enabled ?? false;
                      const runResult = meeting?.workflow_runs?.[w.key];
                      const isRunning = runningWorkflow[w.key] ?? false;

                      let lastRunLabel: React.ReactNode = null;
                      if (runResult) {
                        const ago = Math.round((Date.now() - new Date(runResult.at).getTime()) / 60_000);
                        const agoStr = ago < 1 ? "just now" : ago === 1 ? "1 min ago" : ago < 60 ? `${ago} min ago` : `${Math.round(ago / 60)}h ago`;
                        if (runResult.status === "success") {
                          lastRunLabel = <span className="text-emerald-600 text-xs">✓ Ran {agoStr}</span>;
                        } else {
                          lastRunLabel = <span className="text-red-500 text-xs" title={runResult.error}>✗ Failed {agoStr}</span>;
                        }
                      }

                      return (
                        <div key={w.key} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${enabled ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white"}`}>
                          <span className="text-xl flex-shrink-0">{w.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? "bg-emerald-400" : "bg-slate-300"}`} />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{w.desc}</p>
                            {lastRunLabel && <div className="mt-1">{lastRunLabel}</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              disabled={isRunning || !enabled}
                              onClick={async () => {
                                if (!meeting?.id) return;
                                setRunningWorkflow((s) => ({ ...s, [w.key]: true }));
                                try {
                                  const res = await fetch("/api/workflows/run", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ meetingId: meeting.id, workflows: [w.key] }),
                                  });
                                  const data = await res.json() as { results?: Record<string, WorkflowRunResult>; error?: string };
                                  if (!res.ok) { toast.error(data.error ?? "Run failed"); return; }
                                  setMeeting((m) => m ? { ...m, workflow_runs: { ...(m.workflow_runs ?? {}), ...(data.results ?? {}) } } : m);
                                  const result = data.results?.[w.key];
                                  if (result?.status === "success") toast.success(`${w.name} ran successfully`);
                                  else toast.error(`${w.name} failed: ${result?.error ?? "unknown error"}`);
                                } catch { toast.error(`Failed to run ${w.name}`); }
                                finally { setRunningWorkflow((s) => ({ ...s, [w.key]: false })); }
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              {isRunning ? "Running…" : "Run"}
                            </button>
                            <a
                              href="/dashboard/settings#workflows"
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium transition-colors"
                            >
                              Configure
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!workflowConfig && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                    </div>
                  )}
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

          {/* ── Meeting Intelligence Panel ──────────────────────── */}
          {meeting.summary && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">

              {/* Health Score */}
              {typeof meeting.summary.healthScore === "number" && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Meeting Health</p>
                  <div className="flex items-center gap-2">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                        <circle cx={20} cy={20} r={16} fill="none" stroke="#F1F5F9" strokeWidth={5} />
                        <motion.circle
                          cx={20} cy={20} r={16}
                          fill="none"
                          strokeWidth={5}
                          strokeLinecap="round"
                          stroke={meeting.summary.healthScore >= 75 ? "#10B981" : meeting.summary.healthScore >= 50 ? "#F59E0B" : "#EF4444"}
                          strokeDasharray={`${(meeting.summary.healthScore / 100) * 2 * Math.PI * 16} ${2 * Math.PI * 16}`}
                          initial={{ strokeDasharray: `0 ${2 * Math.PI * 16}` }}
                          animate={{ strokeDasharray: `${(meeting.summary.healthScore / 100) * 2 * Math.PI * 16} ${2 * Math.PI * 16}` }}
                          transition={{ duration: 0.8 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-700">{meeting.summary.healthScore}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        {meeting.summary.healthScore >= 75 ? "Great" : meeting.summary.healthScore >= 50 ? "Good" : "Needs work"}
                      </p>
                      <p className="text-[10px] text-slate-400">quality score</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sentiment */}
              {meeting.summary.sentiment && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Sentiment</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {meeting.summary.sentiment.label === "positive" ? "😊" : meeting.summary.sentiment.label === "negative" ? "😟" : "😐"}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 capitalize">{meeting.summary.sentiment.label}</p>
                      <p className="text-[10px] text-slate-400">score: {meeting.summary.sentiment.score}/100</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Topics */}
              {meeting.summary.topics && meeting.summary.topics.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {meeting.summary.topics.map((t) => (
                      <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up email draft */}
              {meeting.summary.followUpEmail && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Follow-up Draft</p>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">Subject: {meeting.summary.followUpEmail.subject}</p>
                    <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-4">{meeting.summary.followUpEmail.body}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`Subject: ${meeting.summary!.followUpEmail!.subject}\n\n${meeting.summary!.followUpEmail!.body}`);
                        toast.success("Follow-up email copied!");
                      }}
                      className="mt-2 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      Copy email →
                    </button>
                  </div>
                </div>
              )}

              {/* Next meeting agenda */}
              {meeting.summary.nextAgenda && meeting.summary.nextAgenda.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Next Meeting</p>
                  <ul className="space-y-1">
                    {meeting.summary.nextAgenda.map((item, i) => (
                      <li key={i} className="flex gap-1.5 items-start">
                        <span className="text-indigo-400 text-[10px] mt-0.5 flex-shrink-0">→</span>
                        <span className="text-[10px] text-slate-600 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
