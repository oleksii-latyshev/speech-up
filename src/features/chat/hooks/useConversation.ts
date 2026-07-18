import { useCallback, useEffect, useRef, useState } from "react"
import {
  createSession,
  endSession,
  fetchWarmup,
  requestHints,
  saveTurn,
  streamChat,
  transcribe,
} from "@/core/api"
import type { TtsPlayer } from "@/core/audio"
import { useVoiceCapture, type CaptureStatus } from "@/core/capture"
import {
  hasUserSpoken,
  historyFromTurns,
  type LessonPlan,
  type ScenarioId,
  type Turn,
  type WarmupPhrase,
} from "@/core/session"
import type { Settings } from "@/core/settings"
import { phraseUsedIn } from "../helpers/warmupMatch"

export type ConversationPhase = "transcribing" | "thinking" | null

export interface CaptureControls {
  status: CaptureStatus
  startAuto: () => void
  stopAuto: () => void
  pttStart: () => void
  pttStop: () => void
}

export interface Conversation {
  scenario: ScenarioId | null
  sessionId: number | null
  plan: LessonPlan | null
  turns: Turn[]
  phase: ConversationPhase
  pendingTranscript: string | null
  streamingText: string | null
  suggestions: string[] | null
  hintLoading: boolean
  isStarting: boolean
  error: string | null
  hasSpoken: boolean
  warmup: WarmupPhrase[] | null
  warmupUsed: boolean[]
  capture: CaptureControls
  startScenario: (id: ScenarioId, plan?: LessonPlan) => Promise<void>
  requestHint: () => Promise<void>
  reset: () => void
}

export function useConversation(
  settings: Settings,
  player: TtsPlayer
): Conversation {
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [phase, setPhase] = useState<ConversationPhase>(null)
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(
    null
  )
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warmup, setWarmup] = useState<WarmupPhrase[] | null>(null)
  const [warmupUsed, setWarmupUsed] = useState<boolean[]>([])

  // Latest values for callbacks that outlive a render (capture -> transcribe -> chat)
  const turnsRef = useRef(turns)
  const scenarioRef = useRef(scenario)
  const sessionIdRef = useRef(sessionId)
  const planRef = useRef(plan)
  const settingsRef = useRef(settings)
  const playerRef = useRef(player)
  const warmupRef = useRef(warmup)
  useEffect(() => {
    turnsRef.current = turns
    scenarioRef.current = scenario
    sessionIdRef.current = sessionId
    planRef.current = plan
    settingsRef.current = settings
    playerRef.current = player
    warmupRef.current = warmup
  })

  // Persistence is best-effort: a DB hiccup must never interrupt practice
  const persistTurn = (turn: Turn) => {
    const id = sessionIdRef.current
    if (id != null)
      void saveTurn(id, turn).catch((err) =>
        console.warn("Failed to persist turn:", err)
      )
  }

  const speak = (text: string) => {
    const { voiceEnabled, voice } = settingsRef.current
    if (voiceEnabled) void playerRef.current.play(text, voice)
  }

  const fail = (err: unknown) =>
    setError(err instanceof Error ? err.message : "Unknown error")

  const warmupTexts = () => warmupRef.current?.map((p) => p.text)

  const markWarmupUsed = (transcript: string) => {
    const phrases = warmupRef.current
    if (!phrases) return
    setWarmupUsed((prev) =>
      prev.map((used, i) => used || phraseUsedIn(phrases[i].text, transcript))
    )
  }

  const handleAudioReady = useCallback(async (blob: Blob) => {
    const activeScenario = scenarioRef.current
    if (!activeScenario) return
    setError(null)
    setSuggestions(null)
    playerRef.current.stop()
    try {
      setPhase("transcribing")
      const transcript = await transcribe(blob)
      setPendingTranscript(transcript)
      markWarmupUsed(transcript)
      setPhase("thinking")
      setStreamingText("")
      const result = await streamChat(
        {
          transcript,
          history: historyFromTurns(turnsRef.current),
          scenario: activeScenario,
          difficulty: settingsRef.current.difficulty,
          warmup: warmupTexts(),
          focusTags: planRef.current?.focusTags,
        },
        {
          onDelta: setStreamingText,
          onResponse: speak,
        }
      )
      const turn = {
        transcript,
        response: result.response,
        coaching: result.coaching,
      }
      setTurns((prev) => [...prev, turn])
      persistTurn(turn)
      setSuggestions(result.suggestions?.length ? result.suggestions : null)
    } catch (err) {
      fail(err)
    } finally {
      setPhase(null)
      setPendingTranscript(null)
      setStreamingText(null)
    }
  }, [])

  const { status, startAuto, stopAuto, pttStart, pttStop, cancel } =
    useVoiceCapture({
      onAudioReady: handleAudioReady,
      silenceDuration: settings.silenceMs,
    })

  const startScenario = async (id: ScenarioId, lessonPlan?: LessonPlan) => {
    setScenario(id)
    setPlan(lessonPlan ?? null)
    planRef.current = lessonPlan ?? null
    setError(null)
    setIsStarting(true)
    setStreamingText("")
    const [newSessionId, warmupPhrases] = await Promise.all([
      createSession(id, settings.difficulty, lessonPlan?.id).catch((err) => {
        console.warn("Failed to create session:", err)
        return null
      }),
      lessonPlan
        ? Promise.resolve(
            lessonPlan.targetPhrases.map(
              (text): WarmupPhrase => ({ text, hint: "", source: "plan" })
            )
          )
        : fetchWarmup().catch((err) => {
            console.warn("Failed to fetch warm-up phrases:", err)
            return [] as WarmupPhrase[]
          }),
    ])
    setSessionId(newSessionId)
    sessionIdRef.current = newSessionId
    setWarmup(warmupPhrases.length ? warmupPhrases : null)
    warmupRef.current = warmupPhrases.length ? warmupPhrases : null
    setWarmupUsed(warmupPhrases.map(() => false))
    try {
      const result = await streamChat(
        {
          history: [],
          scenario: id,
          start: true,
          difficulty: settings.difficulty,
          warmup: warmupTexts(),
          focusTags: lessonPlan?.focusTags,
        },
        { onDelta: setStreamingText, onResponse: speak }
      )
      const opening = {
        transcript: "",
        response: result.response,
        coaching: "",
      }
      setTurns([opening])
      persistTurn(opening)
      setSuggestions(result.suggestions?.length ? result.suggestions : null)
    } catch (err) {
      fail(err)
    } finally {
      setIsStarting(false)
      setStreamingText(null)
    }
  }

  const requestHint = async () => {
    const activeScenario = scenarioRef.current
    if (!activeScenario || hintLoading) return
    setHintLoading(true)
    setError(null)
    try {
      const hints = await requestHints(activeScenario, historyFromTurns(turns))
      setSuggestions(hints.length ? hints : null)
    } catch (err) {
      fail(err)
    } finally {
      setHintLoading(false)
    }
  }

  const reset = () => {
    cancel()
    player.stop()
    const id = sessionIdRef.current
    if (id != null)
      void endSession(id).catch((err) =>
        console.warn("Failed to end session:", err)
      )
    setSessionId(null)
    sessionIdRef.current = null
    setScenario(null)
    setPlan(null)
    planRef.current = null
    setTurns([])
    setPhase(null)
    setPendingTranscript(null)
    setStreamingText(null)
    setSuggestions(null)
    setHintLoading(false)
    setIsStarting(false)
    setError(null)
    setWarmup(null)
    warmupRef.current = null
    setWarmupUsed([])
  }

  return {
    scenario,
    sessionId,
    plan,
    turns,
    phase,
    pendingTranscript,
    streamingText,
    suggestions,
    hintLoading,
    isStarting,
    error,
    hasSpoken: hasUserSpoken(turns),
    warmup,
    warmupUsed,
    capture: { status, startAuto, stopAuto, pttStart, pttStop },
    startScenario,
    requestHint,
    reset,
  }
}
