import { Elysia, t } from "elysia"
import { isScenarioId } from "../../src/core/session/contract"
import { extractJsonObject } from "../helpers/modelJson"
import { HINT_SYSTEM, personaFor } from "../helpers/prompts"
import { chatCompletion } from "../ollama"

export const hintRoute = new Elysia().post(
  "/hint",
  async ({ body }) => {
    const { history = [], scenario } = body
    const scenarioId = scenario && isScenarioId(scenario) ? scenario : undefined

    const raw = await chatCompletion([
      { role: "system", content: HINT_SYSTEM(personaFor(scenarioId)) },
      ...history,
      {
        role: "user",
        content: "(I'm stuck — what could I say to your last message?)",
      },
    ])

    const parsed = extractJsonObject<{ suggestions: string[] }>(raw)
    if (!Array.isArray(parsed.suggestions)) {
      throw new Error(`Unexpected model output: ${raw}`)
    }
    return { suggestions: parsed.suggestions.slice(0, 3) }
  },
  {
    body: t.Object({
      history: t.Optional(
        t.Array(t.Object({ role: t.String(), content: t.String() }))
      ),
      scenario: t.Optional(t.String()),
    }),
  }
)
