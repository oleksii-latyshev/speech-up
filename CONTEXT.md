# Speech Up — Project Context

AI-powered English speaking coach for a native Russian speaker (Oleksii). Local, privacy-first, runs entirely on the user's machine via Docker.

## Goal

Build a speaking trainer that lets a person improve their **spoken** English **without any human involvement**. The target user already understands English well by ear and reads fluently, but has little to no real conversation experience. The app must take them from "I understand but freeze when I have to speak" to **speaking confidently**: it creates realistic conversation situations, gives the user unlimited safe practice, never interrupts their thinking pauses, and coaches them (in Russian) on how to sound more natural — so that regular sessions translate directly into confidence in real-life English conversations (interviews, standups, technical and casual talk).

## Roadmap

Phases are ordered by how much they contribute to the goal above ("start speaking confidently"), not by ease of implementation.

### Phase 1 — Trainer core ✅ (done)

The minimum after which the app is usable for daily practice.

1. **Scenario Selector** (top priority)
   - Scenario config (id, title, system prompt, AI role): job interview (frontend / backend / fullstack / general), daily standup, technical discussion, casual conversation.
   - Scenario picker screen shown before the first turn.
   - Pass the selected scenario to `/api/chat` so the system prompt changes per role.
   - **Key detail for the goal:** the AI speaks first (asks the opening question as interviewer / teammate). Answering is far easier than starting from a blank page for someone afraid to speak.
2. **Session Reset** — a "New conversation" button: clears `turns`, returns to the scenario picker. Required for switching scenarios.
3. **Silence threshold setting** — slider in settings (~1.5–5 s instead of the hardcoded 2500 ms), persisted to localStorage. Everyone's thinking pause is different.

### Phase 2 — Coach features ✅ (done)

Conversation alone is practice, but confidence grows from feedback and from overcoming the "I don't know how to say this" freeze.

4. **Difficulty levels** — Easy / Medium / Hard, picked on the scenario screen (persisted):
   - **Easy**: the AI uses simple vocabulary and short sentences, and every AI turn comes with 2 suggested replies ("You could say") — tap a suggestion to hear it via TTS, then say it yourself.
   - **Medium**: no automatic help, but an "I'm stuck" button asks the AI for 2 reply hints on demand.
   - **Hard**: no hints at all; the AI speaks naturally with idioms, like a real conversation.
5. **Session debrief** — a "Finish" button generates a review in Russian: overview, "what you said → what a native would say" pairs, vocabulary to remember, praise. Without this, progress is lost between sessions.
6. **"I'm stuck" button** — when the user freezes, the AI offers 2 English replies he could say (available on Easy and Medium).

### Phase 3 — Latency & comfort ✅ (done)

7. **Streaming pipeline** — the LLM response streams token-by-token into the chat bubble, and TTS starts as soon as the English reply section is complete (while the coaching note is still generating). Audio is synthesized and played sentence-by-sentence with prefetch. Perceived wait dropped from ~15–30 s to ~3–5 s before the voice starts.
8. **UX polish** — explicit status states (Transcribing → Thinking → Speaking); the user's transcript appears immediately after STT, before the LLM reply arrives.

### Phase 4 — Progress & history

9. **SQLite + Drizzle ORM** ✅ — persist sessions, mistakes, and vocabulary across restarts.
10. **Progress screen** — stats: session count, speaking time, average utterance length, recurring error tags. Visible progress = motivation.
11. **Warm-up on past mistakes** — at session start the AI prompts the user to use 2–3 phrases from previous debriefs. Simplest form of spaced repetition.

### Phase 5 — Later

12. **Mobile / iOS Safari** — deferred until the desktop core is stable (MediaRecorder / Web Audio quirks).
13. **Pronunciation feedback** — hard to do locally; possibly experiment with word-level confidence from faster-whisper as a rough signal.

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
| Persistence | SQLite (`bun:sqlite`) + Drizzle ORM, DB file `data/speech-up.db` (gitignored, `DB_PATH` overrides) |
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
- **Two AI-stack modes** (`AI_MODE` in `.env`, default `docker`):
  - `docker` — the compose services above; portable fallback / demo mode. CPU-only on macOS (Docker Desktop can't pass the Apple GPU through; measured ~8–12 tok/s for qwen3:8b).
  - `native` (macOS) — host Ollama with Metal (~23 tok/s measured on M1 Pro) + `local_ai/server.py`: FastAPI on port 8000 with mlx-whisper (Metal) for STT and kokoro-onnx for TTS, same OpenAI-compatible endpoints as the docker services. `server/native.ts` auto-spawns `ollama serve` (with `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`) and `local_ai` on `bun dev:server` start — skipping whatever is already listening — and kills them on exit, so nothing stays in the background. Setup: `brew install ollama`, `ollama pull qwen3:8b`, `python3 -m venv local_ai/.venv && local_ai/.venv/bin/pip install -r local_ai/requirements.txt`. Models auto-download on first start (mlx whisper ~1.6 GB from HF, kokoro ~330 MB from GitHub). webm decoding is done with PyAV (bundled ffmpeg) — no brew ffmpeg needed. Never run host Ollama and the docker `ollama` service simultaneously (port 11434).

### Voice Capture (`src/core/capture/useVoiceCapture.ts`)
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

### UI (`src/features/chat`, shell in `src/App.tsx` — see [CODE_RULES.md](CODE_RULES.md) for the layout)
- Chat bubble layout: user right, AI left, amber coaching note below each turn
- Auto-plays TTS after each AI response; violet button + "Speaking… (tap to skip)" while playing
- Tapping mic/hold button during playback skips TTS and starts recording

### Settings Panel
- **Theme**: System / Light / Dark (persisted to localStorage, applies `.dark` class)
- **Pause before sending**: slider 1–5 s (step 0.25 s) controlling the VAD `silenceDuration`, persisted to localStorage
- **Speak replies aloud**: switch (persisted, default on). Off = text-only replies, no TTS calls at all — fastest turn-around; suggestion chips and voice preview still play on explicit tap
- **AI Voice**: All Kokoro English voices in a 3-column grid, grouped by accent+gender
- Click any voice → selects it AND immediately previews it (no separate preview button)
- Voice choice persisted to localStorage

### Scenarios (Phase 1)
- `server/helpers/prompts.ts` — personas: interview (frontend / backend / fullstack / general), daily standup, technical discussion, casual chat; shared coaching rules appended to every persona
- `/api/chat` accepts `scenario` (id) and `start` (boolean); with `start: true` the AI opens the conversation (greeting + first question), `coaching` empty
- `src/features/scenario/components/ScenarioPicker.tsx` — card-grid picker shown before the first turn; interview card has 4 role chips; ids live in the shared contract `src/core/session/contract.ts`
- The AI's opening turn is stored as a turn with empty `transcript` (rendered without a user bubble, excluded from `history` as a user message)
- **New chat** button in the header resets the session (AlertDialog confirm when a conversation exists); `useVoiceCapture.cancel()` discards any in-flight recording without triggering transcription

### Streaming pipeline (Phase 3)
- Model output format is plain text with `---` separators (reply / coaching / suggestions) instead of JSON — enables streaming and is more robust for a small model
- `/api/chat` streams NDJSON events: `{"t":"delta"}` per token chunk, `{"t":"response"}` when the English reply is complete (client starts TTS here), then `{"t":"coaching"}`, `{"t":"suggestions"}` (easy only), `{"t":"done"}`; the server holds back a small tail so a partial `\n---` never leaks into deltas
- Client (`streamChat` in `src/core/api`): growing AI bubble with a cursor while streaming; typing dots before the first token
- `playTTS` splits text into sentences and pipelines them: the next sentence is synthesized while the current one plays (generation counter `playSeqRef` invalidates the queue on skip/reset)
- User transcript renders immediately after STT (`pendingTranscript`); status label shows Transcribing… / Thinking… (`phase` state)

### Persistence (Phase 4, item 9)
- **SQLite via `bun:sqlite` + Drizzle ORM** (`server/db/`): schema in `schema.ts` (tables: `sessions`, `turns`, `reviews`, `corrections`, `vocabulary` — the last three cascade-delete with their session), repository functions in `sessions.ts`, connection + WAL + `runMigrations()` in `index.ts`
- Migrations: SQL files committed in `server/db/migrations/`, applied automatically on server start; after a schema change run `bunx drizzle-kit generate` (config in `drizzle.config.ts`)
- DB file: `data/speech-up.db` (gitignored); `DB_PATH` env var overrides
- **Endpoints** (`server/routes/sessions.ts`): `POST /api/sessions` (create → `{id}`), `POST /api/sessions/:id/turns`, `POST /api/sessions/:id/end` (sets `endedAt` only if not already set), `GET /api/sessions` (list of `SessionSummary` with turn counts — foundation for the progress screen)
- `/api/debrief` accepts optional `sessionId` and persists the review + corrections + vocabulary (replacing any previous review for that session) and ends the session
- **Client wiring** (`useConversation`): `startScenario` creates the session, every completed turn (including the AI opener) is saved, "New chat" ends the session; `App` passes `conversation.sessionId` into the debrief. All persistence is best-effort — a failed write logs a `console.warn` and never interrupts practice
- `Turn` and `SessionSummary` types moved into the shared contract (`src/core/session/contract.ts`)

### Coach features (Phase 2)
- **Difficulty levels** (`easy`/`medium`/`hard`, segmented control on the picker, persisted to localStorage): difficulty adjusts the AI's speech style in the system prompt; on `easy` the `/api/chat` JSON gains a `suggestions` array (2 example replies) rendered as chips under the last AI turn — clicking a chip plays it via TTS
- **`/api/hint`** (`server/routes/hint.ts`) — "I'm stuck" button (shown on easy+medium): sends history + scenario, returns `{suggestions}` rendered in the same chips UI
- **`/api/debrief`** (`server/routes/debrief.ts`) — "Finish" button (appears once the user has spoken): sends all turns + coaching notes, returns a Russian review `{overview, corrections[{you,better}], vocabulary[], praise}` rendered by `src/features/review/components/SessionReview.tsx` (full-screen overlay with loading/error states, "Start a new conversation" at the bottom)

---

## What Still Needs to Be Built ❌

See the **Roadmap** section above — Phases 1–3 and the Phase 4 persistence layer (item 9) are done; next up in Phase 4: the progress screen (item 10) and warm-up on past mistakes (item 11), both of which can now read from the DB.

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
