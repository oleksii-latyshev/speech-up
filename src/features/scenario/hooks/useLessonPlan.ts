import { useCallback, useEffect, useRef, useState } from "react"
import { fetchLessonPlan } from "@/core/api"
import type { LessonPlan } from "@/core/session"

export interface LessonPlanState {
  plan: LessonPlan | null
  loading: boolean
  error: string | null
  retry: () => void
}

export function useLessonPlan(enabled: boolean): LessonPlanState {
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    () =>
      fetchLessonPlan()
        .then(setPlan)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Unknown error")
        )
        .finally(() => setLoading(false)),
    []
  )

  const retry = useCallback(() => {
    setLoading(true)
    setError(null)
    void load()
  }, [load])

  const startedRef = useRef(false)
  useEffect(() => {
    if (enabled && !startedRef.current) {
      startedRef.current = true
      void load()
    }
  }, [enabled, load])

  return { plan, loading, error, retry }
}
