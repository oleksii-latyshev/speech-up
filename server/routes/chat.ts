import { Elysia, t } from "elysia"
import {
  isDifficulty,
  isScenarioId,
  type ChatEvent,
} from "../../src/core/session/contract"
import { buildSystemPrompt, OPENING_INSTRUCTION } from "../helpers/prompts"
import { createReplySplitter } from "../helpers/replySplitter"
import { chatTokens } from "../ollama"

// Streams NDJSON chat events (see ChatEvent in the contract):
// deltas while the English reply generates, "response" once it is complete
// (the client starts TTS there), then "coaching", "suggestions" (easy only).
export const chatRoute = new Elysia().post(
  "/chat",
  ({ body }) => {
    const {
      transcript = "",
      history = [],
      scenario,
      start = false,
      difficulty,
      warmup = [],
    } = body

    const scenarioId = scenario && isScenarioId(scenario) ? scenario : undefined
    const level = difficulty && isDifficulty(difficulty) ? difficulty : "medium"
    const userContent = start ? OPENING_INSTRUCTION : transcript

    const messages = [
      { role: "system", content: buildSystemPrompt(scenarioId, level, warmup) },
      ...history,
      { role: "user", content: userContent },
    ]

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (event: ChatEvent) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        const splitter = createReplySplitter(send)

        try {
          for await (const token of chatTokens(messages)) {
            splitter.feed(token)
          }
          splitter.finish()
        } catch (err) {
          send({
            t: "error",
            x: err instanceof Error ? err.message : "stream error",
          })
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
        t.Array(t.Object({ role: t.String(), content: t.String() }))
      ),
      scenario: t.Optional(t.String()),
      start: t.Optional(t.Boolean()),
      difficulty: t.Optional(t.String()),
      warmup: t.Optional(t.Array(t.String())),
    }),
  }
)
