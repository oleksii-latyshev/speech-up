import { Elysia } from "elysia"
import { config } from "./config"
import { runMigrations } from "./db"
import { startNativeServices } from "./native"
import { transcribeRoute } from "./routes/transcribe"
import { chatRoute } from "./routes/chat"
import { ttsRoute } from "./routes/tts"
import { hintRoute } from "./routes/hint"
import { debriefRoute } from "./routes/debrief"
import { sessionsRoute } from "./routes/sessions"
import { progressRoute } from "./routes/progress"

runMigrations()
await startNativeServices()

new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(transcribeRoute)
  .use(chatRoute)
  .use(ttsRoute)
  .use(hintRoute)
  .use(debriefRoute)
  .use(sessionsRoute)
  .use(progressRoute)
  .listen(config.port)

console.log(
  `Server running at http://localhost:${config.port} (AI_MODE=${config.aiMode})`
)
