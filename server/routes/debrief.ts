import { Elysia, t } from "elysia"
import { config } from "../config"
import { isScenarioId, personaFor } from "../scenarios"

interface Turn {
  transcript: string
  response: string
  coaching: string
}

const DEBRIEF_SYSTEM = `You are an experienced English speaking coach. Oleksii, a native Russian speaker, just finished a spoken English practice session. You will get the conversation transcript (his lines are marked "Oleksii:", per-turn coaching notes may be included).

Write a session review IN RUSSIAN (except the English phrases themselves). Address him as «ты» and do NOT use his name (avoid transliterating it). Be encouraging but honest — the goal is that next time he speaks more confidently and more naturally.

Respond ONLY with valid JSON, no markdown fences, no extra text:
{
  "overview": "<2-3 предложения по-русски: общее впечатление, что стоит тренировать>",
  "corrections": [{"you": "<his phrase, English>", "better": "<natural native phrasing, English>"}],
  "vocabulary": ["<useful English word or phrase> — <короткое пояснение по-русски>"],
  "praise": "<1 предложение по-русски: что получилось хорошо>"
}

Rules:
- "corrections": the 3-5 most useful fixes from THIS conversation (skip transcript punctuation/casing issues). If he spoke flawlessly, return fewer or none.
- "vocabulary": 3-6 words or expressions worth remembering for this scenario.
- Do not invent phrases he never said.`

export const debriefRoute = new Elysia().post(
  "/debrief",
  async ({ body }) => {
    const { turns, scenario } = body
    const scenarioId = scenario && isScenarioId(scenario) ? scenario : undefined

    const conversation = turns
      .flatMap((t: Turn) => [
        ...(t.transcript
          ? [`Oleksii: ${t.transcript}${t.coaching ? `\n(coaching note: ${t.coaching})` : ""}`]
          : []),
        `AI: ${t.response}`,
      ])
      .join("\n")

    const res = await fetch(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.model,
        think: false,
        stream: false,
        messages: [
          { role: "system", content: DEBRIEF_SYSTEM },
          {
            role: "user",
            content: `Scenario: the AI played this role — ${personaFor(scenarioId)}\n\nConversation:\n${conversation}`,
          },
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
      overview: string
      corrections: { you: string; better: string }[]
      vocabulary: string[]
      praise: string
    }
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
        }),
      ),
      scenario: t.Optional(t.String()),
    }),
  },
)
