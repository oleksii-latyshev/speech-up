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
}

export interface ReviewData {
  overview: string
  corrections: { you: string; better: string }[]
  vocabulary: string[]
  praise: string
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
}
