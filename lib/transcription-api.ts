/**
 * transcription-api.ts — Client for the MeetFlow AI Python transcription backend.
 *
 * Start the backend with:  cd backend && ./start.sh
 * Default URL: http://localhost:8000
 * Override via: NEXT_PUBLIC_TRANSCRIPTION_API in .env.local
 */

import type {
  DiarizationResult,
  ModelStatus,
  StreamMessage,
  TranscriptionResult,
} from "@/types/transcription";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_TRANSCRIPTION_API ?? "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchBackend<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    // Don't include Next.js cache; this is always a fresh local call
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Backend error ${res.status}`;
    try {
      const body = await res.json();
      message = body.error ?? body.detail ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── REST endpoints ────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<{
  status: string;
  device: string;
  models_loaded: boolean;
}> {
  return fetchBackend("/api/health");
}

export async function getModelStatus(): Promise<ModelStatus> {
  return fetchBackend("/api/models/status");
}

export async function preloadModels(): Promise<{
  results: Record<string, { status: string; elapsed_s?: number; error?: string }>;
  device: string;
}> {
  return fetchBackend("/api/models/download", { method: "POST" });
}

export interface TranscribeOptions {
  minSpeakers?: number;
  maxSpeakers?: number;
  diarize?: boolean;
  language?: string;
  onProgress?: (step: string) => void;
}

export async function transcribeFile(
  file: File,
  options: TranscribeOptions = {},
): Promise<TranscriptionResult> {
  const params = new URLSearchParams();
  if (options.minSpeakers != null) params.set("min_speakers", String(options.minSpeakers));
  if (options.maxSpeakers != null) params.set("max_speakers", String(options.maxSpeakers));
  if (options.diarize != null) params.set("diarize", String(options.diarize));
  if (options.language) params.set("language", options.language);

  const formData = new FormData();
  formData.append("file", file);

  options.onProgress?.("Uploading…");

  return fetchBackend<TranscriptionResult>(
    `/api/transcribe?${params.toString()}`,
    { method: "POST", body: formData },
  );
}

export async function transcribeFileQuick(
  file: File,
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchBackend<TranscriptionResult>("/api/transcribe/quick", {
    method: "POST",
    body: formData,
  });
}

export async function identifySpeakers(
  file: File,
  options: { minSpeakers?: number; maxSpeakers?: number } = {},
): Promise<DiarizationResult> {
  const params = new URLSearchParams();
  if (options.minSpeakers != null) params.set("min_speakers", String(options.minSpeakers));
  if (options.maxSpeakers != null) params.set("max_speakers", String(options.maxSpeakers));

  const formData = new FormData();
  formData.append("file", file);
  return fetchBackend<DiarizationResult>(
    `/api/identify-speakers?${params.toString()}`,
    { method: "POST", body: formData },
  );
}

// ── WebSocket streaming ───────────────────────────────────────────────────────

export interface StreamingConnection {
  sendAudioChunk: (samples: Float32Array) => void;
  stop: () => void;
  close: () => void;
}

export function createStreamingConnection(
  onMessage: (msg: StreamMessage) => void,
  onError?: (err: Event) => void,
): StreamingConnection {
  const wsUrl = BACKEND_URL.replace(/^http/, "ws") + "/api/transcribe/stream";
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    onMessage({ type: "status", message: "connected" });
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      onMessage(JSON.parse(event.data as string) as StreamMessage);
    } catch {
      /* ignore malformed messages */
    }
  };

  ws.onerror = (err) => {
    onError?.(err);
  };

  return {
    sendAudioChunk(samples: Float32Array) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(samples.buffer);
      }
    },
    stop() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stop" }));
      }
    },
    close() {
      ws.close();
    },
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Estimate how long transcription will take based on file duration and device.
 * Very rough heuristic.
 */
export function estimateTranscriptionTime(
  durationSeconds: number,
  device: string,
  withDiarization: boolean,
): string {
  const rtf = device === "cpu" ? 0.15 : 0.05; // real-time factor
  let estimate = durationSeconds * rtf;
  if (withDiarization) estimate *= 1.4;
  if (estimate < 60) return `~${Math.ceil(estimate)}s`;
  return `~${Math.ceil(estimate / 60)}m`;
}
