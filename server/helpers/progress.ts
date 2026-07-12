import type {
  DayActivity,
  ErrorTag,
  ErrorTagCount,
  ProgressStats,
} from "../../src/core/session/contract"

export interface SessionRow {
  id: number
  startedAt: number
  endedAt: number | null
}

export interface TurnRow {
  sessionId: number
  transcript: string
  createdAt: number
}

export interface ProgressRows {
  sessions: SessionRow[]
  turns: TurnRow[]
  tags: ErrorTag[]
}

export const ACTIVITY_DAYS = 14

export const dayKey = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const daysAgo = (now: number, n: number): Date => {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n)
}

const countWords = (text: string): number =>
  text.trim() === "" ? 0 : text.trim().split(/\s+/).length

const sessionEnd = (session: SessionRow, turns: TurnRow[]): number => {
  if (session.endedAt != null) return session.endedAt
  const lastTurn = turns.reduce(
    (max, t) => Math.max(max, t.createdAt),
    session.startedAt
  )
  return lastTurn
}

const countStreak = (activeDays: Set<string>, now: number): number => {
  let offset = activeDays.has(dayKey(now)) ? 0 : 1
  let streak = 0
  while (activeDays.has(dayKey(daysAgo(now, offset).getTime()))) {
    streak += 1
    offset += 1
  }
  return streak
}

const buildDays = (
  sessions: SessionRow[],
  durations: Map<number, number>,
  now: number
): DayActivity[] => {
  const byDay = new Map<string, { sessions: number; ms: number }>()
  for (const s of sessions) {
    const key = dayKey(s.startedAt)
    const entry = byDay.get(key) ?? { sessions: 0, ms: 0 }
    entry.sessions += 1
    entry.ms += durations.get(s.id) ?? 0
    byDay.set(key, entry)
  }
  return Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const key = dayKey(daysAgo(now, ACTIVITY_DAYS - 1 - i).getTime())
    const entry = byDay.get(key)
    return {
      date: key,
      sessions: entry?.sessions ?? 0,
      minutes: entry ? Math.round(entry.ms / 60000) : 0,
    }
  })
}

const countTags = (tags: ErrorTag[]): ErrorTagCount[] => {
  const counts = new Map<ErrorTag, number>()
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function computeProgressStats(
  rows: ProgressRows,
  now: number
): ProgressStats {
  const turnsBySession = new Map<number, TurnRow[]>()
  for (const t of rows.turns) {
    const list = turnsBySession.get(t.sessionId) ?? []
    list.push(t)
    turnsBySession.set(t.sessionId, list)
  }

  const durations = new Map<number, number>()
  for (const s of rows.sessions) {
    const end = sessionEnd(s, turnsBySession.get(s.id) ?? [])
    durations.set(s.id, Math.max(0, end - s.startedAt))
  }

  const utterances = rows.turns.filter((t) => t.transcript.trim() !== "")
  const wordCount = utterances.reduce(
    (sum, t) => sum + countWords(t.transcript),
    0
  )

  const activeDays = new Set(rows.sessions.map((s) => dayKey(s.startedAt)))

  return {
    sessionCount: rows.sessions.length,
    practiceMs: [...durations.values()].reduce((sum, ms) => sum + ms, 0),
    wordCount,
    utteranceCount: utterances.length,
    avgUtteranceWords:
      utterances.length === 0 ? 0 : Math.round(wordCount / utterances.length),
    streakDays: countStreak(activeDays, now),
    days: buildDays(rows.sessions, durations, now),
    errorTags: countTags(rows.tags),
  }
}
