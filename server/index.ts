import { Elysia } from "elysia"
import { config } from "./config"

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(config.port)

console.log(`Server running at http://localhost:${config.port}`)
