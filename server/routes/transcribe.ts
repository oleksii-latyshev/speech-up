import { Elysia, t } from "elysia"
import { config } from "../config"

export const transcribeRoute = new Elysia().post(
  "/transcribe",
  async ({ body }) => {
    const { audio } = body

    const form = new FormData()
    form.append("file", audio, audio.name || "audio.webm")
    form.append("model", config.whisper.model)
    form.append("language", "en")
    form.append("prompt", "Oleksii is practicing spoken English. Topics: work experience, daily life, travel, hobbies, goals.")
    form.append("response_format", "json")

    const res = await fetch(`${config.whisper.url}/v1/audio/transcriptions`, {
      method: "POST",
      body: form,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Whisper ${res.status}: ${text}`)
    }

    const { text } = (await res.json()) as { text: string }
    return { transcript: text.trim() }
  },
  {
    body: t.Object({
      audio: t.File(),
    }),
  },
)
