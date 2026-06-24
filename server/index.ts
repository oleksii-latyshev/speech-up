import { Elysia } from "elysia"
import { config } from "./config"
import { transcribeRoute } from "./routes/transcribe"

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(transcribeRoute)
  .listen(config.port)

console.log(`Server running at http://localhost:${config.port}`)
