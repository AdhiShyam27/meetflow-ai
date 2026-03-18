"""
diarizer.py — Speaker diarization wrapper using pyannote.audio 3.1.

Requires:
  1. A HuggingFace access token (HF_TOKEN in .env)
  2. Model license accepted at https://huggingface.co/pyannote/speaker-diarization-3.1
  3. Model license accepted at https://huggingface.co/pyannote/segmentation-3.0
"""

import logging
import time
from typing import Any

import torch

import config

logger = logging.getLogger(__name__)


class SpeakerDiarizer:
    def __init__(self):
        self._pipeline = None

    # ── Lazy load ─────────────────────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    def load(self) -> None:
        if self._pipeline is not None:
            return

        if not config.HF_TOKEN:
            raise RuntimeError(
                "HF_TOKEN not set. Speaker diarization requires a HuggingFace access token.\n"
                "  1. Get a token at https://huggingface.co/settings/tokens\n"
                "  2. Accept the model license at https://huggingface.co/pyannote/speaker-diarization-3.1\n"
                "  3. Set HF_TOKEN in backend/.env"
            )

        logger.info("Loading pyannote/speaker-diarization-3.1 …")
        t0 = time.perf_counter()

        from pyannote.audio import Pipeline

        self._pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=config.HF_TOKEN,
        )

        device = torch.device(config.DIARIZE_DEVICE)
        self._pipeline.to(device)

        elapsed = time.perf_counter() - t0
        logger.info("pyannote loaded in %.1fs on %s", elapsed, config.DEVICE)

    # ── Public API ────────────────────────────────────────────────────────────

    def diarize(
        self,
        audio_path: str,
        min_speakers: int | None = None,
        max_speakers: int | None = None,
    ) -> Any:
        """
        Run speaker diarization on a 16kHz mono WAV file.
        Returns a pyannote Annotation object.
        """
        self.load()

        logger.info("Diarizing %s (min=%s, max=%s) …", audio_path, min_speakers, max_speakers)
        t0 = time.perf_counter()

        kwargs: dict[str, Any] = {}
        if min_speakers is not None:
            kwargs["min_speakers"] = min_speakers
        if max_speakers is not None:
            kwargs["max_speakers"] = max_speakers

        annotation = self._pipeline(audio_path, **kwargs)

        elapsed = time.perf_counter() - t0
        logger.info("Diarization done in %.1fs", elapsed)

        # Free GPU memory immediately after inference
        self._flush_device_cache()

        return annotation

    def get_speaker_stats(
        self, annotation: Any, total_duration: float
    ) -> list[dict]:
        """
        Derive per-speaker statistics from a pyannote Annotation.

        Returns a list sorted by total speaking time (desc):
        [
          {
            "id": "SPEAKER_00",
            "label": "Speaker 1",
            "speaking_time": 234.5,
            "speaking_percent": 42.1,
            "turn_count": 18,
          },
          ...
        ]
        """
        from collections import defaultdict

        speaking: dict[str, float] = defaultdict(float)
        turns: dict[str, int] = defaultdict(int)

        for segment, _, speaker in annotation.itertracks(yield_label=True):
            duration = segment.end - segment.start
            speaking[speaker] += duration
            turns[speaker] += 1

        results = []
        for rank, (spk, secs) in enumerate(
            sorted(speaking.items(), key=lambda x: -x[1]), start=1
        ):
            results.append(
                {
                    "id": spk,
                    "label": f"Speaker {rank}",
                    "speaking_time": round(secs, 2),
                    "speaking_percent": round(secs / total_duration * 100, 1) if total_duration else 0,
                    "turn_count": turns[spk],
                }
            )

        return results

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _flush_device_cache() -> None:
        try:
            if config.DEVICE == "cuda":
                torch.cuda.empty_cache()
            elif config.DEVICE == "mps":
                torch.mps.empty_cache()
        except Exception:
            pass
