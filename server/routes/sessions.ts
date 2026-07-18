import { Elysia, t } from "elysia"
import { isDifficulty, isScenarioId } from "../../src/core/session/contract"
import {
  addTurn,
  createSession,
  endSession,
  linkPlanToSession,
  listSessions,
} from "../db"

export const sessionsRoute = new Elysia()
  .get("/sessions", () => listSessions())
  .post(
    "/sessions",
    async ({ body, status }) => {
      if (!isScenarioId(body.scenario) || !isDifficulty(body.difficulty)) {
        return status(400, "Unknown scenario or difficulty")
      }
      const id = await createSession(body.scenario, body.difficulty)
      if (body.planId != null) await linkPlanToSession(body.planId, id)
      return { id }
    },
    {
      body: t.Object({
        scenario: t.String(),
        difficulty: t.String(),
        planId: t.Optional(t.Number()),
      }),
    }
  )
  .post(
    "/sessions/:id/turns",
    async ({ params, body }) => {
      await addTurn(params.id, body)
      return { ok: true }
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        transcript: t.String(),
        response: t.String(),
        coaching: t.String(),
      }),
    }
  )
  .post(
    "/sessions/:id/end",
    async ({ params }) => {
      await endSession(params.id)
      return { ok: true }
    },
    { params: t.Object({ id: t.Numeric() }) }
  )
