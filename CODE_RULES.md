# Code rules

How this codebase is organized and how to write code that fits in. For *what*
the product does and *why* it's built this way, see [CONTEXT.md](CONTEXT.md).

## Layout

```
src/
  core/         App-specific building blocks. No dependency on features.
    api/        Typed client for the server API: fetch wrappers and the
                NDJSON chat-stream reader. All `/api/*` calls live here —
                components never call fetch directly.
    audio/      TTS playback engine: sentence-pipelined queue with a
                generation counter for skip/reset. No knowledge of settings.
    capture/    Microphone capture: Web Audio RMS VAD + MediaRecorder hook.
    session/    The conversation domain: the client/server contract
                (contract.ts, see below), the scenario catalog, and turn
                helpers (history building).
    settings/   Persisted user settings (voice, silence threshold,
                difficulty) and the Kokoro voice catalog.
    theme/      Light/dark theme provider (class on <html>, localStorage).
  features/     User-facing slices. May use core; App composes them.
    scenario/   Scenario & difficulty picker — the home screen.
    chat/       The conversation screen: bubbles, coaching notes, suggestion
                chips, the mic dock, and useConversation — the hook that
                orchestrates capture → STT → chat stream → TTS.
    review/     Session debrief overlay ("Finish" flow).
    settings/   Settings screen.
  shared/       App-agnostic code any layer may use — nothing here knows
                about Speech Up.
    components/ui/  Vendored shadcn primitives — do not hand-edit style.
    lib/        `cn()` and similar tiny utilities.
  App.tsx       Thin shell: instantiates the hooks, renders the header and
                whichever screen is active. No business logic.
server/         The Elysia (Bun) API server. Client code in src/ never
                imports from here; the server imports exactly one src file —
                the contract (see below).
  index.ts      Entry: mounts routes, spawns native AI services.
  config.ts     Env-derived config (AI_MODE, service URLs).
  native.ts     Auto-spawn of host Ollama + local_ai in native mode.
  ollama.ts     The Ollama HTTP client (blocking + token-stream variants).
  routes/       Thin Elysia handlers: validate, call ollama/whisper/kokoro,
                shape the response. No parsing logic inline.
  helpers/      Pure logic (prompt builders, reply-stream splitter, model
                JSON extraction) — this is where server behavior lives, so
                it's testable.
```

Every core/feature folder groups its own `components/`, `helpers/`,
`hooks/`, `__tests__/` as needed, plus an `index.ts` barrel.

## Dependency direction

One-way flow: `features → core → shared`, never the reverse.

- `shared` imports nothing but third-party packages — if it needs app
  knowledge, it isn't shared; move it into `core` or the feature.
- `core → core` and `core → shared` are fine; `core` never imports from
  `features`. Exception: `core/session/contract.ts` imports **nothing** at
  all (see below).
- `features → features`: avoid it; today the features are composed only by
  `App.tsx` and don't import each other. If one ever needs another, go
  through its barrel and keep the flow one-way.
- Inside a folder, use relative imports; from outside, import the barrel
  (`@/core/session`, `@/features/chat`). Don't deep-import another slice's
  internals.

## The contract is sacred

`src/core/session/contract.ts` is the single source of truth for everything
that crosses the client/server boundary: scenario and difficulty ids, chat
stream events, review shape. The server imports it by relative path
(`../../src/core/session/contract`):

- **No imports, no React, no DOM, no `@/` alias** — plain TypeScript only,
  so it typechecks under both the app and server tsconfigs.
- Never duplicate an id list or wire type on either side — if the client and
  server must agree on it, it belongs in the contract.
- Everything else in `server/` (personas, prompts, splitting) and in `src/`
  (icons, titles, descriptions) is side-private and stays out of it.

## Functional style

- Prefer small, pure, named functions over inline logic. If a component or
  route grows a nontrivial computation, extract it into the slice's
  `helpers/` and unit test it there.
- No classes. Stateful streaming logic uses closures
  (`createReplySplitter`), not class instances.
- Derive, don't duplicate: compute view data (`hasSpoken`, status labels)
  from existing state on render instead of mirroring it into extra state.
- Components render; hooks orchestrate. Network calls go through
  `core/api`, side-effect sequencing lives in feature hooks
  (`useConversation`, `useSessionReview`).

## Comments

Aim for zero. Name things so the code reads without them. A comment is
justified only for a constraint the code cannot express — a stream holdback
that survives chunk boundaries, a generation counter that races skip, a
model-output quirk. Never write comments that restate the code, narrate
history, or reference tickets/phases.

## Tests

- Vitest, `__tests__/` next to the code, `*.test.ts`, node environment — so
  only pure code is testable; keep logic out of components and routes if you
  want it tested.
- The highest-value targets are the parsing edges: the reply-stream
  splitter, model JSON extraction, turn/history helpers, sentence splitting.
- Anything that talks to Ollama/Whisper/Kokoro or the DOM is exercised
  manually through the app, not unit-tested.

## Language

- Everything in the repo — code, comments, docs, commit messages — is
  English. The app UI is English-only by design.
- Russian appears only in *content produced by the model* (coaching notes,
  debrief) and in the prompt templates that request it — never in UI code.

## Styling

- Theme tokens live in `src/index.css` (`--primary`, `--card`, oklch). Use
  the semantic Tailwind classes (`bg-card`, `text-muted-foreground`,
  `ring-border`); never hardcode hex/oklch values in components.
- Accent tints (amber coaching, sky suggestions, red recording) are the only
  raw palette classes allowed, and only inside the component that owns the
  concept.
- `shared/components/ui` is vendored shadcn — regenerate, don't hand-tweak.

## Workflow

```
bun run typecheck   # tsc -b over app, node, and server configs
bun run lint        # eslint
bun run test        # vitest (pure core + server helpers)
bun run build       # tsc -b && vite build
```

All four must pass before a push.
