import { Elysia, t } from "elysia"
import { config } from "../config"
import {
  buildSystemPrompt,
  isDifficulty,
  isScenarioId,
  OPENING_INSTRUCTION,
} from "../scenarios"

type Message = { role: string; content: string }

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
        stream: false,
        messages: [
          { role: "system", content: buildSystemPrompt(scenarioId, level) },
          ...(history as Message[]),
          { role: "user", content: userContent },
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as { message: { content: string } }
    const raw = data.message.content.trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`Unexpected model output: ${raw}`)

    const parsed = JSON.parse(jsonMatch[0]) as {
      response: string
      coaching: string
      suggestions?: string[]
    }
    if (!Array.isArray(parsed.suggestions)) delete parsed.suggestions
    return parsed
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
