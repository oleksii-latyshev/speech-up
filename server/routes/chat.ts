import { Elysia, t } from "elysia"
import { config } from "../config"

const SYSTEM_PROMPT = `You are a friendly English conversation practice partner for a native Russian speaker.

For each message (the user's spoken English transcript):
1. Reply naturally in English — keep it SHORT, 1-2 sentences. This is spoken conversation, not writing.
2. Write a brief coaching note in Russian about their grammar, word choice, or naturalness. If it was correct and natural, say "Отлично!" or similar.

Respond ONLY with valid JSON, no markdown fences, no extra text:
{"response": "<your English reply>", "coaching": "<Russian coaching note>"}`

type Message = { role: string; content: string }

export const chatRoute = new Elysia().post(
  "/chat",
  async ({ body }) => {
    const { transcript, history = [] } = body

    const res = await fetch(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.model,
        think: false,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(history as Message[]),
          { role: "user", content: transcript },
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

    return JSON.parse(jsonMatch[0]) as { response: string; coaching: string }
  },
  {
    body: t.Object({
      transcript: t.String(),
      history: t.Optional(
        t.Array(t.Object({ role: t.String(), content: t.String() })),
      ),
    }),
  },
)
