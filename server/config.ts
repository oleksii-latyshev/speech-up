// AI_MODE picks where STT/TTS live:
//   "docker" (default) — the docker-compose services (portable, demo-friendly)
//   "native"           — local_ai/server.py (mlx-whisper + kokoro-onnx) and host
//                        Ollama with Metal; both are auto-spawned by server/index.ts
// Explicit *_URL env vars always win over the mode defaults.
const aiMode = process.env.AI_MODE === "native" ? "native" : "docker"
const native = aiMode === "native"

export const config = {
  port: Number(process.env.PORT ?? 3001),
  aiMode,
  db: {
    path: process.env.DB_PATH ?? "data/speech-up.db",
  },
  ollama: {
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    model: process.env.OLLAMA_MODEL ?? "qwen3:8b",
  },
  whisper: {
    url:
      process.env.WHISPER_URL ??
      (native ? "http://localhost:8000" : "http://localhost:8001"),
    model:
      process.env.WHISPER_MODEL ?? "deepdml/faster-whisper-large-v3-turbo-ct2",
  },
  kokoro: {
    url:
      process.env.KOKORO_URL ??
      (native ? "http://localhost:8000" : "http://localhost:8880"),
  },
}
