import { Elysia, t } from "elysia"
import { config } from "../config"

export const ttsRoute = new Elysia().post(
  "/tts",
  async ({ body }) => {
    const { text, voice } = body

    const res = await fetch(`${config.kokoro.url}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kokoro",
        input: text,
        voice,
        response_format: "mp3",
      }),
    })

    if (!res.ok) {
      throw new Error(`Kokoro ${res.status}: ${await res.text()}`)
    }

    return new Response(res.body, {
      headers: { "Content-Type": "audio/mpeg" },
    })
  },
  {
    body: t.Object({
      text: t.String(),
      voice: t.String(),
    }),
  },
)
