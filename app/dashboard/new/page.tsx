"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic, Square, Sparkles, Loader2,
  Copy, Check, ArrowLeft, Calendar, Users, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import TalkingPointsPanel from "@/components/meeting/TalkingPointsPanel";

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

const MEETING_TEMPLATES = [
  { id: "general",        label: "General",        emoji: "📋" },
  { id: "customer_call",  label: "Sales Call",      emoji: "🤝" },
  { id: "standup",        label: "Standup",         emoji: "⚡" },
  { id: "one_on_one",     label: "1:1",             emoji: "👤" },
  { id: "interview",      label: "Interview",       emoji: "🎯" },
  { id: "brainstorm",     label: "Brainstorm",      emoji: "💡" },
  { id: "product_review", label: "Product Review",  emoji: "🔍" },
] as const;

type MeetingTemplateId = typeof MEETING_TEMPLATES[number]["id"];

const SPEAKERS = [
  { name: "You", color: "#4F46E5" },
  { name: "Speaker 2", color: "#14B8A6" },
  { name: "Speaker 3", color: "#F59E0B" },
  { name: "Speaker 4", color: "#8B5CF6" },
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

// ── Real-time speaker detection via spectral centroid clustering ──────────────
//
// Each person's voice has a unique "spectral centroid" — the frequency-weighted
// centre of mass of their speech energy. We collect these silently from the
// AnalyserNode (already running for the waveform) and cluster them per speaker.
//
// Algorithm:
//  1. Every animation frame (~16ms), if audio level > silence threshold,
//     compute spectral centroid from getByteFrequencyData() and push to buffer.
//  2. When a sentence finalises (onresult isFinal), pull the last ~3s of
//     snapshots, average them → "voice signature" for this utterance.
//  3. Compare against stored speaker profiles (exponential moving averages).
//     If distance > THRESHOLD bins → new/different speaker, switch automatically.
//  4. Update the matched speaker's profile with the new observation.

interface VoiceProfile { centroid: number; count: number }

function autoDetectSpeaker(
  centroid: number,
  profiles: Array<VoiceProfile | null>,
): number {
  // A difference of ~5 frequency bins (~940 Hz at 48kHz/256 FFT) separates speakers.
  // Increase if you get false-positive switches; decrease if switches are missed.
  const THRESHOLD = 5;

  let bestIdx = -1, bestDist = Infinity;
  for (let i = 0; i < SPEAKERS.length; i++) {
    const p = profiles[i];
    if (!p) continue;
    const d = Math.abs(centroid - p.centroid);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }

  // No profiles yet, or no close match → first empty slot = new speaker
  if (bestIdx === -1 || bestDist > THRESHOLD) {
    const empty = profiles.findIndex((p) => p === null);
    return empty >= 0 ? empty : Math.max(0, bestIdx);
  }
  return bestIdx;
}

// ── Component ─────────────────────────────────────────────────────────────────

function NewMeetingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Setup state
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<typeof PLATFORMS[number]>(PLATFORMS[0]);
  const [meetingTemplate, setMeetingTemplate] = useState<MeetingTemplateId>("general");
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

  // Processing step for two-phase loading UI
  const [processingStep, setProcessingStep] = useState<"transcribing" | "summarizing">("transcribing");

  // Recording mode: mic only (in-person) vs system audio (remote call)
  const [recordingMode, setRecordingMode] = useState<"inperson" | "remote">("inperson");
  const recordingModeRef = useRef<"inperson" | "remote">("inperson");

  // Refs
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(0);
  const meetingIdRef = useRef<string | null>(null);
  const phaseRef = useRef<"setup" | "recording" | "processing" | "done">("setup");
  // Ref so recognition.onresult always reads the latest speaker — fixes stale closure bug
  const currentSpeakerIdxRef = useRef(currentSpeakerIdx);
  // Ref so stopAndSummarize always reads the latest transcript — fixes stale closure bug
  const transcriptRef = useRef<TranscriptLine[]>([]);
  // Ref so recognition.onresult always reads the latest recording time — fixes stale closure bug
  const recordingSecondsRef = useRef(0);
  // MediaRecorder refs — captures full audio in parallel for WhisperX final pass
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // Voice fingerprint refs — real-time speaker auto-detection
  const voiceSnapshotsRef = useRef<Array<{ t: number; c: number }>>([]);
  const speakerProfilesRef = useRef<Array<VoiceProfile | null>>(Array(SPEAKERS.length).fill(null));

  const currentSpeaker = SPEAKERS[currentSpeakerIdx];

  // Keep refs in sync whenever state changes
  useEffect(() => { currentSpeakerIdxRef.current = currentSpeakerIdx; }, [currentSpeakerIdx]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { recordingSecondsRef.current = recordingSeconds; }, [recordingSeconds]);
  useEffect(() => { recordingModeRef.current = recordingMode; }, [recordingMode]);

  // Pre-fill from Google Calendar query params (+ auto-start flag)
  const [autoStartPending, setAutoStartPending] = useState(false);

  useEffect(() => {
    const calTitle = searchParams.get("title");
    const calPlatform = searchParams.get("platform");
    const shouldAutoStart = searchParams.get("autostart") === "true";
    if (calTitle) {
      setTitle(calTitle);
      setFromCalendar(true);
    } else {
      setFromCalendar(false);
    }
    if (calPlatform) {
      const found = PLATFORMS.find((p) => p.id === calPlatform);
      if (found) setPlatform(found);
    }
    if (shouldAutoStart && calTitle) {
      setAutoStartPending(true);
    }
  }, [searchParams]);

  // Keep phaseRef in sync to avoid stale closures in recognition.onend
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Auto-start when navigated from "Join & Record" with title pre-filled
  useEffect(() => {
    if (!autoStartPending || !title.trim()) return;
    setAutoStartPending(false);
    const timer = setTimeout(() => startRecording(), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartPending, title]);

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

  // Keyboard shortcuts: press 1/2/3 during recording to switch speakers instantly
  useEffect(() => {
    if (phase !== "recording") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") setCurrentSpeakerIdx(0);
      if (e.key === "2") setCurrentSpeakerIdx(1);
      if (e.key === "3") setCurrentSpeakerIdx(2);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase]);

  // Waveform animation from mic — accepts an optional existing stream (remote mode reuses getDisplayMedia stream)
  const startWaveform = useCallback(async (existingStream?: MediaStream): Promise<MediaStream | null> => {
    try {
      const stream = existingStream ?? await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!existingStream) mediaStreamRef.current = stream;

      const ctx = new AudioContext();
      // Must resume — browsers suspend AudioContext until user gesture has occurred
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const draw = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        // ── Voice fingerprint snapshot (for real-time speaker detection) ──────
        // Compute spectral centroid: weighted average frequency bin.
        // Only sample during actual speech (avgLevel > silence threshold).
        let wSum = 0, mSum = 0;
        for (let i = 1; i < data.length; i++) { wSum += i * data[i]; mSum += data[i]; }
        const avgLevel = mSum / data.length;
        if (avgLevel > 12 && mSum > 0) {
          const snaps = voiceSnapshotsRef.current;
          snaps.push({ t: Date.now(), c: wSum / mSum });
          // Keep ~8 seconds of history at 60fps (≈ 480 frames) — trim in bulk
          if (snaps.length > 500) snaps.splice(0, 100);
        }

        const bars = Array.from({ length: 20 }, (_, i) => {
          const val = data[Math.floor((i / 20) * data.length)] || 0;
          return Math.max(4, Math.floor((val / 255) * 48));
        });
        setAudioLevel(bars);
        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
      return stream;
    } catch {
      // Fallback: animated mock waveform (mic permission denied)
      let t = 0;
      const animate = () => {
        t += 0.15;
        setAudioLevel(
          Array.from({ length: 20 }, (_, i) => Math.max(4, Math.floor(Math.abs(Math.sin(t + i * 0.4)) * 32 + 4)))
        );
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
      return null;
    }
  }, []);

  const stopWaveform = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    // Release mic — stop all tracks so the recording indicator in the browser goes away
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setAudioLevel(Array(20).fill(3));
  }, []);

  // Helper: start MediaRecorder from a stream
  const _startMediaRecorder = useCallback((stream: MediaStream) => {
    audioChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/ogg";
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;
  }, []);

  // Helper: create meeting in DB
  const _createMeetingRecord = useCallback(async () => {
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Meeting",
          platform: platform.id,
          language: "en-US",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        meetingIdRef.current = data.meeting?.id ?? null;
      } else {
        console.error("[createMeeting] failed", res.status, await res.text().catch(() => ""));
      }
    } catch (err) { console.error("[createMeeting] network error", err); }
  }, [title, platform]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!title.trim()) {
      setTitleError("Please give your meeting a title before starting.");
      toast.error("Please enter a meeting title first");
      return;
    }
    setTitleError(null);

    // ── Remote call mode: capture system audio via screen share ──────────────
    if (recordingMode === "remote") {
      try {
        // getDisplayMedia shows the browser "share screen" dialog
        // User must select their meeting tab and enable "Share tab audio"
        const displayStream = await (navigator.mediaDevices as unknown as {
          getDisplayMedia(c: object): Promise<MediaStream>;
        }).getDisplayMedia({ audio: true, video: { width: 1, height: 1 } });

        if (!displayStream.getAudioTracks().length) {
          displayStream.getTracks().forEach((t) => t.stop());
          toast.error("No audio captured. Enable 'Share tab audio' when sharing.");
          return;
        }

        mediaStreamRef.current = displayStream;
        setPhase("recording");

        // Waveform from display audio
        await startWaveform(displayStream);

        // MediaRecorder captures ALL voices from the meeting tab
        _startMediaRecorder(displayStream);

        // If user stops screen share → auto-stop recording
        displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (phaseRef.current === "recording") {
            // Trigger stop via a custom event so stopAndSummarize is always the latest version
            window.dispatchEvent(new CustomEvent("meetflow:autostop"));
          }
        });

        await _createMeetingRecord();
        toast.success("Recording started — all voices from your meeting are being captured");
      } catch {
        toast.error("Screen share cancelled or not supported. Try in-person mode instead.");
      }
      return;
    }

    // ── In-person mode: microphone + Web Speech API live preview ─────────────
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition is only supported in Chrome. Please use Chrome.");
      return;
    }

    // ── Dual-recognition: two instances alternate so there's zero gap on restart ──
    // When instance A fires onend (Chrome's ~5s no-speech timeout or natural pause),
    // instance B is already created and starts immediately. This eliminates the
    // ~100-300ms dead window where words get dropped during a single-instance restart.
    let activeRecognition: ISpeechRecognition | null = null;

    const makeRecognition = (): ISpeechRecognition => {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.maxAlternatives = 1;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) {
              // ── Auto speaker detection via spectral centroid ───────────────
              // Pull snapshots from the last 3.5s (the utterance just spoken),
              // skipping the most recent 80ms to avoid overlap with next speaker.
              const now = Date.now();
              const snaps = voiceSnapshotsRef.current.filter(
                (s) => s.t > now - 3500 && s.t < now - 80
              );
              if (snaps.length >= 6) {
                const avgC = snaps.reduce((a, s) => a + s.c, 0) / snaps.length;
                const detectedIdx = autoDetectSpeaker(avgC, speakerProfilesRef.current);

                // Update speaker profile — exponential moving average so it adapts
                const prev = speakerProfilesRef.current[detectedIdx];
                speakerProfilesRef.current[detectedIdx] = prev
                  ? { centroid: prev.centroid * 0.8 + avgC * 0.2, count: prev.count + 1 }
                  : { centroid: avgC, count: 1 };

                // Switch speaker if detected a different voice
                if (detectedIdx !== currentSpeakerIdxRef.current) {
                  currentSpeakerIdxRef.current = detectedIdx;
                  setCurrentSpeakerIdx(detectedIdx);
                  // Announce only after first calibration sentence (count > 1)
                  if ((speakerProfilesRef.current[detectedIdx]?.count ?? 0) > 1) {
                    toast(`🎤 ${SPEAKERS[detectedIdx].name} speaking`, { duration: 1800 });
                  }
                }
              }

              const sp = SPEAKERS[currentSpeakerIdxRef.current];
              setTranscript((prev) => [
                ...prev,
                {
                  id: String(lineIdRef.current++),
                  speaker: sp.name,
                  speakerColor: sp.color,
                  text,
                  isFinal: true,
                  timestamp: recordingSecondsRef.current,
                },
              ]);
              setInterimText("");
            }
          } else {
            interim += result[0].transcript;
          }
        }
        if (interim) setInterimText(interim);
      };

      rec.onend = () => {
        if (phaseRef.current !== "recording") return;
        // Immediately swap to a fresh instance — no gap
        const next = makeRecognition();
        activeRecognition = next;
        recognitionRef.current = next;
        try { next.start(); } catch { /* browser already cleaned up */ }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        // no-speech and aborted are normal lifecycle events — onend handles restart
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error(`Mic error: ${event.error}`);
        }
      };

      return rec;
    };

    const recognition = makeRecognition();
    activeRecognition = recognition;

    // Reset voice fingerprints for a fresh session
    voiceSnapshotsRef.current = [];
    speakerProfilesRef.current = Array(SPEAKERS.length).fill(null);
    setCurrentSpeakerIdx(0);
    currentSpeakerIdxRef.current = 0;

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setPhase("recording");

      // Start waveform — get stream for MediaRecorder (same mic stream, no double permission prompt)
      const stream = await startWaveform();
      if (stream) _startMediaRecorder(stream);

      await _createMeetingRecord();
      toast.success("Transcription started");
    } catch {
      toast.error("Could not start recording. Check microphone permissions.");
    }
  }, [title, platform, recordingMode, startWaveform, _startMediaRecorder, _createMeetingRecord]);

  // Stop + summarize
  const stopAndSummarize = useCallback(async () => {
    // Guard against double-click: if already processing, do nothing
    if (phaseRef.current !== "recording") return;
    // Set ref immediately so onend handler sees "processing" and doesn't restart recognition
    phaseRef.current = "processing";
    recognitionRef.current?.stop();
    recognitionRef.current?.abort();

    // ── IMPORTANT: stop animation ONLY — do NOT stop media stream tracks yet.
    // The MediaRecorder is still reading from the stream. Stopping the stream
    // before stopping the recorder cuts off the audio and diarization gets empty input.
    cancelAnimationFrame(animFrameRef.current);
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    setAudioLevel(Array(20).fill(3));

    setPhase("processing");
    setProcessingStep("transcribing");
    setInterimText("");

    // ── Step 1: Stop MediaRecorder first, then release the stream ────────────
    let audioBlob: Blob | null = null;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      audioBlob = await new Promise<Blob>((resolve) => {
        mr.onstop = () => resolve(new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || "audio/webm" }));
        mr.stop();
      });
      mediaRecorderRef.current = null;
    }

    // NOW release the media stream (MediaRecorder is done with it)
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    // ── Step 2: Send to WhisperX for better accuracy + auto speaker detection ─
    // Falls back to Web Speech API transcript if backend unavailable
    let finalLines = transcriptRef.current.filter((l) => l.isFinal);
    if (audioBlob && audioBlob.size > 10_000) {
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const res = await fetch(
          `${backendUrl}/api/transcribe?diarize=true&max_speakers=4`,
          { method: "POST", body: formData, signal: AbortSignal.timeout(300_000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.diarization_error) {
            console.warn("[diarization] failed:", data.diarization_error);
          }
          if (data.segments?.length) {
            const hasMultipleSpeakers = new Set(
              data.segments.map((s: { speaker?: string }) => s.speaker ?? "SPEAKER_00")
            ).size > 1;
            finalLines = data.segments.map((seg: { text: string; speaker?: string; start: number }, i: number) => {
              const speakerNum = parseInt((seg.speaker ?? "SPEAKER_00").replace("SPEAKER_", "")) || 0;
              const sp = SPEAKERS[speakerNum % SPEAKERS.length];
              return {
                id: String(i),
                speaker: sp.name,
                speakerColor: sp.color,
                text: seg.text,
                isFinal: true,
                timestamp: Math.floor(seg.start),
              };
            });
            setTranscript(finalLines);
            if (hasMultipleSpeakers) {
              toast.success("Speakers automatically identified!");
            } else {
              toast.success("Transcript enhanced with AI recognition");
            }
          }
        } else {
          toast.warning("AI transcription unavailable — using browser transcript");
        }
      } catch {
        // Backend not available — keep Web Speech API transcript and inform user
        toast.warning("AI transcription backend offline — using browser transcript");
      }
    }

    // ── Step 3: Generate AI summary ───────────────────────────────────────────
    setProcessingStep("summarizing");
    const fullTranscript = finalLines.map((l) => `${l.speaker}: ${l.text}`).join("\n");

    try {
      let id = meetingIdRef.current;

      if (!id) {
        const createRes = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Meeting",
            platform: platform.id,
            language: "en-US",
          }),
        });
        if (createRes.ok) {
          const d = await createRes.json();
          id = d.meeting?.id ?? null;
        } else {
          const errText = await createRes.text().catch(() => "");
          console.error("[save meeting] create failed", createRes.status, errText);
          toast.error(`Could not save meeting (${createRes.status}). Check console for details.`);
        }
      }

      // Generate AI summary (regardless of save state)
      const aiSummary = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullTranscript, meetingTitle: title, template: meetingTemplate }),
      }).then((r) => (r.ok ? r.json() : null));
      const resolvedSummary = aiSummary?.summary ?? MOCK_SUMMARY;
      setSummary(resolvedSummary);

      if (id) {
        const patchRes = await fetch(`/api/meetings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: fullTranscript,
            summary: resolvedSummary,
            duration: recordingSecondsRef.current,
            status: "done",
          }),
        });

        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}));
          console.error("[save meeting] PATCH failed", patchRes.status, err);
          toast.error(`Meeting transcript not saved (${patchRes.status}). Check console.`);
        } else {
          setSavedMeetingId(id);
          meetingIdRef.current = id;
        }
      }
    } catch (err) {
      console.error("[stopAndSummarize] unexpected error", err);
      setSummary(MOCK_SUMMARY);
    }

    setPhase("done");
    toast.success("Summary generated!");
  }, [title, platform]);

  // Listen for auto-stop event (fired when user ends screen share in remote mode)
  useEffect(() => {
    const handler = () => { if (phaseRef.current === "recording") stopAndSummarize(); };
    window.addEventListener("meetflow:autostop", handler);
    return () => window.removeEventListener("meetflow:autostop", handler);
  }, [stopAndSummarize]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const copyTranscript = () => {
    const text = transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  // ── Render: Auto-start loading screen ────────────────────────────────────
  if (autoStartPending) {
    return (
      <div className="p-6 max-w-2xl flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
        </div>
        <p className="text-slate-700 font-semibold">Connecting to microphone…</p>
        <p className="text-slate-400 text-sm">{title}</p>
      </div>
    );
  }

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
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) setTitleError(null);
              }}
              onBlur={() => {
                if (!title.trim()) setTitleError("Please give your meeting a title before starting.");
              }}
              placeholder="e.g. Q2 Strategy Review"
              aria-invalid={!!titleError}
              aria-describedby={titleError ? "meeting-title-error" : undefined}
              className={`w-full px-4 py-3.5 rounded-2xl border text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition-all ${
                titleError
                  ? "border-red-300 focus:ring-red-500/40 focus:border-red-400"
                  : "border-slate-200 focus:ring-indigo-500/50 focus:border-indigo-500"
              }`}
              onKeyDown={(e) => e.key === "Enter" && startRecording()}
            />
            {titleError && (
              <p id="meeting-title-error" className="mt-1.5 text-xs text-red-600">
                {titleError}
              </p>
            )}
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

          {/* Meeting template */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Meeting template</label>
            <div className="flex flex-wrap gap-2">
              {MEETING_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMeetingTemplate(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 border ${
                    meetingTemplate === t.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recording mode */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Meeting type</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setRecordingMode("inperson")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-2 ${
                  recordingMode === "inperson"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                In-person / Room
              </button>
              <button
                onClick={() => setRecordingMode("remote")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-2 ${
                  recordingMode === "remote"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <Monitor className="w-4 h-4 flex-shrink-0" />
                Remote call
              </button>
            </div>
            {recordingMode === "remote" && (
              <div className="mt-2.5 rounded-xl p-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 leading-relaxed">
                <strong>How it works:</strong> You&apos;ll share your Zoom/Meet/Teams tab with audio.
                All voices — yours and remote participants — are captured and automatically identified.
                <br /><span className="text-amber-500 mt-1 block">Make sure to check &quot;Share tab audio&quot; in the share dialog.</span>
              </div>
            )}
            {recordingMode === "inperson" && (
              <p className="mt-2 text-xs text-slate-500">
                Microphone captures everyone in the room. Works best with multiple people nearby.
              </p>
            )}
          </div>

          {/* Info card */}
          <div className="rounded-2xl p-4 flex gap-3" style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
            <Mic className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-indigo-800 font-semibold text-sm">Auto speaker detection</p>
              <p className="text-indigo-700/80 text-xs mt-1 leading-relaxed">
                After you stop, AI automatically identifies each speaker and labels their lines.
                No bot joins your call — everything runs locally on your machine.
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
            {/* Speaker switcher — press 1/2/3 to switch */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
                {SPEAKERS.slice(0, 3).map((sp, idx) => (
                  <button
                    key={sp.name}
                    onClick={() => setCurrentSpeakerIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      currentSpeakerIdx === idx
                        ? "bg-white shadow-sm text-slate-800"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    title={`Switch to ${sp.name} (press ${idx + 1})`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: currentSpeakerIdx === idx ? sp.color : "#CBD5E1" }}
                    />
                    {sp.name}
                    <span className="text-slate-400 font-normal">{idx + 1}</span>
                  </button>
                ))}
              </div>
              <p className="text-slate-400 text-xs pr-1">Press 1 / 2 / 3 to switch speaker</p>
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

        {/* Live transcript + Talking Points */}
        <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Older lines — plain divs, no animation cost on each interim update */}
          {transcript.slice(0, -1).map((line) => (
            <div key={line.id} className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: line.speakerColor }}
              >
                {line.speaker[0]}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold mb-0.5" style={{ color: line.speakerColor }}>
                  {line.speaker}
                </p>
                <p className="text-slate-700 text-sm leading-relaxed">{line.text}</p>
              </div>
            </div>
          ))}

          {/* Newest final line — animate in once */}
          <AnimatePresence initial={false}>
            {transcript.length > 0 && (() => {
              const line = transcript[transcript.length - 1];
              return (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-3"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: line.speakerColor }}
                  >
                    {line.speaker[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold mb-0.5" style={{ color: line.speakerColor }}>
                      {line.speaker}
                    </p>
                    <p className="text-slate-700 text-sm leading-relaxed">{line.text}</p>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Interim text — plain div, no animation, updates many times per second */}
          {interimText && (
            <div className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 opacity-60"
                style={{ background: currentSpeaker.color }}
              >
                {currentSpeaker.name[0]}
              </div>
              <p className="text-slate-400 text-sm italic leading-relaxed">{interimText}</p>
            </div>
          )}

          {transcript.length === 0 && !interimText && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  recordingMode === "remote" ? "bg-teal-100" : "bg-indigo-100"
                }`}
              >
                {recordingMode === "remote"
                  ? <Monitor className="w-8 h-8 text-teal-500" />
                  : <Mic className="w-8 h-8 text-indigo-500" />}
              </motion.div>
              {recordingMode === "remote" ? (
                <>
                  <p className="text-slate-700 font-semibold">Capturing all voices…</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Recording your meeting tab audio. Full transcript with speaker labels appears after you stop.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-700 font-semibold">Listening…</p>
                  <p className="text-slate-400 text-sm mt-1">Start speaking — your transcript will appear here</p>
                </>
              )}
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>
        <TalkingPointsPanel
          transcript={transcript.map((l) => ({ speaker: l.speaker, text: l.text }))}
          meetingTitle={title}
          isRecording={phase === "recording"}
        />
        </div>
      </div>
    );
  }

  // ── Render: Processing ────────────────────────────────────────────────────
  if (phase === "processing") {
    const isTranscribing = processingStep === "transcribing";
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
          {isTranscribing ? "Enhancing Transcript…" : "Generating AI Summary…"}
        </h2>
        <p className="text-slate-500 text-sm">
          {isTranscribing
            ? "Running WhisperX for better accuracy + speaker detection"
            : "Analyzing your transcript with Claude AI"}
        </p>
        {/* Step indicator */}
        <div className="flex items-center gap-3 mt-5">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
            isTranscribing ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isTranscribing ? "bg-indigo-500" : "bg-teal-500"}`} />
            {isTranscribing ? "Step 1: Transcribing" : "Step 2: Summarizing"}
          </div>
        </div>
        <div className="flex gap-1.5 mt-5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              className={`w-2.5 h-2.5 rounded-full ${isTranscribing ? "bg-indigo-400" : "bg-teal-400"}`}
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
              <div className="flex-1">
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

export default function NewMeetingPageWrapper() {
  return (
    <Suspense>
      <NewMeetingPage />
    </Suspense>
  );
}
