import { Elysia } from "elysia"
import type { LessonPlan } from "../../src/core/session/contract"
import { completedPlans, countCompletedPlans } from "../db"
import { getOrGeneratePlan, regeneratePlan } from "../planner"

const withLessonNumber = async (plan: LessonPlan) => ({
  plan,
  lessonNumber: (await countCompletedPlans()) + 1,
})

export const planRoute = new Elysia()
  .get("/plan", async () => withLessonNumber(await getOrGeneratePlan()))
  .post("/plan/regenerate", async () =>
    withLessonNumber(await regeneratePlan())
  )
  .get("/lessons", async () => ({ lessons: await completedPlans() }))
