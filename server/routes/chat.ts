import { Elysia, t } from "elysia"
import { config } from "../config"
import {
  buildSystemPrompt,
  isDifficulty,
  isScenarioId,
  OPENING_INSTRUCTION,
} from "../scenarios"

type Message = { role: string; content: string }

const DELIM = "\n---"

// NDJSON events streamed to the client:
//   {"t":"delta","x":"<chunk of the English reply>"}   — as tokens arrive
//   {"t":"response","x":"<full English reply>"}        — reply section complete (TTS can start)
//   {"t":"coaching","x":"<Russian note>"}              — after generation finishes
//   {"t":"suggestions","x":["...","..."]}              — easy difficulty only
//   {"t":"done"}
export const chatRoute = new Elysia().post(
  "/chat",
  async ({ body }) => {
    const { transcript = "", history = [], scenario, start = false, difficulty } = body

    const scenarioId = scenario && isScenarioId(scenario) ? scenario : undefined
    const level = difficulty && isDifficulty(difficulty) ? difficulty : "medium"
    const userContent = start ? OPENING_INSTRUCTION : transcript

    const res = await fetch(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.model,
        think: false,
        stream: true,
        messages: [
          { role: "system", content: buildSystemPrompt(scenarioId, level) },
          ...(history as Message[]),
          { role: "user", content: userContent },
        ],
      }),
    })

    if (!res.ok || !res.body) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`)
    }

    const ollamaBody = res.body

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (event: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))

        const reader = ollamaBody.getReader()
        const decoder = new TextDecoder()
        let ndjsonBuf = "" // partial NDJSON line from Ollama
        let pending = "" // reply text not yet emitted (holdback for a partial "\n---")
        let replyDone = false
        let reply = ""
        let rest = "" // everything after the first delimiter

        const feed = (chunk: string) => {
          if (replyDone) {
            rest += chunk
            return
          }
          pending += chunk
          const at = pending.indexOf(DELIM)
          if (at !== -1) {
            const last = pending.slice(0, at)
            if (last) send({ t: "delta", x: last })
            reply += last
            rest = pending.slice(at + DELIM.length)
            pending = ""
            replyDone = true
            reply = reply.trim()
            send({ t: "response", x: reply })
            return
          }
          // Hold back a tail that could be the start of "\n---"
          const safe = Math.max(0, pending.length - DELIM.length)
          if (safe > 0) {
            send({ t: "delta", x: pending.slice(0, safe) })
            reply += pending.slice(0, safe)
            pending = pending.slice(safe)
          }
        }

        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            ndjsonBuf += decoder.decode(value, { stream: true })
            const lines = ndjsonBuf.split("\n")
            ndjsonBuf = lines.pop()!
            for (const line of lines) {
              if (!line.trim()) continue
              const data = JSON.parse(line) as { message?: { content?: string } }
              const token = data.message?.content
              if (token) feed(token)
            }
          }

          if (!replyDone) {
            if (pending) send({ t: "delta", x: pending })
            reply = (reply + pending).trim()
            send({ t: "response", x: reply })
          }

          const [coachingRaw = "", suggestionsRaw = ""] = rest.split(/\n\s*---\s*/)
          const coaching = coachingRaw.replace(/^[-\s]+/, "").trim()
          send({ t: "coaching", x: coaching })

          const suggestions = suggestionsRaw
            .split("\n")
            .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
            .filter(Boolean)
            .slice(0, 3)
          if (suggestions.length) send({ t: "suggestions", x: suggestions })

          send({ t: "done" })
        } catch (err) {
          send({ t: "error", x: err instanceof Error ? err.message : "stream error" })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    })
  },
  {
    body: t.Object({
      transcript: t.Optional(t.String()),
      history: t.Optional(
        t.Array(t.Object({ role: t.String(), content: t.String() })),
      ),
      scenario: t.Optional(t.String()),
      start: t.Optional(t.Boolean()),
      difficulty: t.Optional(t.String()),
    }),
  },
)
