import { Elysia, t } from "elysia"
import { config } from "../config"
import { isScenarioId, personaFor } from "../scenarios"

type Message = { role: string; content: string }

const HINT_SYSTEM = (persona: string) => `${persona}

Oleksii is a native Russian speaker practicing spoken English with you. He is stuck and doesn't know what to say next. Based on the conversation so far, suggest exactly 2 different short English replies he could say right now to your last message — first person, spoken style, simple common words, max 12 words each.

Respond ONLY with valid JSON, no markdown fences, no extra text:
{"suggestions": ["<reply option 1>", "<reply option 2>"]}`

export const hintRoute = new Elysia().post(
  "/hint",
  async ({ body }) => {
    const { history = [], scenario } = body
    const scenarioId = scenario && isScenarioId(scenario) ? scenario : undefined

    const res = await fetch(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.model,
        think: false,
        stream: false,
        messages: [
          { role: "system", content: HINT_SYSTEM(personaFor(scenarioId)) },
          ...(history as Message[]),
          { role: "user", content: "(I'm stuck — what could I say to your last message?)" },
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

    const parsed = JSON.parse(jsonMatch[0]) as { suggestions: string[] }
    if (!Array.isArray(parsed.suggestions)) {
      throw new Error(`Unexpected model output: ${raw}`)
    }
    return { suggestions: parsed.suggestions.slice(0, 3) }
  },
  {
    body: t.Object({
      history: t.Optional(
        t.Array(t.Object({ role: t.String(), content: t.String() })),
      ),
      scenario: t.Optional(t.String()),
    }),
  },
)
