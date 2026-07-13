import { join, normalize } from "node:path"
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
import { warmupRoute } from "./routes/warmup"

runMigrations()
await startNativeServices()

const api = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(transcribeRoute)
  .use(chatRoute)
  .use(ttsRoute)
  .use(hintRoute)
  .use(debriefRoute)
  .use(sessionsRoute)
  .use(progressRoute)
  .use(warmupRoute)

const distDir = join(import.meta.dir, "..", "dist")

const distFileOrIndex = async (path: string) => {
  const filePath = normalize(join(distDir, path))
  if (filePath.startsWith(distDir + "/")) {
    const file = Bun.file(filePath)
    if (await file.exists()) return file
  }
  return Bun.file(join(distDir, "index.html"))
}

const app = new Elysia().use(api)

if (config.serveStatic) {
  app.get("/*", ({ path }) => distFileOrIndex(path))
}

app.listen(config.port)

const url = `http://localhost:${config.port}`
console.log(`Server running at ${url} (AI_MODE=${config.aiMode})`)

// Auto-open only for a human-launched `bun start`, not scripted runs
if (config.serveStatic && process.platform === "darwin" && process.stdout.isTTY) {
  Bun.spawn(["open", url])
}
