import {
  SCENARIO_IDS,
  isErrorTag,
  isScenarioId,
  type ErrorTag,
  type LessonPlan,
  type PlanCheck,
  type ScenarioId,
} from "../../src/core/session/contract"
import { parseVocabularyEntry } from "./warmup"

export interface PlanContextRows {
  sessions: { scenario: ScenarioId; startedAt: number }[] // newest first
  corrections: { you: string; better: string; tag: ErrorTag | null }[] // newest first
  vocabulary: string[] // newest first
  previousPlan: {
    scenario: ScenarioId
    focusTags: ErrorTag[]
    microGoal: string
    focusResult: string | null
    goalAchieved: boolean | null
  } | null
}

export type PlanDraft = Pick<
  LessonPlan,
  "scenario" | "focusTags" | "focusNote" | "targetPhrases" | "microGoal"
>

const MAX_FOCUS_TAGS = 2
const MAX_TARGET_PHRASES = 4
const MAX_PHRASE_WORDS = 12

const wordCount = (text: string): number =>
  text.trim() === "" ? 0 : text.trim().split(/\s+/).length

const normalize = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, " ").trim()

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalize(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const hasHistory = (rows: PlanContextRows): boolean =>
  rows.sessions.length > 0

// Fallback coach content is Russian by design, like the prompt templates:
// the plan card shows it to the user as-is when the model can't produce one.
const FIRST_LESSON_NOTE =
  "Это твоё первое занятие — цель простая: разговориться и не бояться пауз. Ошибки сейчас не важны, разберём их после."
const FALLBACK_NOTE =
  "План составлен по твоим последним занятиям: закрепляем фразы из прошлых разборов и следим за повторяющимися ошибками."
const FALLBACK_GOAL =
  "Отвечай развёрнуто — минимум два-три предложения на каждый вопрос."

const fallbackScenario = (
  sessions: PlanContextRows["sessions"]
): ScenarioId => {
  if (sessions.length === 0) return "casual"
  const lastPracticed = new Map<ScenarioId, number>()
  for (const s of sessions)
    if (!lastPracticed.has(s.scenario))
      lastPracticed.set(s.scenario, s.startedAt)
  const never = SCENARIO_IDS.find((id) => !lastPracticed.has(id))
  if (never) return never
  return [...lastPracticed.entries()].sort((a, b) => a[1] - b[1])[0][0]
}

const topErrorTags = (
  corrections: PlanContextRows["corrections"]
): ErrorTag[] => {
  const counts = new Map<ErrorTag, number>()
  for (const c of corrections)
    if (c.tag) counts.set(c.tag, (counts.get(c.tag) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FOCUS_TAGS)
    .map(([tag]) => tag)
}

const phrasePool = (rows: PlanContextRows): string[] =>
  [
    ...rows.corrections.map((c) => c.better.trim()),
    ...rows.vocabulary.map((v) => parseVocabularyEntry(v).text),
  ].filter(Boolean)

// The model is told to reuse phrases from the history but tends to invent
// its own — only history-backed phrases keep the spaced-repetition loop honest.
const fromHistory = (phrase: string, pool: string[]): boolean => {
  const key = normalize(phrase)
  return pool.some((candidate) => {
    const c = normalize(candidate)
    return c.includes(key) || key.includes(c)
  })
}

const fallbackPhrases = (rows: PlanContextRows): string[] =>
  dedupe(
    phrasePool(rows).filter((p) => wordCount(p) <= MAX_PHRASE_WORDS)
  ).slice(0, MAX_TARGET_PHRASES - 1)

export function fallbackPlan(rows: PlanContextRows): PlanDraft {
  return {
    scenario: fallbackScenario(rows.sessions),
    focusTags: topErrorTags(rows.corrections),
    focusNote: hasHistory(rows) ? FALLBACK_NOTE : FIRST_LESSON_NOTE,
    targetPhrases: fallbackPhrases(rows),
    microGoal: FALLBACK_GOAL,
  }
}

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : []

export function sanitizePlan(raw: unknown, rows: PlanContextRows): PlanDraft {
  const fallback = fallbackPlan(rows)
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >

  const scenario = asText(obj.scenario)
  const focusTags = dedupe(asStringArray(obj.focusTags).map((t) => t.trim()))
    .filter(isErrorTag)
    .slice(0, MAX_FOCUS_TAGS)
  const pool = phrasePool(rows)
  const targetPhrases = dedupe(
    asStringArray(obj.targetPhrases)
      .map((p) => p.trim())
      .filter(
        (p) =>
          p && wordCount(p) <= MAX_PHRASE_WORDS && fromHistory(p, pool)
      )
  ).slice(0, MAX_TARGET_PHRASES)

  return {
    scenario: isScenarioId(scenario) ? scenario : fallback.scenario,
    focusTags: focusTags.length ? focusTags : fallback.focusTags,
    focusNote: asText(obj.focusNote) || fallback.focusNote,
    targetPhrases: targetPhrases.length
      ? targetPhrases
      : fallback.targetPhrases,
    microGoal: asText(obj.microGoal) || fallback.microGoal,
  }
}

export function sanitizePlanCheck(raw: unknown): PlanCheck | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const focusResult =
    typeof obj.focusResult === "string" ? obj.focusResult.trim() : ""
  if (!focusResult) return null
  return { focusResult, goalAchieved: obj.goalAchieved === true }
}

const daysAgoLabel = (ts: number, now: number): string => {
  const days = Math.max(0, Math.floor((now - ts) / 86_400_000))
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  return `${days} days ago`
}

export function formatPlanContext(
  rows: PlanContextRows,
  now: number = Date.now()
): string {
  const sections = [
    `Recent sessions (newest first):\n${rows.sessions
      .map((s) => `- ${s.scenario} (${daysAgoLabel(s.startedAt, now)})`)
      .join("\n")}`,
  ]
  if (rows.corrections.length)
    sections.push(
      `Recent mistakes (his phrase -> natural phrasing [category]):\n${rows.corrections
        .map(
          (c) => `- "${c.you}" -> "${c.better}"${c.tag ? ` [${c.tag}]` : ""}`
        )
        .join("\n")}`
    )
  if (rows.vocabulary.length)
    sections.push(
      `Vocabulary from past reviews:\n${rows.vocabulary
        .map((v) => `- ${v}`)
        .join("\n")}`
    )
  if (rows.previousPlan) {
    const p = rows.previousPlan
    sections.push(
      `Previous lesson: scenario ${p.scenario}, focus [${p.focusTags.join(", ")}], goal "${p.microGoal}".\n` +
        `Coach verdict: ${p.focusResult || "unknown"} (goal ${p.goalAchieved ? "achieved" : "NOT achieved"})`
    )
  }
  return sections.join("\n\n")
}
