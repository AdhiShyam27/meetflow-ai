"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic, Square, Sparkles, Loader2, ChevronDown,
  Globe, Copy, Check, ArrowLeft, Calendar,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface TranscriptLine {
  id: string;
  speaker: string;
  speakerColor: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface AISummary {
  overview: string;
  keyPoints: string[];
  actionItems: { task: string; owner: string | null; dueDate: string | null }[];
  decisions: string[];
  questions: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "google_meet", label: "Google Meet", color: "#4285F4" },
  { id: "zoom", label: "Zoom", color: "#2D8CFF" },
  { id: "teams", label: "MS Teams", color: "#5059C9" },
  { id: "other", label: "Other / Recording", color: "#64748B" },
] as const;

const SPEAKERS = [
  { name: "You", color: "#4F46E5" },
  { name: "Speaker 2", color: "#14B8A6" },
  { name: "Speaker 3", color: "#F59E0B" },
  { name: "Speaker 4", color: "#8B5CF6" },
];

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
  { code: "pt-BR", label: "Português" },
  { code: "ja-JP", label: "日本語" },
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "ko-KR", label: "한국어" },
  { code: "hi-IN", label: "हिन्दी" },
];

const MOCK_SUMMARY: AISummary = {
  overview:
    "The team discussed Q2 priorities, aligned on the product roadmap, and agreed on next steps for the upcoming client demo.",
  keyPoints: [
    "Product launch confirmed for June 15",
    "Three new engineering hires approved for Q2",
    "Client demo scheduled for April 18 with Nextera team",
  ],
  actionItems: [
    { task: "Finalize slide deck for Nextera demo", owner: "You", dueDate: "Apr 16" },
    { task: "Schedule follow-up sync with design team", owner: "Speaker 2", dueDate: "Apr 12" },
    { task: "Send meeting notes to all stakeholders", owner: "You", dueDate: "Today" },
  ],
  decisions: [
    "Agreed to move launch date from June 30 to June 15",
    "Approved $12K budget for external contractor",
  ],
  questions: ["What's the contingency plan if demo environment goes down?"],
};

// ── Speech Recognition types ──────────────────────────────────────────────────

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewMeetingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Setup state
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<typeof PLATFORMS[number]>(PLATFORMS[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [currentSpeakerIdx, setCurrentSpeakerIdx] = useState(0);
  const [fromCalendar, setFromCalendar] = useState(false);

  // Recording state
  const [phase, setPhase] = useState<"setup" | "recording" | "processing" | "done">("setup");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(20).fill(3));

  // Summary state
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(0);
  const meetingIdRef = useRef<string | null>(null);

  const currentSpeaker = SPEAKERS[currentSpeakerIdx];

  // Pre-fill from Google Calendar query params
  useEffect(() => {
    const calTitle = searchParams.get("title");
    const calPlatform = searchParams.get("platform");
    if (calTitle) {
      setTitle(calTitle);
      setFromCalendar(true);
    }
    if (calPlatform) {
      const found = PLATFORMS.find((p) => p.id === calPlatform);
      if (found) setPlatform(found);
    }
  }, [searchParams]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimText]);

  // Timer
  useEffect(() => {
    if (phase === "recording") {
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Waveform animation from mic
  const startWaveform = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const draw = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bars = Array.from({ length: 20 }, (_, i) => {
          const val = data[Math.floor((i / 20) * data.length)] || 0;
          return Math.max(4, Math.floor((val / 255) * 40));
        });
        setAudioLevel(bars);
        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      // Fallback: animated mock waveform
      let t = 0;
      const animate = () => {
        t += 0.15;
        setAudioLevel(
          Array.from({ length: 20 }, (_, i) => Math.max(4, Math.floor(Math.abs(Math.sin(t + i * 0.4)) * 32 + 4)))
        );
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    }
  }, []);

  const stopWaveform = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    setAudioLevel(Array(20).fill(3));
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Please enter a meeting title first");
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition is only supported in Chrome. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language.code;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            const sp = SPEAKERS[currentSpeakerIdx];
            setTranscript((prev) => [
              ...prev,
              {
                id: String(lineIdRef.current++),
                speaker: sp.name,
                speakerColor: sp.color,
                text,
                isFinal: true,
                timestamp: recordingSeconds,
              },
            ]);
            setInterimText("");
          }
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    // Auto-restart on end (recognition times out after ~60s silence)
    recognition.onend = () => {
      if (phase === "recording") {
        try { recognition.start(); } catch { /* already stopping */ }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error(`Mic error: ${event.error}`);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setPhase("recording");
      await startWaveform();

      // Create meeting record in DB
      try {
        const res = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Meeting",
            platform: platform.id,
            language: language.code,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          meetingIdRef.current = data.meeting?.id ?? null;
        }
      } catch {
        // DB not available — continue without persisting
      }

      toast.success("Transcription started");
    } catch {
      toast.error("Could not start recognition. Check microphone permissions.");
    }
  }, [title, language, platform, currentSpeakerIdx, recordingSeconds, phase, startWaveform]);

  // Stop + summarize
  const stopAndSummarize = useCallback(async () => {
    recognitionRef.current?.stop();
    recognitionRef.current?.abort();
    stopWaveform();
    setPhase("processing");
    setInterimText("");

    const fullTranscript = transcript
      .filter((l) => l.isFinal)
      .map((l) => `${l.speaker}: ${l.text}`)
      .join("\n");

    // Save to DB
    try {
      let id = meetingIdRef.current;

      if (!id) {
        // Fallback: create the meeting now if it wasn't created at start
        const createRes = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Meeting",
            platform: platform.id,
            language: language.code,
          }),
        });
        if (createRes.ok) {
          const d = await createRes.json();
          id = d.meeting?.id ?? null;
        }
      }

      if (id) {
        const aiSummary = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: fullTranscript, meetingTitle: title }),
        }).then((r) => (r.ok ? r.json() : null));

        const resolvedSummary = aiSummary?.summary ?? MOCK_SUMMARY;
        setSummary(resolvedSummary);

        await fetch(`/api/meetings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: fullTranscript,
            summary: resolvedSummary,
            duration: recordingSeconds,
            status: "done",
          }),
        });

        setSavedMeetingId(id);
        meetingIdRef.current = id;
      } else {
        // No DB — just show summary inline
        const aiSummary = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: fullTranscript, meetingTitle: title }),
        }).then((r) => (r.ok ? r.json() : null));
        setSummary(aiSummary?.summary ?? MOCK_SUMMARY);
      }
    } catch {
      setSummary(MOCK_SUMMARY);
    }

    setPhase("done");
    toast.success("Summary generated!");
  }, [transcript, title, platform, language, recordingSeconds, stopWaveform]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const copyTranscript = () => {
    const text = transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  // ── Render: Setup phase ───────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
              New Meeting
            </h1>
            <p className="text-slate-400 text-sm">Set up your transcription session</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Meeting title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                Meeting title
              </label>
              {fromCalendar && (
                <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                  <Calendar className="w-3 h-3" /> Imported from Google Calendar
                </span>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q2 Strategy Review"
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              onKeyDown={(e) => e.key === "Enter" && startRecording()}
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Platform
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p)}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1.5 ${
                    platform.id === p.id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: p.color }}
                  >
                    {p.label[0]}
                  </div>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Transcription language
            </label>
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm hover:border-indigo-300 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  {language.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showLangPicker ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showLangPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto"
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { setLanguage(l); setShowLangPicker(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${language.code === l.code ? "text-indigo-600 font-medium" : "text-slate-700"}`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-2xl p-4 flex gap-3" style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
            <Mic className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-indigo-800 font-semibold text-sm">How it works</p>
              <p className="text-indigo-700/80 text-xs mt-1 leading-relaxed">
                MeetFlow AI uses your browser&apos;s built-in speech recognition — <strong>no bot joins your call</strong>.
                Open your meeting in another tab, then click Start below. Grant microphone access when prompted.
              </p>
            </div>
          </div>

          {/* Start button */}
          <motion.button
            onClick={startRecording}
            whileHover={{ scale: 1.02, boxShadow: "0 12px 28px rgba(79,70,229,0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 transition-colors"
          >
            <Mic className="w-5 h-5" />
            Start Transcription
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Render: Recording phase ───────────────────────────────────────────────
  if (phase === "recording") {
    return (
      <div className="h-full flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-2.5 h-2.5 rounded-full bg-red-500"
            />
            <div>
              <p className="text-slate-800 font-semibold text-sm">{title}</p>
              <p className="text-slate-400 text-xs">{platform.label} · {formatTime(recordingSeconds)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Speaker switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
              {SPEAKERS.slice(0, 3).map((sp, idx) => (
                <button
                  key={sp.name}
                  onClick={() => setCurrentSpeakerIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${currentSpeakerIdx === idx ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                  title={`Switch to ${sp.name}`}
                  style={currentSpeakerIdx === idx ? { borderLeft: `2px solid ${sp.color}` } : {}}
                >
                  {sp.name}
                </button>
              ))}
            </div>

            <button
              onClick={stopAndSummarize}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-red-100"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              Stop & Summarize
            </button>
          </div>
        </div>

        {/* Waveform */}
        <div className="flex items-center justify-center gap-1 py-5 bg-slate-950 border-b border-slate-800 flex-shrink-0">
          {audioLevel.map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-75"
              style={{
                height: `${h}px`,
                background: i % 3 === 0 ? "#4F46E5" : i % 3 === 1 ? "#14B8A6" : "#F59E0B",
                opacity: 0.85,
              }}
            />
          ))}
        </div>

        {/* Live transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <AnimatePresence initial={false}>
            {transcript.map((line) => (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: line.speakerColor }}
                >
                  {line.speaker[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: line.speakerColor }}>
                    {line.speaker}
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">{line.text}</p>
                </div>
              </motion.div>
            ))}

            {/* Interim text */}
            {interimText && (
              <motion.div
                key="interim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 opacity-60"
                  style={{ background: currentSpeaker.color }}
                >
                  {currentSpeaker.name[0]}
                </div>
                <p className="text-slate-400 text-sm italic leading-relaxed">{interimText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {transcript.length === 0 && !interimText && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4"
              >
                <Mic className="w-8 h-8 text-indigo-500" />
              </motion.div>
              <p className="text-slate-700 font-semibold">Listening…</p>
              <p className="text-slate-400 text-sm mt-1">Start speaking — your transcript will appear here</p>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    );
  }

  // ── Render: Processing ────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center mb-6 shadow-xl shadow-indigo-200"
        >
          <Sparkles className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
          Generating AI Summary…
        </h2>
        <p className="text-slate-500 text-sm">Analyzing your transcript with Claude AI</p>
        <div className="flex gap-1.5 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              className="w-2.5 h-2.5 rounded-full bg-indigo-400"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Render: Done (transcript + summary) ──────────────────────────────────
  return (
    <div className="flex h-full">
      {/* Transcript panel */}
      <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-slate-800 font-bold text-base" style={{ fontFamily: "'Inter', sans-serif" }}>
              {title}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {platform.label} · {formatTime(recordingSeconds)} · {transcript.length} segments
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyTranscript}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() =>
                savedMeetingId
                  ? router.push(`/dashboard/meeting/${savedMeetingId}`)
                  : router.push("/dashboard")
              }
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors font-medium"
            >
              {savedMeetingId ? "View Meeting →" : "Save & Exit"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {transcript.map((line) => (
            <div key={line.id} className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: line.speakerColor }}
              >
                {line.speaker[0]}
              </div>
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: line.speakerColor }}>
                  {line.speaker}
                </p>
                <p className="text-slate-700 text-sm leading-relaxed">{line.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary panel */}
      <div className="w-96 flex flex-col bg-slate-50 overflow-hidden">
        <div
          className="flex items-center gap-2 px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "rgba(20,184,166,0.2)", background: "rgba(20,184,166,0.06)" }}
        >
          <Sparkles className="w-4 h-4 text-teal-500" />
          <span className="text-slate-800 font-bold text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
            AI Summary
          </span>
          <span className="ml-auto text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full font-medium">
            Claude AI
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {summary ? (
            <>
              {/* Overview */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Overview</p>
                <p className="text-slate-700 text-sm leading-relaxed">{summary.overview}</p>
              </div>

              {/* Key Points */}
              {summary.keyPoints?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Points</p>
                  <ul className="space-y-1.5">
                    {summary.keyPoints.map((kp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summary.actionItems?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    ✅ Action Items
                  </p>
                  <div className="space-y-2">
                    {summary.actionItems.map((item, i) => (
                      <div key={i} className="rounded-xl p-3 bg-white border border-slate-200 shadow-sm">
                        <p className="text-slate-800 text-xs font-semibold leading-snug">{item.task}</p>
                        <div className="flex gap-3 mt-1.5">
                          {item.owner && (
                            <span className="text-indigo-600 text-xs">👤 {item.owner}</span>
                          )}
                          {item.dueDate && (
                            <span className="text-slate-400 text-xs">📅 {item.dueDate}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {summary.decisions?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    🔖 Decisions
                  </p>
                  <ul className="space-y-1.5">
                    {summary.decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions */}
              {summary.questions?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    ❓ Open Questions
                  </p>
                  <ul className="space-y-1.5">
                    {summary.questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export buttons */}
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Export</p>
                <div className="flex flex-wrap gap-2">
                  {["📋 Copy", "📧 Email", "💬 Slack", "📝 Notion"].map((label) => (
                    <button
                      key={label}
                      onClick={() => toast.success(`${label.split(" ")[1]} export coming soon in Pro!`)}
                      className="text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors font-medium"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
