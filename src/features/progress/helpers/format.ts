import type { ErrorTag } from "@/core/session"

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  articles: "Articles",
  tenses: "Verb tenses",
  prepositions: "Prepositions",
  "word-order": "Word order",
  vocabulary: "Word choice",
  phrasing: "Natural phrasing",
  agreement: "Agreement",
  other: "Other",
}

export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 1) return ms > 0 ? "<1m" : "0m"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export const parseDayKey = (date: string): Date => {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export const dayTickLabel = (date: string): string =>
  String(parseDayKey(date).getDate())

export const dayTooltipLabel = (date: string): string =>
  parseDayKey(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const sessionDateLabel = (
  ts: number,
  now: number = Date.now()
): string => {
  const date = new Date(ts)
  const today = new Date(now)
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1
  )
  if (sameDay(date, today)) return "Today"
  if (sameDay(date, yesterday)) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
