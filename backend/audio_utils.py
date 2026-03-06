"""
audio_utils.py — Audio preprocessing utilities.
Converts any audio/video format to 16kHz mono PCM WAV using ffmpeg.
"""

import os
import subprocess
import tempfile
import logging
from pathlib import Path

import config

logger = logging.getLogger(__name__)

FFMPEG_CMD = os.getenv("FFMPEG_PATH", "ffmpeg")


def _run_ffmpeg(*args: str) -> subprocess.CompletedProcess:
    cmd = [FFMPEG_CMD, "-y", *args]
    logger.debug("ffmpeg: %s", " ".join(cmd))
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed (exit {result.returncode}):\n"
            + result.stderr.decode(errors="replace")
        )
    return result


def convert_to_wav(input_path: str) -> str:
    """
    Convert any audio/video file to 16kHz mono PCM WAV.
    Returns path to the output WAV file (caller must clean it up).
    """
    out_path = os.path.join(
        config.TEMP_DIR,
        Path(input_path).stem + "_16k.wav",
    )
    _run_ffmpeg(
        "-i", input_path,
        "-ar", "16000",   # 16kHz sample rate
        "-ac", "1",       # mono
        "-c:a", "pcm_s16le",
        out_path,
    )
    logger.info("Converted %s → %s", input_path, out_path)
    return out_path


def get_audio_duration(path: str) -> float:
    """Return audio duration in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30,
    )
    try:
        return float(result.stdout.strip())
    except (ValueError, TypeError):
        return 0.0


def validate_audio(filename: str, file_size: int) -> tuple[bool, str]:
    """
    Validate uploaded audio file.
    Returns (is_valid, error_message).
    """
    ext = Path(filename).suffix.lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        return False, f"Unsupported format '{ext}'. Allowed: {', '.join(sorted(config.ALLOWED_EXTENSIONS))}"

    max_bytes = config.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        return False, f"File too large ({file_size / 1e6:.1f} MB). Max: {config.MAX_FILE_SIZE_MB} MB"

    return True, ""


def save_upload(file_bytes: bytes, filename: str) -> str:
    """Save uploaded bytes to a temp file. Returns the path."""
    ext = Path(filename).suffix.lower() or ".bin"
    fd, path = tempfile.mkstemp(suffix=ext, dir=config.TEMP_DIR)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(file_bytes)
    except Exception:
        os.close(fd)
        raise
    return path


def cleanup(*paths: str) -> None:
    """Delete temp files, silently ignoring missing files."""
    for p in paths:
        try:
            os.unlink(p)
        except FileNotFoundError:
            pass
        except Exception as exc:
            logger.warning("Could not delete temp file %s: %s", p, exc)
