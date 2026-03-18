"""
main.py — MeetFlow AI Transcription Backend (FastAPI)

Endpoints:
  GET  /api/health                — health check
  GET  /api/models/status         — model load status + device info
  POST /api/models/download       — pre-download all models
  POST /api/transcribe            — upload audio → full transcript + speaker labels
  POST /api/transcribe/quick      — upload audio → fast transcript (no diarization)
  POST /api/identify-speakers     — audio → speaker segments only (no transcription)
  WS   /api/transcribe/stream     — real-time streaming transcription

Usage:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import psutil
import torch
from fastapi import FastAPI, File, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from audio_utils import cleanup, convert_to_wav, get_audio_duration, save_upload, validate_audio
from streaming import StreamingTranscriber
from transcriber import TranscriptionService

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("meetflow")

# ── Shared service instances (module-level, lazy-loaded) ─────────────────────

transcription_service = TranscriptionService()
streaming_transcriber = StreamingTranscriber()


# ── App + CORS ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MeetFlow AI Transcription Backend starting …")
    logger.info("Device: %s | Whisper model: %s | Compute: %s", config.DEVICE, config.WHISPER_MODEL, config.COMPUTE_TYPE)
    yield
    logger.info("Shutting down …")


app = FastAPI(
    title="MeetFlow AI Transcription Backend",
    version="1.0.0",
    lifespan=lifespan,
)

_EXTRA_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://meetflow-ai.vercel.app",
        *_EXTRA_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Utility ───────────────────────────────────────────────────────────────────

def _memory_info() -> dict:
    vm = psutil.virtual_memory()
    info = {
        "ram_used_gb": round(vm.used / 1e9, 2),
        "ram_total_gb": round(vm.total / 1e9, 2),
        "ram_percent": vm.percent,
    }
    if config.DEVICE == "cuda":
        try:
            info["vram_used_gb"] = round(torch.cuda.memory_allocated() / 1e9, 2)
            info["vram_total_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2)
        except Exception:
            pass
    return info


async def _prepare_audio(file: UploadFile) -> tuple[str, str]:
    """
    Save upload, validate, convert to 16kHz WAV.
    Returns (raw_path, wav_path). Caller must cleanup both.
    """
    file_bytes = await file.read()
    valid, err = validate_audio(file.filename or "upload.bin", len(file_bytes))
    if not valid:
        raise ValueError(err)

    raw_path = save_upload(file_bytes, file.filename or "upload.bin")
    wav_path = convert_to_wav(raw_path)
    return raw_path, wav_path


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "device": config.DEVICE,
        "models_loaded": transcription_service.is_loaded,
        "streaming_loaded": streaming_transcriber.is_loaded,
        **_memory_info(),
    }


@app.get("/api/models/status")
async def models_status():
    ts_status = transcription_service.get_status()
    st_status = streaming_transcriber.get_status()
    return {
        **ts_status,
        "streaming": st_status,
        "device": config.DEVICE,
        "memory": _memory_info(),
    }


@app.post("/api/models/download")
async def download_models():
    """
    Pre-download and warm-up all models so the first transcription request
    doesn't have a long cold-start delay.
    """
    results: dict[str, dict] = {}

    # WhisperX model
    try:
        t0 = time.perf_counter()
        transcription_service.load_models()
        results["whisperx"] = {"status": "ok", "elapsed_s": round(time.perf_counter() - t0, 1)}
    except Exception as exc:
        results["whisperx"] = {"status": "error", "error": str(exc)}

    # Streaming model (separate faster-whisper instance)
    try:
        t0 = time.perf_counter()
        streaming_transcriber.load_models()
        results["streaming"] = {"status": "ok", "elapsed_s": round(time.perf_counter() - t0, 1)}
    except Exception as exc:
        results["streaming"] = {"status": "error", "error": str(exc)}

    # pyannote (only if HF_TOKEN is set)
    if config.HF_TOKEN:
        try:
            t0 = time.perf_counter()
            transcription_service.diarizer.load()
            results["diarization"] = {"status": "ok", "elapsed_s": round(time.perf_counter() - t0, 1)}
        except Exception as exc:
            results["diarization"] = {"status": "error", "error": str(exc)}
    else:
        results["diarization"] = {"status": "skipped", "reason": "HF_TOKEN not set"}

    return {"results": results, "device": config.DEVICE}


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    min_speakers: Optional[int] = Query(None, ge=1, le=20, description="Minimum number of speakers"),
    max_speakers: Optional[int] = Query(None, ge=1, le=20, description="Maximum number of speakers"),
    diarize: bool = Query(True, description="Run speaker diarization"),
    language: Optional[str] = Query(None, description="Language code (e.g. 'en'). Auto-detect if omitted"),
):
    """
    Upload an audio/video file → full transcript with speaker labels.

    Accepted formats: mp3, wav, m4a, webm, ogg, mp4, flac, aac
    Returns the structured MeetFlow transcript JSON.
    """
    raw_path = wav_path = None
    try:
        raw_path, wav_path = await _prepare_audio(file)
        duration = get_audio_duration(wav_path)
        logger.info("Transcribing: %s (%.1fs, diarize=%s)", file.filename, duration, diarize)

        if diarize:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: transcription_service.transcribe_with_speakers(
                    wav_path, min_speakers=min_speakers, max_speakers=max_speakers
                ),
            )
        else:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: transcription_service.transcribe_quick(wav_path),
            )

        return result

    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except MemoryError:
        return JSONResponse(
            status_code=507,
            content={"error": "Out of memory. Try a shorter file or disable diarization."},
        )
    except Exception as exc:
        logger.exception("Transcription failed: %s", exc)
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        cleanup(raw_path or "", wav_path or "")


@app.post("/api/transcribe/quick")
async def transcribe_quick(file: UploadFile = File(...)):
    """
    Fast transcription without speaker diarization.
    Returns segments without speaker labels — good for a quick first pass.
    """
    raw_path = wav_path = None
    try:
        raw_path, wav_path = await _prepare_audio(file)
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: transcription_service.transcribe_quick(wav_path),
        )
        return result

    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:
        logger.exception("Quick transcription failed: %s", exc)
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        cleanup(raw_path or "", wav_path or "")


@app.post("/api/identify-speakers")
async def identify_speakers(
    file: UploadFile = File(...),
    min_speakers: Optional[int] = Query(None, ge=1, le=20),
    max_speakers: Optional[int] = Query(None, ge=1, le=20),
):
    """
    Run ONLY speaker diarization on an audio file (no transcription).
    Useful for getting speaker segments before running transcription separately.
    """
    raw_path = wav_path = None
    try:
        raw_path, wav_path = await _prepare_audio(file)
        duration = get_audio_duration(wav_path)

        annotation = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: transcription_service.diarizer.diarize(
                wav_path, min_speakers=min_speakers, max_speakers=max_speakers
            ),
        )
        speakers = transcription_service.diarizer.get_speaker_stats(annotation, duration)

        # Return raw speaker turns
        turns = [
            {
                "speaker": spk,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "duration": round(seg.end - seg.start, 3),
            }
            for seg, _, spk in annotation.itertracks(yield_label=True)
        ]

        return {"duration": round(duration, 2), "speakers": speakers, "turns": turns}

    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except RuntimeError as exc:
        # HF_TOKEN missing etc.
        return JSONResponse(status_code=503, content={"error": str(exc)})
    except Exception as exc:
        logger.exception("Speaker identification failed: %s", exc)
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        cleanup(raw_path or "", wav_path or "")


@app.websocket("/api/transcribe/stream")
async def stream_transcribe(websocket: WebSocket):
    """
    Real-time streaming transcription via WebSocket.

    Client sends: binary frames of 16kHz PCM float32 (4096 samples ≈ 256ms each)
                  or JSON {"type": "stop"} to end the session.
    Server sends: JSON status/partial/final/done messages.
    """
    await websocket.accept()
    logger.info("WebSocket connected from %s", websocket.client)
    try:
        await streaming_transcriber.process_audio_stream(websocket)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as exc:
        logger.exception("WebSocket error: %s", exc)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
