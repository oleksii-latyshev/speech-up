import { useCallback, useEffect, useRef, useState } from "react"
import {
  fetchLessonPlan,
  regenerateLessonPlan,
  type LessonPlanResult,
} from "@/core/api"
import type { LessonPlan } from "@/core/session"

export interface LessonPlanState {
  plan: LessonPlan | null
  lessonNumber: number | null
  loading: boolean
  error: string | null
  retry: () => void
  regenerate: () => void
}

export function useLessonPlan(enabled: boolean): LessonPlanState {
  const [result, setResult] = useState<LessonPlanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    (request: () => Promise<LessonPlanResult>) =>
      request()
        .then(setResult)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Unknown error")
        )
        .finally(() => setLoading(false)),
    []
  )

  const restart = useCallback(
    (request: () => Promise<LessonPlanResult>) => {
      setLoading(true)
      setError(null)
      void run(request)
    },
    [run]
  )

  const startedRef = useRef(false)
  useEffect(() => {
    if (enabled && !startedRef.current) {
      startedRef.current = true
      void run(fetchLessonPlan)
    }
  }, [enabled, run])

  return {
    plan: result?.plan ?? null,
    lessonNumber: result?.lessonNumber ?? null,
    loading,
    error,
    retry: () => restart(fetchLessonPlan),
    regenerate: () => restart(regenerateLessonPlan),
  }
}
