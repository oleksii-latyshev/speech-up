"""Native macOS AI server for Speech Up: STT via mlx-whisper (Metal), TTS via kokoro-onnx.

Exposes the same OpenAI-compatible endpoints as the dockerized services, so the
Bun backend can switch between them with AI_MODE alone:

  POST /v1/audio/transcriptions   multipart: file, language, prompt
  POST /v1/audio/speech           json: { input, voice, speed }

Model files are downloaded automatically on first start.
"""

import asyncio
import io
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from functools import partial
from pathlib import Path

import numpy as np

# MLX ties its compute streams to the calling thread — run ALL whisper work on
# one dedicated thread or mx.async_eval fails with "no Stream in current thread".
WHISPER_POOL = ThreadPoolExecutor(max_workers=1)

MODELS_DIR = Path(__file__).parent / "models"
KOKORO_MODEL = MODELS_DIR / "kokoro-v1.0.onnx"
KOKORO_VOICES = MODELS_DIR / "voices-v1.0.bin"
KOKORO_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
WHISPER_REPO = os.environ.get("LOCAL_AI_WHISPER_REPO", "mlx-community/whisper-large-v3-turbo")
PORT = int(os.environ.get("LOCAL_AI_PORT", "8000"))


def _download(url: str, dest: Path) -> None:
    print(f"[local_ai] downloading {dest.name} …", flush=True)
    tmp = dest.with_suffix(dest.suffix + ".part")

    def hook(blocks: int, block_size: int, total: int) -> None:
        if total > 0 and blocks % 500 == 0:
            print(f"[local_ai]   {blocks * block_size / 1e6:.0f} / {total / 1e6:.0f} MB", flush=True)

    urllib.request.urlretrieve(url, tmp, reporthook=hook)
    tmp.rename(dest)
    print(f"[local_ai] {dest.name} ready", flush=True)


def ensure_models() -> None:
    MODELS_DIR.mkdir(exist_ok=True)
    if not KOKORO_MODEL.exists():
        _download(f"{KOKORO_BASE}/kokoro-v1.0.onnx", KOKORO_MODEL)
    if not KOKORO_VOICES.exists():
        _download(f"{KOKORO_BASE}/voices-v1.0.bin", KOKORO_VOICES)


def decode_audio(data: bytes, rate: int = 16000) -> np.ndarray:
    """Any browser audio (webm/opus, mp4, wav) -> mono float32 PCM via bundled ffmpeg libs."""
    import av

    chunks: list[np.ndarray] = []
    with av.open(io.BytesIO(data)) as container:
        resampler = av.AudioResampler(format="s16", layout="mono", rate=rate)
        for frame in container.decode(audio=0):
            chunks.extend(r.to_ndarray() for r in resampler.resample(frame))
        chunks.extend(r.to_ndarray() for r in resampler.resample(None))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    pcm = np.concatenate(chunks, axis=1).reshape(-1)
    return pcm.astype(np.float32) / 32768.0


from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

import mlx_whisper
import soundfile as sf
from kokoro_onnx import Kokoro

kokoro: Kokoro | None = None


def _warm_whisper() -> None:
    # First transcribe pulls the model from HuggingFace (~1.6 GB) and compiles it;
    # do it at startup so the first real utterance isn't slow.
    try:
        mlx_whisper.transcribe(np.zeros(16000, dtype=np.float32), path_or_hf_repo=WHISPER_REPO)
        print("[local_ai] whisper warmed up", flush=True)
    except Exception as e:  # noqa: BLE001 — warmup is best-effort
        print(f"[local_ai] whisper warmup failed: {e}", flush=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global kokoro
    kokoro = Kokoro(str(KOKORO_MODEL), str(KOKORO_VOICES))
    print("[local_ai] kokoro loaded", flush=True)
    WHISPER_POOL.submit(_warm_whisper)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/v1/audio/transcriptions")
async def transcriptions(
    file: UploadFile = File(...),
    language: str = Form("en"),
    prompt: str = Form(""),
    model: str = Form(""),  # accepted for OpenAI API compatibility, ignored
    response_format: str = Form("json"),  # ditto
) -> dict:
    audio = decode_audio(await file.read())
    result = await asyncio.get_running_loop().run_in_executor(
        WHISPER_POOL,
        partial(
            mlx_whisper.transcribe,
            audio,
            path_or_hf_repo=WHISPER_REPO,
            language=language or None,
            initial_prompt=prompt or None,
        ),
    )
    return {"text": result["text"]}


class SpeechRequest(BaseModel):
    input: str
    voice: str = "af_heart"
    speed: float = 1.0
    model: str = "kokoro"  # ignored
    response_format: str = "wav"  # we always produce wav


@app.post("/v1/audio/speech")
def speech(req: SpeechRequest) -> Response:
    assert kokoro is not None
    samples, sample_rate = kokoro.create(req.input, voice=req.voice, speed=req.speed, lang="en-us")
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    ensure_models()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
