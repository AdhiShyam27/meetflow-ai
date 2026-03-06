// MeetFlow AI — Transcription type definitions
// Shared between the upload page, API client, and meeting detail view.

export interface Speaker {
  id: string;             // "SPEAKER_00", "SPEAKER_01", …
  label: string;          // "Speaker 1", "Speaker 2", …
  speaking_time: number;  // seconds
  speaking_percent: number;
  turn_count: number;
}

export interface Word {
  word: string;
  start: number;  // seconds
  end: number;
  score: number;  // confidence 0–1
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker: string;   // "SPEAKER_00" | "SPEAKER_01" | …
  words?: Word[];
}

export interface TranscriptionResult {
  language: string;
  duration: number;     // seconds
  speakers: Speaker[];
  segments: Segment[];
  summary: null;        // filled later by /api/summarize
}

// Speaker diarization only (no transcription)
export interface SpeakerTurn {
  speaker: string;
  start: number;
  end: number;
  duration: number;
}

export interface DiarizationResult {
  duration: number;
  speakers: Speaker[];
  turns: SpeakerTurn[];
}

// WebSocket streaming messages
export type StreamMessageType = "partial" | "final" | "status" | "done" | "error";

export interface StreamMessage {
  type: StreamMessageType;
  text?: string;
  start?: number;
  end?: number;
  speaker?: string | null;
  message?: string;       // for "status" and "error"
  segments?: Segment[];   // for "done"
}

// Model status from /api/models/status
export interface ModelStatus {
  whisper: {
    model: string;
    loaded: boolean;
    device: string;
    compute_type: string;
  };
  diarization: {
    model: string;
    loaded: boolean;
    hf_token_set: boolean;
  };
  streaming: {
    loaded: boolean;
    model: string;
    device: string;
    vad: string;
  };
  device: string;
  memory: {
    ram_used_gb: number;
    ram_total_gb: number;
    ram_percent: number;
    vram_used_gb?: number;
    vram_total_gb?: number;
  };
}

// Helpers
export function formatSpeakerTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function segmentsToPlainText(segments: Segment[]): string {
  return segments
    .map((s) => `${s.speaker}: ${s.text}`)
    .join("\n");
}
