# Speech Up — Project Context

AI-powered English speaking coach for a native Russian speaker (Oleksii). Local, privacy-first, runs entirely on the user's machine via Docker.

---

## Core Idea

Most AI speaking tools interrupt users mid-pause. Real thinking requires silence.  
**Speech Up never cuts you off.**

- Waits through long pauses before sending audio
- Responds after the user finishes, not during speech
- Gives corrections in Russian (the user's native language) — as text, never spoken
- AI speaks English via TTS — that IS the practice
- Simulates real scenarios: job interviews, standups, technical discussions, casual chat

---

## Actual Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| Backend | Elysia.js on Bun, port 3001, prefix `/api` |
| Dev proxy | Vite → `http://localhost:3001` (explicit object form required for Vite 8 POST bug) |
| STT | `fedirz/faster-whisper-server` — model: `deepdml/faster-whisper-large-v3-turbo-ct2` |
| LLM | Ollama — model: `qwen3:8b` (best Russian+English bilingual 8B model) |
| TTS | `ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.2` |
| Voice capture | Web Audio API (amplitude/RMS-based VAD) + MediaRecorder |

---

## System Flow (per turn)

```
User speaks
  → Web Audio RMS detects silence (2.5 s threshold) → MediaRecorder stops
  → POST /api/transcribe → faster-whisper → transcript (language=en, context prompt)
  → POST /api/chat → Qwen3:8b → { response (English), coaching (Russian) }
  → POST /api/tts → Kokoro → mp3 audio plays in browser
  → Chat bubble + amber coaching note displayed
```

---

## What Is Already Built ✅

### Infrastructure
- Docker Compose: Ollama + faster-whisper + Kokoro, all healthy
- Ollama init container pulls `qwen3:8b` automatically on first run
- `WHISPER__MODEL_TTL=60` — whisper unloads after 60 s of idle to free RAM
- Docker Desktop must be set to ≥ 12 GB RAM (M1 Pro: qwen3:8b ~5 GB + whisper ~3 GB)

### Voice Capture (`src/hooks/useVoiceCapture.ts`)
- **Auto mode** — RMS amplitude loop; fires after 2.5 s of silence post-speech
- **Push-to-talk** — hold button → record, release → send
- Clean cleanup on unmount, no external VAD library dependencies

### STT (`server/routes/transcribe.ts`)
- `POST /api/transcribe` — receives `audio` file, forwards to faster-whisper
- `language=en` forced (prevents hallucination on Russian-accented English)
- `prompt` set to vocabulary context including user name "Oleksii"

### LLM (`server/routes/chat.ts`)
- `POST /api/chat` — receives `transcript` + `history[]`
- Ollama `/api/chat` with `think: false` (disables Qwen3 thinking for speed)
- System prompt: reply in English (1–2 sentences) + coaching note in Russian
- Returns `{ response, coaching }` as JSON

### TTS (`server/routes/tts.ts`)
- `POST /api/tts` — receives `text` + `voice`, streams mp3 from Kokoro
- Kokoro voices: 40+ options grouped by American/British × Female/Male

### UI (`src/App.tsx`)
- Chat bubble layout: user right, AI left, amber coaching note below each turn
- Auto-plays TTS after each AI response; violet button + "Speaking… (tap to skip)" while playing
- Tapping mic/hold button during playback skips TTS and starts recording

### Settings Panel
- **Theme**: System / Light / Dark (persisted to localStorage, applies `.dark` class)
- **AI Voice**: All Kokoro English voices in a 3-column grid, grouped by accent+gender
- Click any voice → selects it AND immediately previews it (no separate preview button)
- Voice choice persisted to localStorage

---

## What Still Needs to Be Built ❌

### Scenario Selector (next priority)
A screen shown before the first turn that lets the user pick:
- **Job interview** (frontend / backend / fullstack / general)
- **Daily standup**
- **Technical discussion**
- **Casual conversation**

Each scenario injects a different system prompt into `/api/chat` so the AI plays the right role (interviewer, teammate, peer, friend).

### Session Reset
A "New conversation" button that clears `turns` state and starts fresh. Needed especially when switching scenarios.

### Silence Threshold Setting
Expose the `silenceDuration` (currently hardcoded to 2500 ms) as a user setting in the settings panel. Some users need longer pauses.

### Streaming TTS
Currently the browser waits for the full mp3 before playback starts. Streaming Kokoro chunks via chunked transfer or WebSocket would reduce perceived latency after the LLM responds.

### Persistent Session History (optional)
SQLite via Drizzle ORM so conversation history survives page refresh. Not needed for MVP.

### Mobile / iOS Support (deferred)
MediaRecorder and Web Audio API behave differently on iOS Safari. Defer until core features are stable on desktop.

---

## Key Technical Decisions & Gotchas

| Decision | Why |
|---|---|
| Dropped Silero VAD (`@ricky0123/vad-react`) | Its AudioWorklet bundle hardcodes onnxruntime-web WASM filenames incompatible with Vite 8's `public/` restrictions |
| Web Audio RMS VAD instead | Zero dependencies, same UX, works with every browser that supports MediaRecorder |
| `deepdml/faster-whisper-large-v3-turbo-ct2` | `small` model was too inaccurate for non-native accent; turbo-ct2 is 8× better with acceptable CPU latency |
| `language=en` + context `prompt` in Whisper | Without these, Whisper hallucinates heavily on short accented audio |
| Vite 8 proxy: must use object form | `{ "/api": "http://localhost:3001" }` shorthand silently drops POST requests in Vite 8; use `{ "/api": { target, changeOrigin: false } }` |
| `think: false` on Qwen3 | Disables the chain-of-thought reasoning block, cuts latency by ~60% for short responses |
| `WHISPER__MODEL_TTL=60` | Prevents whisper (~3 GB) and Qwen3 (~5 GB) from both being in RAM simultaneously and triggering OOM kills |
| Docker Desktop memory ≥ 12 GB | Required on macOS; default is too low for both models to coexist |
| Bind mount `./ollama_data` | Named volumes caused permission issues; bind mount is simpler and survives `docker compose down` |
