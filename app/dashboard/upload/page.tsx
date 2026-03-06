"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, File, X, CheckCircle2, Loader2,
  ArrowLeft, Mic2, Users, Zap, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { transcribeFile, checkBackendHealth, estimateTranscriptionTime } from "@/lib/transcription-api";
import { segmentsToPlainText } from "@/types/transcription";
import type { TranscriptionResult } from "@/types/transcription";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED = ".mp3,.wav,.m4a,.webm,.ogg,.mp4,.flac,.aac";
const MAX_MB = 500;

type Step = "upload" | "converting" | "transcribing" | "identifying" | "saving" | "done";

const STEP_LABELS: Record<Step, string> = {
  upload: "Waiting for file",
  converting: "Converting audio to 16kHz WAV…",
  transcribing: "Transcribing with Whisper AI…",
  identifying: "Identifying speakers…",
  saving: "Saving to your meetings…",
  done: "Done!",
};

const STEP_ORDER: Step[] = ["upload", "converting", "transcribing", "identifying", "saving", "done"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Options
  const [diarize, setDiarize] = useState(true);
  const [maxSpeakers, setMaxSpeakers] = useState<number | undefined>(undefined);

  // Check if backend is reachable when page mounts
  useState(() => {
    checkBackendHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  });

  // ── File handling ─────────────────────────────────────────────────────────

  const acceptFile = useCallback((f: File) => {
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`File too large (max ${MAX_MB} MB)`);
      return;
    }
    setFile(f);
    setError(null);
    setStep("upload");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) acceptFile(f);
    },
    [acceptFile],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  // ── Transcription ─────────────────────────────────────────────────────────

  const startTranscription = async () => {
    if (!file) return;
    setError(null);

    // Step 1 — converting (happens server-side but we show it optimistically)
    setStep("converting");
    await new Promise((r) => setTimeout(r, 400));

    try {
      // Step 2 — transcription
      setStep("transcribing");
      const transcription = await transcribeFile(file, {
        diarize,
        maxSpeakers,
        onProgress: (msg) => {
          if (msg.toLowerCase().includes("speaker")) setStep("identifying");
        },
      });

      if (diarize && transcription.speakers.length > 0) setStep("identifying");

      setResult(transcription);

      // Step 3 — save to MeetFlow meetings DB
      setStep("saving");
      const plainText = segmentsToPlainText(transcription.segments);
      const title = file.name.replace(/\.[^.]+$/, "");

      // Create meeting
      const createRes = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, platform: "other" }),
      });

      if (createRes.ok) {
        const { meeting } = await createRes.json();

        // Summarize
        const summaryData = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: plainText, meetingTitle: title }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        // Save transcript + summary
        await fetch(`/api/meetings/${meeting.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: plainText,
            summary: summaryData?.summary ?? null,
            duration: Math.round(transcription.duration),
            status: "done",
          }),
        });

        setSavedId(meeting.id);
      }

      setStep("done");
      toast.success("Transcription complete!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      setError(msg);
      setStep("upload");
      toast.error(msg);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const currentStepIdx = STEP_ORDER.indexOf(step);
  const isProcessing = step !== "upload" && step !== "done";

  return (
    <div className="p-6 max-w-2xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Upload & Transcribe
          </h1>
          <p className="text-slate-400 text-sm">Upload a recorded meeting — AI identifies speakers automatically</p>
        </div>
      </div>

      {/* Backend offline warning */}
      {backendOnline === false && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl p-4 flex items-start gap-3 bg-amber-50 border border-amber-200"
        >
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-semibold text-sm">Python backend not running</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Start it with: <code className="bg-amber-100 px-1 rounded">cd backend && ./start.sh</code>
            </p>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !isProcessing && inputRef.current?.click()}
          className={`
            relative rounded-2xl border-2 border-dashed transition-all cursor-pointer
            flex flex-col items-center justify-center gap-3 py-12
            ${dragging ? "border-indigo-400 bg-indigo-50" : file ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}
            ${isProcessing ? "pointer-events-none opacity-80" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={onInputChange}
          />

          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <File className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-slate-800 font-semibold text-sm">{file.name}</p>
                <p className="text-slate-400 text-xs">{(file.size / 1e6).toFixed(1)} MB</p>
                {!isProcessing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setStep("upload"); }}
                    className="mt-1 text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-700 font-semibold text-sm">Drop your audio file here</p>
                <p className="text-slate-400 text-xs">MP3, WAV, M4A, MP4, WebM, OGG, FLAC — up to {MAX_MB} MB</p>
                <span className="mt-1 text-xs text-indigo-600 font-medium underline underline-offset-2">
                  or click to browse
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Options */}
        {!isProcessing && step !== "done" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Options</p>

            {/* Diarize toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Speaker identification</p>
                  <p className="text-xs text-slate-400">Label who is speaking using pyannote AI</p>
                </div>
              </div>
              <button
                onClick={() => setDiarize((d) => !d)}
                className={`relative w-11 h-6 rounded-full transition-colors ${diarize ? "bg-indigo-500" : "bg-slate-200"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${diarize ? "translate-x-5" : ""}`}
                />
              </button>
            </div>

            {/* Max speakers */}
            {diarize && (
              <div className="flex items-center gap-3 pl-6">
                <p className="text-xs text-slate-500 flex-1">Max speakers (optional)</p>
                <div className="flex items-center gap-1.5">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxSpeakers(maxSpeakers === n ? undefined : n)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        maxSpeakers === n
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  {maxSpeakers && (
                    <button
                      onClick={() => setMaxSpeakers(undefined)}
                      className="text-xs text-slate-400 hover:text-slate-600 ml-1"
                    >
                      clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress steps */}
        <AnimatePresence>
          {(isProcessing || step === "done") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {(["converting", "transcribing", "identifying", "saving", "done"] as Step[]).map((s, i) => {
                  const idx = STEP_ORDER.indexOf(s);
                  const isDone = currentStepIdx > idx;
                  const isCurrent = step === s;

                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        isDone ? "bg-teal-500" : isCurrent ? "bg-indigo-500" : "bg-slate-100"
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                        )}
                      </div>
                      <p className={`text-sm transition-colors ${
                        isCurrent ? "text-slate-800 font-semibold" : isDone ? "text-teal-700 font-medium" : "text-slate-400"
                      }`}>
                        {STEP_LABELS[s]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result summary (when done) */}
        <AnimatePresence>
          {step === "done" && result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-teal-200 bg-teal-50 p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-500" />
                <p className="text-teal-800 font-bold text-sm">Transcription complete</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white p-3 text-center border border-teal-100">
                  <p className="text-lg font-bold text-slate-800">{result.segments.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Segments</p>
                </div>
                <div className="rounded-xl bg-white p-3 text-center border border-teal-100">
                  <p className="text-lg font-bold text-slate-800">{result.speakers.length || "—"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Speakers</p>
                </div>
                <div className="rounded-xl bg-white p-3 text-center border border-teal-100">
                  <p className="text-lg font-bold text-slate-800">
                    {Math.round(result.duration / 60)}m
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Duration</p>
                </div>
              </div>

              {/* Speaker breakdown */}
              {result.speakers.length > 0 && (
                <div className="space-y-2">
                  {result.speakers.map((sp, i) => (
                    <div key={sp.id} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: ["#4F46E5", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6"][i % 5] }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-xs text-slate-600 flex-1">{sp.label}</p>
                      <div className="w-24 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${sp.speaking_percent}%`,
                            background: ["#4F46E5", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6"][i % 5],
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 w-12 text-right">{sp.speaking_percent}%</p>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex gap-2 pt-1">
                {savedId ? (
                  <button
                    onClick={() => router.push(`/dashboard/meeting/${savedId}`)}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Mic2 className="w-4 h-4" /> View Meeting
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
                  >
                    Go to Dashboard
                  </button>
                )}
                <button
                  onClick={() => { setFile(null); setStep("upload"); setResult(null); setSavedId(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Upload another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-4 bg-red-50 border border-red-200 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-semibold text-sm">Transcription failed</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Start button */}
        {file && !isProcessing && step !== "done" && (
          <motion.button
            onClick={startTranscription}
            disabled={backendOnline === false}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 transition-colors"
          >
            <Zap className="w-5 h-5" />
            Transcribe with AI
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
