#!/usr/bin/env bash
set -e

echo "🎙️  MeetFlow AI — Transcription Backend"
echo "========================================"

# ── Python version check ──────────────────────────────────────────────────────
PYTHON=$(command -v python3.11 || command -v python3 || echo "")
if [ -z "$PYTHON" ]; then
  echo "❌  Python 3.11+ not found. Install from https://www.python.org/downloads/"
  exit 1
fi

PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅  Python $PY_VERSION"

# ── ffmpeg check ──────────────────────────────────────────────────────────────
if ! command -v ffmpeg &> /dev/null; then
  echo "❌  ffmpeg not found."
  echo "    macOS:  brew install ffmpeg"
  echo "    Ubuntu: sudo apt install ffmpeg"
  exit 1
fi
echo "✅  ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"

# ── Virtual environment ───────────────────────────────────────────────────────
if [ ! -d "venv" ]; then
  echo ""
  echo "Creating virtual environment …"
  "$PYTHON" -m venv venv
fi

source venv/bin/activate
echo "✅  Virtual environment active"

# ── Install / upgrade dependencies ───────────────────────────────────────────
echo ""
echo "Installing dependencies …"

# For Apple Silicon, install PyTorch with MPS support first
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  echo "   → Apple Silicon detected, installing torch with MPS support"
  pip install --quiet --upgrade pip
  pip install --quiet torch torchaudio
fi

pip install --quiet -r requirements.txt
echo "✅  Dependencies installed"

# ── HF_TOKEN warning ──────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  source .env 2>/dev/null || true
fi

if [ -z "$HF_TOKEN" ]; then
  echo ""
  echo "⚠️   HF_TOKEN not set — speaker diarization will be disabled."
  echo "    To enable it:"
  echo "    1. Get a token at https://huggingface.co/settings/tokens"
  echo "    2. Accept the license at https://huggingface.co/pyannote/speaker-diarization-3.1"
  echo "    3. Accept the license at https://huggingface.co/pyannote/segmentation-3.0"
  echo "    4. cp .env.example .env && edit .env to add your token"
fi

# ── Start server ──────────────────────────────────────────────────────────────
echo ""
echo "Starting FastAPI server on http://localhost:8000"
echo "  Docs:   http://localhost:8000/docs"
echo "  Health: http://localhost:8000/api/health"
echo ""

exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
