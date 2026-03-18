"""
transcriber.py — Full WhisperX transcription pipeline with speaker diarization.

Pipeline:
  1. Transcribe with WhisperX (faster-whisper backend)
  2. Align words with wav2vec2 for precise word-level timestamps
  3. Speaker diarization with pyannote (optional)
  4. Assign speaker labels to each word/segment
  5. Return structured JSON result
"""

import logging
import time
from typing import Any

import torch
import numpy as np

import config
from diarizer import SpeakerDiarizer
from audio_utils import get_audio_duration

logger = logging.getLogger(__name__)


class TranscriptionService:
    def __init__(self):
        self._whisperx_model = None
        self._align_models: dict[str, tuple] = {}   # lang -> (model_a, metadata)
        self.diarizer = SpeakerDiarizer()

    # ── Model loading ─────────────────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._whisperx_model is not None

    def load_models(self) -> None:
        """Lazy-load WhisperX model (called on first request)."""
        if self._whisperx_model is not None:
            return

        logger.info(
            "Loading WhisperX (%s) on %s [%s] …",
            config.WHISPER_MODEL,
            config.WHISPER_DEVICE,
            config.COMPUTE_TYPE,
        )
        t0 = time.perf_counter()

        import whisperx

        self._whisperx_model = whisperx.load_model(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.COMPUTE_TYPE,
            language=config.LANGUAGE,
            asr_options={
                "beam_size": config.BEAM_SIZE,
                "without_timestamps": False,
                "word_timestamps": True,
            },
            vad_options={"vad_onset": 0.5, "vad_offset": 0.363} if config.VAD_FILTER else {},
        )

        elapsed = time.perf_counter() - t0
        logger.info("WhisperX loaded in %.1fs", elapsed)

    def _load_align_model(self, language: str) -> tuple:
        """Cache wav2vec2 alignment models per language."""
        if language not in self._align_models:
            import whisperx

            logger.info("Loading alignment model for '%s' …", language)
            model_a, metadata = whisperx.load_align_model(
                language_code=language, device=config.WHISPER_DEVICE
            )
            self._align_models[language] = (model_a, metadata)
        return self._align_models[language]

    # ── Full pipeline: transcribe + align + diarize ───────────────────────────

    def transcribe_with_speakers(
        self,
        audio_path: str,
        min_speakers: int | None = None,
        max_speakers: int | None = None,
    ) -> dict:
        """
        Full pipeline: transcription + word alignment + speaker diarization.
        Returns structured result (see _format_result for schema).
        """
        self.load_models()

        import whisperx

        audio = whisperx.load_audio(audio_path)
        total_duration = len(audio) / config.STREAMING_SAMPLE_RATE
        timings: dict[str, float] = {}

        # Step 1 — Transcription ──────────────────────────────────────────────
        logger.info("Transcribing %.1fs of audio …", total_duration)
        t0 = time.perf_counter()
        result = self._whisperx_model.transcribe(
            audio,
            batch_size=config.BATCH_SIZE,
            language=config.LANGUAGE,
        )
        timings["transcription"] = time.perf_counter() - t0
        logger.info("Transcription done in %.1fs — lang: %s", timings["transcription"], result.get("language"))

        # Step 2 — Alignment ──────────────────────────────────────────────────
        language = result.get("language", "en")
        try:
            model_a, metadata = self._load_align_model(language)
            t0 = time.perf_counter()
            result = whisperx.align(
                result["segments"], model_a, metadata, audio,
                device=config.WHISPER_DEVICE, return_char_alignments=False,
            )
            timings["alignment"] = time.perf_counter() - t0
            logger.info("Alignment done in %.1fs", timings["alignment"])
        except Exception as exc:
            logger.warning("Alignment failed (%s), continuing without word timestamps", exc)

        # Step 3 — Diarization ────────────────────────────────────────────────
        speakers = []
        diarization_error: str | None = None
        try:
            if not config.HF_TOKEN:
                raise RuntimeError("HF_TOKEN not set — speaker diarization disabled")
            annotation = self.diarizer.diarize(
                audio_path, min_speakers=min_speakers, max_speakers=max_speakers
            )
            t0 = time.perf_counter()
            result = whisperx.assign_word_speakers(annotation, result)
            timings["diarization"] = time.perf_counter() - t0
            logger.info("Speaker assignment done in %.1fs", timings["diarization"])
            speakers = self.diarizer.get_speaker_stats(annotation, total_duration)
            unique_speakers = {s["id"] for s in speakers}
            logger.info("Identified %d unique speaker(s): %s", len(unique_speakers), unique_speakers)
        except Exception as exc:
            diarization_error = str(exc)
            logger.error("Diarization failed: %s", exc, exc_info=True)

        self._flush_device_cache()
        logger.info("Pipeline timings: %s", {k: f"{v:.1f}s" for k, v in timings.items()})

        result_dict = self._format_result(result, language, total_duration, speakers)
        if diarization_error:
            result_dict["diarization_error"] = diarization_error
        return result_dict

    # ── Quick transcription (no diarization) ─────────────────────────────────

    def transcribe_quick(self, audio_path: str) -> dict:
        """
        Fast transcription without alignment or diarization.
        Good for getting a quick text dump before doing a full run.
        """
        self.load_models()

        import whisperx

        audio = whisperx.load_audio(audio_path)
        total_duration = len(audio) / config.STREAMING_SAMPLE_RATE

        logger.info("Quick-transcribing %.1fs of audio …", total_duration)
        t0 = time.perf_counter()
        result = self._whisperx_model.transcribe(audio, batch_size=config.BATCH_SIZE)
        elapsed = time.perf_counter() - t0
        logger.info("Quick transcription done in %.1fs", elapsed)

        self._flush_device_cache()

        language = result.get("language", "en")
        return self._format_result(result, language, total_duration, speakers=[])

    # ── Result formatting ─────────────────────────────────────────────────────

    def _format_result(
        self,
        raw: dict,
        language: str,
        total_duration: float,
        speakers: list[dict],
    ) -> dict:
        """
        Normalise WhisperX output into the MeetFlow AI transcript schema:

        {
          "language": "en",
          "duration": 1500.0,
          "speakers": [...],
          "segments": [
            {
              "id": 1,
              "start": 0.0,
              "end": 3.52,
              "text": "...",
              "speaker": "SPEAKER_00",
              "words": [{"word": "...", "start": 0.0, "end": 0.28, "score": 0.95}]
            }
          ]
        }
        """
        segments = []
        raw_segments = raw.get("segments", [])

        for i, seg in enumerate(raw_segments):
            text = seg.get("text", "").strip()
            if not text:
                continue

            words = [
                {
                    "word": w.get("word", ""),
                    "start": round(w.get("start", 0.0), 3),
                    "end": round(w.get("end", 0.0), 3),
                    "score": round(float(w.get("score", 0.0)), 3),
                }
                for w in seg.get("words", [])
            ]

            segments.append(
                {
                    "id": i + 1,
                    "start": round(seg.get("start", 0.0), 3),
                    "end": round(seg.get("end", 0.0), 3),
                    "text": text,
                    "speaker": seg.get("speaker") or "SPEAKER_00",
                    "words": words,
                }
            )

        return {
            "language": language,
            "duration": round(total_duration, 2),
            "speakers": speakers,
            "segments": segments,
            "summary": None,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "whisper": {
                "model": config.WHISPER_MODEL,
                "loaded": self.is_loaded,
                "device": config.WHISPER_DEVICE,
                "compute_type": config.COMPUTE_TYPE,
            },
            "diarization": {
                "model": "pyannote/speaker-diarization-3.1",
                "loaded": self.diarizer.is_loaded,
                "hf_token_set": bool(config.HF_TOKEN),
            },
        }

    @staticmethod
    def _flush_device_cache() -> None:
        try:
            if config.DEVICE == "cuda":
                torch.cuda.empty_cache()
            elif config.DEVICE == "mps":
                torch.mps.empty_cache()
        except Exception:
            pass
