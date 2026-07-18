import { useCallback, useEffect, useState } from "react"
import { fetchLessons, fetchProgress, listSessions } from "@/core/api"
import type {
  LessonSummary,
  ProgressStats,
  SessionSummary,
} from "@/core/session"

export interface ProgressState {
  loading: boolean
  error: string | null
  stats: ProgressStats | null
  sessions: SessionSummary[]
  lessons: LessonSummary[]
  reload: () => void
}

export function useProgress(): ProgressState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ProgressStats | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [lessons, setLessons] = useState<LessonSummary[]>([])

  const load = useCallback(
    () =>
      Promise.all([fetchProgress(), listSessions(), fetchLessons()])
        .then(([nextStats, nextSessions, nextLessons]) => {
          setStats(nextStats)
          setSessions(nextSessions)
          setLessons(nextLessons)
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Unknown error")
        )
        .finally(() => setLoading(false)),
    []
  )

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    void load()
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  return { loading, error, stats, sessions, lessons, reload }
}
