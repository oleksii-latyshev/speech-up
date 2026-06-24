# Speech Up — AI English Speaking Coach

An AI-powered English speaking practice app built for developers who want to improve conversational fluency — without being rushed.

---

## The Problem

Most AI speaking tools fail because they interrupt users mid-pause. Real thinking requires silence. **Speech Up** never cuts you off.

---

## Core Idea

A local, privacy-first conversational partner that:

- **Never interrupts** — waits patiently through thinking pauses
- **Responds after you finish**, not during your speech
- **Gives corrections gently**, post-turn rather than mid-sentence
- **Simulates real developer scenarios**: job interviews (frontend/backend/fullstack), daily standups, technical deep-dives, casual chat

---

## Architecture

The app is a **monolith in spirit** — one repo, one deployable unit for the Bun backend + React frontend — but it delegates computationally heavy AI tasks to sidecar services managed via Docker Compose.

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (React)                     │
│  Microphone → VAD → MediaRecorder → WebSocket/HTTP       │
└───────────────────────┬──────────────────────────────────┘
                        │ WebSocket / REST
┌───────────────────────▼──────────────────────────────────┐
│              Bun Server (Elysia.js)                      │
│  - Serves built Vite frontend                            │
│  - Orchestrates the AI pipeline                          │
│  - Session & conversation state                          │
└───────┬───────────────┬───────────────┬──────────────────┘
        │               │               │
   ┌────▼────┐    ┌──────▼──────┐  ┌───▼────┐
   │ Whisper │    │   Ollama    │  │ Kokoro │
   │  (STT)  │    │   (LLM)     │  │  (TTS) │
   └─────────┘    └─────────────┘  └────────┘
```

### Pipeline per turn

```
User speaks
  → VAD detects end-of-speech (browser-side, Silero VAD via ONNX)
  → Audio chunk sent to backend
  → faster-whisper transcribes speech to text
  → Ollama LLM generates reply + optional correction
  → Kokoro synthesizes audio response
  → Browser plays audio, displays transcript + feedback
```

---

## Tech Stack

### Frontend (already bootstrapped)
| Concern | Choice |
|---|---|
| Framework | React 19 + Vite 8 |
| Language | TypeScript |
| UI | Shadcn/ui + Tailwind CSS v4 |
| Voice capture | Browser MediaRecorder API |
| VAD | Silero VAD (ONNX Runtime Web) — runs in-browser, zero server round-trip |

### Backend (to be added to this repo)
| Concern | Choice |
|---|---|
| Runtime | Bun (already used as package manager — no extra tooling needed) |
| Framework | **Elysia.js** — Bun-native, TypeScript-first, built-in WebSocket support, fast |
| Transport | WebSockets for streaming audio/text, REST for config |
| State | In-memory per session (no DB needed for MVP) |

### AI Services (Docker Compose sidecars)
| Role | Service | Model / Notes |
|---|---|---|
| STT | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | `small` model, **multilingual** (not the `-en` variant) — handles Russian-accented English and mixed input |
| LLM | [Ollama](https://ollama.com) | **Qwen3:8B** — top choice for Russian+English bilingual coaching; understands Russian natively and can explain corrections in Russian |
| TTS | [Kokoro](https://github.com/remsky/Kokoro-FastAPI) | 82M-param model, ~100ms latency on CPU, Apache 2.0, available as a FastAPI Docker image |

---

## Why These Models

### LLM — Qwen3:8B (primary recommendation)
- **Best-in-class Russian support** among 8B local models — trained heavily on Russian text, produces natural Russian explanations
- Excellent English conversation quality for the practice side
- Bilingual by design: the conversation happens in English, corrections and hints are delivered in Russian
- If the user is stuck and types/says something in Russian, the model understands and responds in Russian before redirecting to English
- Runs well on a CPU-only Mac (8–16 GB RAM)
- Ollama pulls it with one command: `ollama pull qwen3:8b`
- Fallback: `llama3.1:8b` — decent Russian, but noticeably weaker than Qwen3 for Cyrillic

### STT — faster-whisper
- 4× faster than OpenAI's Whisper with the same accuracy
- Always use the **multilingual** model variant (not `-en`) — it handles Russian-accented English and occasional Russian words the user might slip in
- `small` model (~244 MB) is the sweet spot: handles accents and mixed input, fast enough on CPU
- Runs entirely on CPU; GPU support is available if you later add one

### TTS — Kokoro-82M
- Only 82M parameters, synthesizes in ~100ms on CPU
- Sounds natural enough for a coach (not robotic)
- Available as a ready-made FastAPI Docker image (`remsky/kokoro-fastapi`)
- **English-only** — this is intentional: the AI speaks English (that's the practice), corrections are shown as Russian text in the UI, not spoken
- Fallback: [Piper TTS](https://github.com/rhasspy/piper) — even lighter, slightly less natural

### VAD — Silero VAD (browser-side)
- Runs in the browser via ONNX Runtime Web — no server round-trip
- Much smarter than WebRTC VAD; handles noisy environments
- Detects end-of-speech rather than any silence, so it won't cut off thinking pauses
- Key behavior: configurable `speechEndTimeout` (e.g. 2–3 seconds) — the user controls when "done speaking" is declared

---

## Docker Compose Layout (planned)

```yaml
services:
  app:
    build: .                        # Bun/Elysia.js server + built Vite frontend
    ports: ["3000:3000"]
    environment:
      WHISPER_URL: http://whisper:8001
      OLLAMA_URL: http://ollama:11434
      KOKORO_URL: http://kokoro:8880

  ollama:
    image: ollama/ollama
    volumes: ["ollama_data:/root/.ollama"]
    # GPU: add `deploy.resources.reservations.devices` for NVIDIA

  whisper:
    image: fedirz/faster-whisper-server:latest-cpu
    environment:
      WHISPER__MODEL: small

  kokoro:
    image: ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.2

volumes:
  ollama_data:
```

---

## Conversation Scenarios (MVP scope)

1. **Job interview** — Interviewer asks common frontend/backend/fullstack questions
2. **Daily standup** — Simulate a team standup, user gives their update
3. **Technical discussion** — Explain a concept, defend a design decision
4. **Casual chat** — Free-form small talk to build fluency under no pressure

The LLM system prompt controls the scenario. The coaching layer is a second LLM pass (or a structured suffix in the same prompt) that identifies grammar/vocabulary improvements and presents them after the turn ends — **always written in Russian**, since that is the user's native language.

---

## Key UX Constraints

- **No interruptions** — VAD `speechEndTimeout` must be at least 2 seconds; expose it as a user setting
- **Corrections are non-blocking** — shown as a soft overlay after the AI responds, never mid-sentence
- **Corrections are in Russian** — the user's native language; the AI explains mistakes and suggests alternatives in Russian so the explanation lands clearly
- **Audio-first** — the primary output is synthesized speech (English); Russian feedback is text-only
- **Session continuity** — conversation history is held in memory for the session duration; no login, no cloud

---

## What To Build Next (ordered)

1. **Backend scaffold** — add Elysia.js server to this Vite repo; proxy API calls in dev via `vite.config.ts`
2. **Docker Compose** — wire up Ollama + faster-whisper + Kokoro; verify each service responds
3. **Voice capture** — MediaRecorder pipeline in the browser; stream chunks to backend
4. **VAD integration** — Silero VAD via `@ricky0123/vad-web` (the easiest ONNX VAD library for browsers)
5. **STT endpoint** — backend receives audio blob, forwards to faster-whisper, returns transcript
6. **LLM conversation** — system prompt per scenario, maintain message history in session
7. **TTS playback** — backend calls Kokoro, streams audio back to browser
8. **Coaching overlay** — second LLM call (or prompt suffix) extracts corrections; display post-turn
9. **Scenario selector UI** — simple screen to pick interview / standup / casual before starting
10. **Settings panel** — VAD timeout, voice speed, model selection

---

## Development Setup (current state)

```bash
bun install
bun dev        # starts Vite dev server on :5173
```

Once the backend is added:

```bash
docker compose up -d        # starts Ollama + Whisper + Kokoro
bun dev                     # Vite proxies /api → localhost:3000
```

---

## Open Questions / Decisions Deferred

- **Streaming vs. full-response TTS** — stream Kokoro chunks for lower perceived latency, or wait for the full audio? Streaming is better UX but adds complexity.
- **Correction prompt design** — inline in the same LLM call (simpler) vs. a dedicated correction pass (slower but more focused). Start with inline.
- **Persistent history** — SQLite via Drizzle is the natural next step if sessions should survive page refresh.
- **GPU support** — the Docker Compose setup above is CPU-only. Adding an NVIDIA GPU changes Ollama and whisper service configs slightly.
- **Mobile support** — MediaRecorder behavior and VAD performance differ on iOS Safari; defer to a later milestone.
