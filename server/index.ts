import { Elysia } from "elysia"

const PORT = Number(process.env.PORT ?? 3001)

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(PORT)

console.log(`Server running at http://localhost:${PORT}`)
