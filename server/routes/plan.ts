import { Elysia } from "elysia"
import { getOrGeneratePlan } from "../planner"

export const planRoute = new Elysia().get("/plan", async () => ({
  plan: await getOrGeneratePlan(),
}))
