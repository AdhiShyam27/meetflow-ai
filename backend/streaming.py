"""
streaming.py — Real-time streaming transcription using faster-whisper + Silero VAD.

Protocol (WebSocket):
  Client → Server:  binary frames of 16kHz PCM float32 (4096 samples each)
                    or JSON {"type": "stop"} to end the session
  Server → Client:  JSON messages:
    {"type": "status",  "message": "ready"|"listening"|"processing"}
    {"type": "partial", "text": "...", "start": 0.0, "end": 1.2}
    {"type": "final",   "text": "...", "start": 0.0, "end": 2.1, "speaker": null}
    {"type": "done",    "segments": [...]}
    {"type": "error",   "message": "..."}
"""

import asyncio
import json
import logging
import struct
import time
from typing import AsyncGenerator

import numpy as np
import torch

import config

logger = logging.getLogger(__name__)

SAMPLE_RATE = config.STREAMING_SAMPLE_RATE
CHUNK_SAMPLES = config.STREAMING_CHUNK_SAMPLES


class StreamingTranscriber:
    def __init__(self):
        self._model = None
        self._vad_model = None
        self._vad_utils = None

    # ── Lazy loading ──────────────────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load_models(self) -> None:
        if self._model is not None:
            return

        logger.info(
            "Loading faster-whisper (%s) for streaming on %s [%s] …",
            config.WHISPER_MODEL,
            config.DEVICE,
            config.COMPUTE_TYPE,
        )
        t0 = time.perf_counter()

        from faster_whisper import WhisperModel

        # For MPS, faster-whisper falls back to CPU (CTranslate2 doesn't support MPS)
        device = "cpu" if config.DEVICE == "mps" else config.DEVICE
        compute_type = "int8" if device == "cpu" else config.COMPUTE_TYPE

        self._model = WhisperModel(
            config.WHISPER_MODEL,
            device=device,
            compute_type=compute_type,
        )

        # Load Silero VAD for speech activity detection
        self._load_vad()

        elapsed = time.perf_counter() - t0
        logger.info("Streaming models loaded in %.1fs", elapsed)

    def _load_vad(self) -> None:
        try:
            vad_model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                onnx=True,
            )
            self._vad_model = vad_model
            (
                self._get_speech_timestamps,
                _,
                self._read_audio,
                _,
                self._collect_chunks,
            ) = utils
            logger.info("Silero VAD loaded")
        except Exception as exc:
            logger.warning("Silero VAD failed to load (%s) — using energy-based VAD fallback", exc)

    # ── WebSocket session handler ─────────────────────────────────────────────

    async def process_audio_stream(self, websocket) -> None:
        """
        Main WebSocket loop.
        Receives binary PCM chunks, buffers them, detects speech endpoints via VAD,
        transcribes each speech segment, and streams results back.
        """
        self.load_models()

        await websocket.send_json({"type": "status", "message": "ready"})

        buffer = np.array([], dtype=np.float32)
        all_segments: list[dict] = []
        silence_frames = 0
        # ~500ms of silence at 16kHz triggers a transcription commit
        silence_threshold_frames = int(
            config.VAD_MIN_SILENCE_MS / 1000 * SAMPLE_RATE / CHUNK_SAMPLES
        )
        time_offset = 0.0

        try:
            while True:
                data = await websocket.receive()

                # Control message: stop
                if data.get("type") == "websocket.receive" and data.get("text"):
                    try:
                        msg = json.loads(data["text"])
                        if msg.get("type") == "stop":
                            break
                    except json.JSONDecodeError:
                        pass
                    continue

                raw = data.get("bytes")
                if raw is None:
                    continue

                # Decode PCM float32 samples
                samples = np.frombuffer(raw, dtype=np.float32)
                buffer = np.concatenate([buffer, samples])

                # VAD: detect voiced vs silence
                is_speech = self._has_speech(buffer[-CHUNK_SAMPLES:])

                if is_speech:
                    silence_frames = 0
                    await websocket.send_json({"type": "status", "message": "listening"})
                else:
                    silence_frames += 1

                # Commit segment when we've accumulated enough audio + silence
                should_commit = (
                    silence_frames >= silence_threshold_frames
                    and len(buffer) >= SAMPLE_RATE * 0.5  # at least 0.5s
                )

                if should_commit:
                    await websocket.send_json({"type": "status", "message": "processing"})
                    segments = await asyncio.get_event_loop().run_in_executor(
                        None, self._transcribe_chunk, buffer.copy()
                    )

                    for seg in segments:
                        seg["start"] = round(seg["start"] + time_offset, 3)
                        seg["end"] = round(seg["end"] + time_offset, 3)
                        all_segments.append(seg)
                        await websocket.send_json({"type": "final", **seg})

                    time_offset += len(buffer) / SAMPLE_RATE
                    buffer = np.array([], dtype=np.float32)
                    silence_frames = 0

        except Exception as exc:
            logger.exception("Streaming error: %s", exc)
            await websocket.send_json({"type": "error", "message": str(exc)})
        finally:
            # Transcribe any remaining audio in buffer
            if len(buffer) >= SAMPLE_RATE * 0.3:
                try:
                    segments = await asyncio.get_event_loop().run_in_executor(
                        None, self._transcribe_chunk, buffer
                    )
                    for seg in segments:
                        seg["start"] = round(seg["start"] + time_offset, 3)
                        seg["end"] = round(seg["end"] + time_offset, 3)
                        all_segments.append(seg)
                except Exception:
                    pass

            await websocket.send_json({"type": "done", "segments": all_segments})

    # ── Core transcription ────────────────────────────────────────────────────

    def _transcribe_chunk(self, audio: np.ndarray) -> list[dict]:
        """
        Run faster-whisper on a chunk of audio.
        Returns list of segment dicts: {text, start, end, speaker: null}
        """
        if self._model is None:
            return []

        try:
            segments_gen, info = self._model.transcribe(
                audio,
                language="en",
                vad_filter=config.VAD_FILTER,
                vad_parameters={
                    "threshold": config.VAD_THRESHOLD,
                    "min_silence_duration_ms": config.VAD_MIN_SILENCE_MS,
                },
                word_timestamps=False,
                beam_size=config.BEAM_SIZE,
            )
            return [
                {
                    "text": seg.text.strip(),
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "speaker": None,
                }
                for seg in segments_gen
                if seg.text.strip()
            ]
        except Exception as exc:
            logger.error("Chunk transcription failed: %s", exc)
            return []

    # ── VAD helpers ───────────────────────────────────────────────────────────

    def _has_speech(self, chunk: np.ndarray) -> bool:
        """Returns True if the chunk contains speech."""
        if self._vad_model is not None:
            try:
                tensor = torch.from_numpy(chunk)
                prob = self._vad_model(tensor, SAMPLE_RATE).item()
                return prob > config.VAD_THRESHOLD
            except Exception:
                pass

        # Energy-based fallback
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        return rms > 0.02

    def get_status(self) -> dict:
        return {
            "loaded": self.is_loaded,
            "model": config.WHISPER_MODEL,
            "device": "cpu" if config.DEVICE == "mps" else config.DEVICE,
            "vad": "silero" if self._vad_model is not None else "energy-fallback",
        }
