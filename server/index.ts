import { Elysia } from "elysia"
import { config } from "./config"
import { transcribeRoute } from "./routes/transcribe"
import { chatRoute } from "./routes/chat"
import { ttsRoute } from "./routes/tts"

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(transcribeRoute)
  .use(chatRoute)
  .use(ttsRoute)
  .listen(config.port)

console.log(`Server running at http://localhost:${config.port}`)
