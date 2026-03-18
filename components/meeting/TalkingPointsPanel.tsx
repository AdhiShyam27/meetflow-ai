"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb, ChevronRight, ChevronLeft, RefreshCw, Loader2, StickyNote,
} from "lucide-react";

interface TranscriptLine {
  speaker: string;
  text: string;
}

interface TalkingPointsPanelProps {
  transcript: TranscriptLine[];
  meetingTitle: string;
  isRecording: boolean;
}

export default function TalkingPointsPanel({
  transcript,
  meetingTitle,
  isRecording,
}: TalkingPointsPanelProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hasNotes, setHasNotes] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef(0);

  // Check if user has notes
  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => setHasNotes((data.notes?.length ?? 0) > 0))
      .catch(() => setHasNotes(false));
  }, []);

  const fetchTalkingPoints = useCallback(async () => {
    if (!isRecording || !transcript.length) return;

    // Take last ~15 lines of transcript
    const recent = transcript
      .slice(-15)
      .map((l) => `${l.speaker}: ${l.text}`)
      .join("\n");

    if (!recent.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/talking-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentTranscript: recent, meetingTitle }),
      });
      const data = await res.json();
      if (data.suggestions?.length) {
        setSuggestions(data.suggestions);
      }
    } catch {
      // Silently fail — talking points are non-critical
    } finally {
      setLoading(false);
      lastFetchRef.current = Date.now();
    }
  }, [isRecording, transcript, meetingTitle]);

  // Debounced auto-fetch every 20 seconds when recording
  useEffect(() => {
    if (!isRecording || !hasNotes) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastFetchRef.current;
      if (elapsed >= 18_000) {
        fetchTalkingPoints();
      }
    }, 20_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRecording, transcript.length, hasNotes, fetchTalkingPoints]);

  // Collapsed state — just show a thin icon strip
  if (collapsed) {
    return (
      <div className="w-10 border-l border-slate-200 bg-slate-50/50 flex flex-col items-center pt-4 flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
          title="Show talking points"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="mt-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-600">{suggestions.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-slate-200 bg-slate-50/30 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <h3 className="text-xs font-semibold text-slate-700 flex-1">Talking Points</h3>
        <button
          onClick={fetchTalkingPoints}
          disabled={loading || !hasNotes}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          title="Collapse"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {hasNotes === false ? (
          <div className="text-center py-8">
            <StickyNote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No notes uploaded</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload notes in{" "}
              <a href="/dashboard/notes" className="text-indigo-500 hover:underline">
                My Notes
              </a>{" "}
              to get real-time suggestions.
            </p>
          </div>
        ) : hasNotes === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">
              {loading ? "Searching your notes..." : "Listening for context..."}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Suggestions appear as the conversation progresses and matches your notes.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {suggestions.map((suggestion, i) => (
                <motion.div
                  key={`${i}-${suggestion.slice(0, 20)}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl bg-white border border-amber-100 p-3 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-xs mt-0.5 font-bold flex-shrink-0">
                      {i + 1}.
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">{suggestion}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {loading && suggestions.length > 0 && (
          <div className="flex items-center justify-center mt-3">
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <span className="text-xs text-slate-400 ml-1.5">Updating...</span>
          </div>
        )}
      </div>
    </div>
  );
}
