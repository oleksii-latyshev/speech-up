import { count, desc, eq, isNotNull, isNull } from "drizzle-orm"
import type {
  LessonPlan,
  LessonSummary,
  PlanCheck,
} from "../../src/core/session/contract"
import type { PlanContextRows, PlanDraft } from "../helpers/lessonPlan"
import { db } from "./index"
import { corrections, plans, sessions, vocabulary } from "./schema"

const toPlan = (row: typeof plans.$inferSelect): LessonPlan => ({
  id: row.id,
  scenario: row.scenario,
  focusTags: row.focusTags,
  focusNote: row.focusNote,
  targetPhrases: row.targetPhrases,
  microGoal: row.microGoal,
  createdAt: row.createdAt,
})

export async function latestPendingPlan(): Promise<LessonPlan | null> {
  const [row] = await db
    .select()
    .from(plans)
    .where(isNull(plans.focusResult))
    .orderBy(desc(plans.id))
    .limit(1)
  return row ? toPlan(row) : null
}

export async function insertPlan(draft: PlanDraft): Promise<LessonPlan> {
  const [row] = await db
    .insert(plans)
    .values({ ...draft, createdAt: Date.now() })
    .returning()
  return toPlan(row)
}

export async function getPlan(planId: number): Promise<LessonPlan | null> {
  const [row] = await db.select().from(plans).where(eq(plans.id, planId))
  return row ? toPlan(row) : null
}

export async function linkPlanToSession(
  planId: number,
  sessionId: number
): Promise<void> {
  await db.update(plans).set({ sessionId }).where(eq(plans.id, planId))
}

export async function deletePendingPlans(): Promise<void> {
  await db.delete(plans).where(isNull(plans.focusResult))
}

const LESSON_HISTORY_LIMIT = 20

export async function completedPlans(): Promise<LessonSummary[]> {
  const rows = await db
    .select()
    .from(plans)
    .where(isNotNull(plans.focusResult))
    .orderBy(desc(plans.id))
    .limit(LESSON_HISTORY_LIMIT)
  return rows.map((r) => ({
    id: r.id,
    scenario: r.scenario,
    focusTags: r.focusTags,
    microGoal: r.microGoal,
    focusResult: r.focusResult ?? "",
    goalAchieved: r.goalAchieved === true,
    createdAt: r.createdAt,
  }))
}

export async function countCompletedPlans(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(plans)
    .where(isNotNull(plans.focusResult))
  return row.n
}

export async function savePlanResult(
  planId: number,
  check: PlanCheck
): Promise<void> {
  await db
    .update(plans)
    .set({ focusResult: check.focusResult, goalAchieved: check.goalAchieved })
    .where(eq(plans.id, planId))
}

const CONTEXT_SESSIONS = 10
const CONTEXT_CORRECTIONS = 20
const CONTEXT_VOCABULARY = 12

export async function loadPlanContextRows(): Promise<PlanContextRows> {
  const [sessionRows, correctionRows, vocabularyRows, previousPlans] =
    await Promise.all([
      db
        .select({ scenario: sessions.scenario, startedAt: sessions.startedAt })
        .from(sessions)
        .orderBy(desc(sessions.startedAt))
        .limit(CONTEXT_SESSIONS),
      db
        .select({
          you: corrections.you,
          better: corrections.better,
          tag: corrections.tag,
        })
        .from(corrections)
        .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
        .orderBy(desc(sessions.startedAt), desc(corrections.id))
        .limit(CONTEXT_CORRECTIONS),
      db
        .select({ phrase: vocabulary.phrase })
        .from(vocabulary)
        .innerJoin(sessions, eq(vocabulary.sessionId, sessions.id))
        .orderBy(desc(sessions.startedAt), desc(vocabulary.id))
        .limit(CONTEXT_VOCABULARY),
      db
        .select()
        .from(plans)
        .where(isNotNull(plans.focusResult))
        .orderBy(desc(plans.id))
        .limit(1),
    ])
  return {
    sessions: sessionRows,
    corrections: correctionRows,
    vocabulary: vocabularyRows.map((r) => r.phrase),
    previousPlan: previousPlans[0] ?? null,
  }
}
