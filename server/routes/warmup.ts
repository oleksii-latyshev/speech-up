import { Elysia } from "elysia"
import { loadWarmupRows } from "../db"
import { selectWarmupPhrases } from "../helpers/warmup"

export const warmupRoute = new Elysia().get("/warmup", async () => ({
  phrases: selectWarmupPhrases(await loadWarmupRows()),
}))
