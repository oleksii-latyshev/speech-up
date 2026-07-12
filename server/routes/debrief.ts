import { Elysia, t } from "elysia"
import {
  isErrorTag,
  isScenarioId,
  type Correction,
  type ReviewData,
  type Turn,
} from "../../src/core/session/contract"
import { saveReview } from "../db"
import { extractJsonObject } from "../helpers/modelJson"
import { DEBRIEF_SYSTEM, personaFor } from "../helpers/prompts"
import { chatCompletion } from "../ollama"

const sanitizeCorrection = (c: Correction): Correction => ({
  you: c.you,
  better: c.better,
  ...(typeof c.tag === "string" && isErrorTag(c.tag) ? { tag: c.tag } : {}),
})

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
    const review: ReviewData = {
      overview: parsed.overview ?? "",
      corrections: Array.isArray(parsed.corrections)
        ? parsed.corrections.map(sanitizeCorrection)
        : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      praise: parsed.praise ?? "",
    }

    if (body.sessionId != null) {
      await saveReview(body.sessionId, review).catch((err) =>
        console.warn(`Failed to persist review for session ${body.sessionId}:`, err)
      )
    }
    return review
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
      sessionId: t.Optional(t.Number()),
    }),
  }
)
