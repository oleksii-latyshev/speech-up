import { Elysia, t } from "elysia"
import { isScenarioId, type ReviewData } from "../../src/core/session/contract"
import { extractJsonObject } from "../helpers/modelJson"
import { DEBRIEF_SYSTEM, personaFor } from "../helpers/prompts"
import { chatCompletion } from "../ollama"

interface Turn {
  transcript: string
  response: string
  coaching: string
}

const formatConversation = (turns: Turn[]) =>
  turns
    .flatMap((t) => [
      ...(t.transcript
        ? [
            `Oleksii: ${t.transcript}${t.coaching ? `\n(coaching note: ${t.coaching})` : ""}`,
          ]
        : []),
      `AI: ${t.response}`,
    ])
    .join("\n")

export const debriefRoute = new Elysia().post(
  "/debrief",
  async ({ body }) => {
    const { turns, scenario } = body
    const scenarioId = scenario && isScenarioId(scenario) ? scenario : undefined

    const raw = await chatCompletion([
      { role: "system", content: DEBRIEF_SYSTEM },
      {
        role: "user",
        content: `Scenario: the AI played this role — ${personaFor(scenarioId)}\n\nConversation:\n${formatConversation(turns)}`,
      },
    ])

    const parsed = extractJsonObject<ReviewData>(raw)
    return {
      overview: parsed.overview ?? "",
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      praise: parsed.praise ?? "",
    }
  },
  {
    body: t.Object({
      turns: t.Array(
        t.Object({
          transcript: t.String(),
          response: t.String(),
          coaching: t.String(),
        })
      ),
      scenario: t.Optional(t.String()),
    }),
  }
)
