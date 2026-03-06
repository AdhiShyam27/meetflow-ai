#!/usr/bin/env bash
set -e

echo "🎙️  MeetFlow AI — Transcription Backend"
echo "========================================"

# ── Ensure we're in the backend directory ────────────────────────────────────
cd "$(dirname "$0")"

# ── Python: use native arm64 Framework Python on Apple Silicon ───────────────
# The Anaconda Python is x86_64 (Rosetta) and only has torch up to 2.2.2.
# The Framework Python at /Library/Frameworks is native arm64 and supports torch 2.8+.

PYTHON=""
for candidate in \
  "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3" \
  "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3" \
  "$(command -v python3.11 2>/dev/null)" \
  "$(command -v python3 2>/dev/null)"; do
  if [ -x "$candidate" ]; then
    ARCH=$("$candidate" -c "import platform; print(platform.machine())" 2>/dev/null)
    if [ "$ARCH" = "arm64" ]; then
      PYTHON="$candidate"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌  No native arm64 Python 3.11+ found."
  echo "    Install from https://www.python.org/downloads/ (macOS arm64 installer)"
  exit 1
fi

PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅  Python $PY_VERSION (arm64)"

# ── ffmpeg check ──────────────────────────────────────────────────────────────
FFMPEG_FOUND=false
for f in ffmpeg /Users/adhishyam/anaconda3/bin/ffmpeg /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg; do
  if command -v "$f" &>/dev/null 2>&1 || [ -x "$f" ]; then
    FFMPEG_FOUND=true
    FFMPEG_BIN=$(command -v "$f" 2>/dev/null || echo "$f")
    break
  fi
done

if [ "$FFMPEG_FOUND" = "false" ]; then
  echo "❌  ffmpeg not found."
  echo "    Install via conda:  conda install -c conda-forge ffmpeg"
  echo "    Or via Homebrew:    brew install ffmpeg"
  exit 1
fi
echo "✅  ffmpeg ($FFMPEG_BIN)"

# ── Virtual environment ───────────────────────────────────────────────────────
if [ ! -d "venv" ] || [ ! -f "venv/bin/python" ]; then
  echo ""
  echo "Creating native arm64 virtual environment …"
  "$PYTHON" -m venv venv
fi

# Verify venv is arm64
VENV_ARCH=$(venv/bin/python -c "import platform; print(platform.machine())" 2>/dev/null || echo "unknown")
if [ "$VENV_ARCH" != "arm64" ]; then
  echo "⚠️  venv is not arm64 ($VENV_ARCH). Recreating …"
  rm -rf venv
  "$PYTHON" -m venv venv
fi

source venv/bin/activate
echo "✅  Virtual environment active (arm64)"

# ── Install / upgrade dependencies ───────────────────────────────────────────
echo ""
echo "Installing dependencies …"

pip install --quiet --upgrade pip

# Install torch 2.8 (required by WhisperX) — arm64 PyPI has it
if ! python -c "import torch; assert torch.__version__ >= '2.8'" 2>/dev/null; then
  echo "   → Installing PyTorch 2.8.0 with MPS support …"
  pip install --quiet "torch==2.8.0" "torchaudio==2.8.0"
fi

# numpy <2 required for torch 2.8 compatibility
pip install --quiet "numpy<2"

# Core deps
pip install --quiet fastapi "uvicorn[standard]" python-multipart python-dotenv \
  websockets psutil soundfile pydub requests

# Transcription
pip install --quiet "faster-whisper==1.1.0"

# WhisperX (requires torch>=2.8)
if ! python -c "import whisperx" 2>/dev/null; then
  echo "   → Installing WhisperX …"
  pip install --quiet "whisperx @ git+https://github.com/m-bain/whisperX.git"
fi

# Speaker diarization
pip install --quiet "pyannote.audio>=4.0.0"

echo "✅  Dependencies installed"

# ── HF_TOKEN warning ──────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  set -a; source .env 2>/dev/null; set +a
fi

if [ -z "$HF_TOKEN" ]; then
  echo ""
  echo "⚠️   HF_TOKEN not set — speaker diarization will be disabled."
  echo "    To enable:"
  echo "    1. Get a token at https://huggingface.co/settings/tokens"
  echo "    2. Accept the license: https://huggingface.co/pyannote/speaker-diarization-3.1"
  echo "    3. Accept the license: https://huggingface.co/pyannote/segmentation-3.0"
  echo "    4. cp .env.example .env  →  set HF_TOKEN=hf_..."
fi

# ── Start server ──────────────────────────────────────────────────────────────
echo ""
echo "Starting FastAPI server on http://localhost:8000"
echo "  Docs:   http://localhost:8000/docs"
echo "  Health: http://localhost:8000/api/health"
echo ""

exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
