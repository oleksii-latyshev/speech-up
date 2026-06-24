export const config = {
  port: Number(process.env.PORT ?? 3001),
  ollama: {
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    model: process.env.OLLAMA_MODEL ?? "qwen3:8b",
  },
  whisper: {
    url: process.env.WHISPER_URL ?? "http://localhost:8001",
    model: process.env.WHISPER_MODEL ?? "small",
  },
  kokoro: {
    url: process.env.KOKORO_URL ?? "http://localhost:8880",
  },
}
