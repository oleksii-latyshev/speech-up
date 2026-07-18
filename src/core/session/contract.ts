// The client/server contract: ids, wire types, and guards shared by both sides.
// server/ imports this file by relative path — keep it pure TypeScript with no
// imports, no DOM, and no React.

export const SCENARIO_IDS = [
  "interview-frontend",
  "interview-backend",
  "interview-fullstack",
  "interview-general",
  "standup",
  "tech-discussion",
  "casual",
] as const

export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const DIFFICULTY_IDS = ["easy", "medium", "hard"] as const

export type Difficulty = (typeof DIFFICULTY_IDS)[number]

export const isScenarioId = (v: string): v is ScenarioId =>
  (SCENARIO_IDS as readonly string[]).includes(v)

export const isDifficulty = (v: string): v is Difficulty =>
  (DIFFICULTY_IDS as readonly string[]).includes(v)

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export type ChatEvent =
  | { t: "delta"; x: string }
  | { t: "response"; x: string }
  | { t: "coaching"; x: string }
  | { t: "suggestions"; x: string[] }
  | { t: "done" }
  | { t: "error"; x: string }

export interface ChatRequest {
  transcript?: string
  history: ChatMessage[]
  scenario: ScenarioId
  start?: boolean
  difficulty: Difficulty
  warmup?: string[]
  focusTags?: ErrorTag[]
}

export interface WarmupPhrase {
  text: string
  hint: string // the original phrase for corrections, the explanation for vocabulary
  source: "correction" | "vocabulary" | "plan"
}

export const ERROR_TAG_IDS = [
  "articles",
  "tenses",
  "prepositions",
  "word-order",
  "vocabulary",
  "phrasing",
  "agreement",
  "other",
] as const

export type ErrorTag = (typeof ERROR_TAG_IDS)[number]

export const isErrorTag = (v: string): v is ErrorTag =>
  (ERROR_TAG_IDS as readonly string[]).includes(v)

export interface Correction {
  you: string
  better: string
  tag?: ErrorTag
}

export interface ReviewData {
  overview: string
  corrections: Correction[]
  vocabulary: string[]
  praise: string
  planCheck?: PlanCheck
}

// Lesson mode: the adaptive plan for the next session, generated from history.
// focusNote and microGoal are coach content and therefore Russian.
export interface LessonPlan {
  id: number
  scenario: ScenarioId
  focusTags: ErrorTag[]
  focusNote: string
  targetPhrases: string[]
  microGoal: string
  createdAt: number
}

export interface PlanCheck {
  focusResult: string // Russian: how the lesson's focus went
  goalAchieved: boolean
}

// A finished lesson (a plan whose debrief filled in the outcome).
export interface LessonSummary {
  id: number
  scenario: ScenarioId
  focusTags: ErrorTag[]
  microGoal: string
  focusResult: string
  goalAchieved: boolean
  createdAt: number
}

export interface Turn {
  transcript: string // empty for the AI's opening turn
  response: string
  coaching: string
}

export interface SessionSummary {
  id: number
  scenario: ScenarioId
  difficulty: Difficulty
  startedAt: number
  endedAt: number | null
  turnCount: number
  lesson: boolean
}

export interface DayActivity {
  date: string // local YYYY-MM-DD
  sessions: number
  minutes: number
}

export interface ErrorTagCount {
  tag: ErrorTag
  count: number
}

export interface ProgressStats {
  sessionCount: number
  practiceMs: number
  wordCount: number
  utteranceCount: number
  avgUtteranceWords: number
  streakDays: number
  days: DayActivity[]
  errorTags: ErrorTagCount[]
}
