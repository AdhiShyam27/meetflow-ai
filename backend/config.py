"""
config.py — Device detection and model configuration for MeetFlow AI backend.
Auto-detects CUDA → MPS (Apple Silicon) → CPU.
"""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Device detection ──────────────────────────────────────────────────────────

def _detect_device() -> str:
    try:
        import torch
        if torch.cuda.is_available():
            logger.info("Device: CUDA (%s)", torch.cuda.get_device_name(0))
            return "cuda"
        if torch.backends.mps.is_available() and torch.backends.mps.is_built():
            logger.info("Device: MPS (Apple Silicon)")
            return "mps"
    except ImportError:
        pass
    logger.info("Device: CPU")
    return "cpu"


_env_device = os.getenv("DEVICE", "auto").lower()
DEVICE: str = _detect_device() if _env_device == "auto" else _env_device

# WhisperX (CTranslate2 backend) does NOT support MPS — force CPU on Apple Silicon.
# pyannote diarization DOES support MPS, so we keep a separate device for that.
WHISPER_DEVICE: str = "cpu" if DEVICE == "mps" else DEVICE
# pyannote has many ops not implemented on MPS at inference time — force CPU to avoid silent failures
DIARIZE_DEVICE: str = "cpu" if DEVICE == "mps" else DEVICE

# ── Model configuration ───────────────────────────────────────────────────────

WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "large-v3-turbo")

# int8 on CPU (faster, lower RAM), float16 on GPU/MPS
COMPUTE_TYPE: str = "int8" if WHISPER_DEVICE == "cpu" else "float16"

BEAM_SIZE: int = 5
# Lower batch size on CPU to avoid OOM; GPU can handle 16
BATCH_SIZE: int = 4 if WHISPER_DEVICE == "cpu" else 16
VAD_FILTER: bool = True    # skip silence segments
LANGUAGE: str | None = None  # None = auto-detect

# Streaming settings
STREAMING_CHUNK_SAMPLES: int = 4096    # ~256ms at 16kHz
STREAMING_SAMPLE_RATE: int = 16_000
VAD_THRESHOLD: float = 0.5
VAD_MIN_SILENCE_MS: int = 500          # commit segment after 500ms silence

# ── HuggingFace token (required for pyannote diarization) ────────────────────

HF_TOKEN: str | None = os.getenv("HF_TOKEN")

# ── File limits ───────────────────────────────────────────────────────────────

MAX_FILE_SIZE_MB: int = 500
ALLOWED_EXTENSIONS: set[str] = {".mp3", ".wav", ".m4a", ".webm", ".ogg", ".mp4", ".flac", ".aac"}

# ── ffmpeg path ───────────────────────────────────────────────────────────────
# conda ffmpeg is not on PATH by default — search common install locations

def _find_ffmpeg() -> str:
    import shutil
    if explicit := os.getenv("FFMPEG_PATH"):
        return explicit
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    for candidate in [
        "/opt/conda/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ]:
        if os.path.isfile(candidate):
            return candidate
    return "ffmpeg"

FFMPEG_PATH: str = _find_ffmpeg()

# ── Temp directory ────────────────────────────────────────────────────────────

TEMP_DIR: str = os.getenv("TEMP_DIR", "/tmp/meetflow")
os.makedirs(TEMP_DIR, exist_ok=True)
