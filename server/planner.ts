import type { LessonPlan } from "../src/core/session/contract"
import { insertPlan, latestPendingPlan, loadPlanContextRows } from "./db"
import {
  fallbackPlan,
  formatPlanContext,
  hasHistory,
  sanitizePlan,
  type PlanContextRows,
  type PlanDraft,
} from "./helpers/lessonPlan"
import { extractJsonObject } from "./helpers/modelJson"
import { PLAN_SYSTEM } from "./helpers/prompts"
import { chatCompletion } from "./ollama"

async function draftFromModel(rows: PlanContextRows): Promise<PlanDraft> {
  try {
    const raw = await chatCompletion([
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: formatPlanContext(rows) },
    ])
    return sanitizePlan(extractJsonObject(raw), rows)
  } catch (err) {
    console.warn("Plan generation failed, using fallback plan:", err)
    return fallbackPlan(rows)
  }
}

// One generation at a time: a GET while the post-debrief pregeneration is
// still running must join it, not produce a second plan.
let inFlight: Promise<LessonPlan> | null = null

export function getOrGeneratePlan(): Promise<LessonPlan> {
  inFlight ??= (async () => {
    const pending = await latestPendingPlan()
    if (pending) return pending
    const rows = await loadPlanContextRows()
    const draft = hasHistory(rows)
      ? await draftFromModel(rows)
      : fallbackPlan(rows)
    return insertPlan(draft)
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

export function pregenerateNextPlan(): void {
  void getOrGeneratePlan().catch((err) =>
    console.warn("Plan pregeneration failed:", err)
  )
}
