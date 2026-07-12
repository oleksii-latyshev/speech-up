import { Elysia } from "elysia"
import { loadProgressRows } from "../db"
import { computeProgressStats } from "../helpers/progress"

export const progressRoute = new Elysia().get("/progress", async () =>
  computeProgressStats(await loadProgressRows(), Date.now())
)
