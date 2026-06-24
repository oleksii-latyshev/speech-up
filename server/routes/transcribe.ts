import { Elysia, t } from "elysia"

export const transcribeRoute = new Elysia().post(
  "/transcribe",
  async ({ body }) => {
    // Stub — will forward to faster-whisper in the STT step
    const { audio } = body
    return {
      transcript: `[stub] received ${audio.size} bytes of audio`,
    }
  },
  {
    body: t.Object({
      audio: t.File(),
    }),
  },
)
