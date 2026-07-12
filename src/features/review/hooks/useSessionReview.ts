import { useState } from "react"
import { requestDebrief } from "@/core/api"
import type { ReviewData, ScenarioId, Turn } from "@/core/session"

export interface SessionReviewState {
  open: boolean
  loading: boolean
  data: ReviewData | null
  error: string | null
  show: (scenario: ScenarioId, turns: Turn[]) => void
  retry: () => void
  close: () => void
}

export function useSessionReview(): SessionReviewState {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<{
    scenario: ScenarioId
    turns: Turn[]
  } | null>(null)

  const fetchReview = async (scenario: ScenarioId, turns: Turn[]) => {
    setLoading(true)
    setError(null)
    try {
      setData(await requestDebrief(scenario, turns))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const show = (scenario: ScenarioId, turns: Turn[]) => {
    setOpen(true)
    setData(null)
    setRequest({ scenario, turns })
    void fetchReview(scenario, turns)
  }

  const retry = () => {
    if (request) void fetchReview(request.scenario, request.turns)
  }

  const close = () => setOpen(false)

  return { open, loading, data, error, show, retry, close }
}
