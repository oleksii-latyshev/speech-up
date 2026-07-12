import { useCallback, useEffect, useRef, useState } from "react"
import { requestHints, streamChat, transcribe } from "@/core/api"
import type { TtsPlayer } from "@/core/audio"
import { useVoiceCapture, type CaptureStatus } from "@/core/capture"
import {
  hasUserSpoken,
  historyFromTurns,
  type ScenarioId,
  type Turn,
} from "@/core/session"
import type { Settings } from "@/core/settings"

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
  turns: Turn[]
  phase: ConversationPhase
  pendingTranscript: string | null
  streamingText: string | null
  suggestions: string[] | null
  hintLoading: boolean
  isStarting: boolean
  error: string | null
  hasSpoken: boolean
  capture: CaptureControls
  startScenario: (id: ScenarioId) => Promise<void>
  requestHint: () => Promise<void>
  reset: () => void
}

export function useConversation(
  settings: Settings,
  player: TtsPlayer
): Conversation {
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
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

  // Latest values for callbacks that outlive a render (capture -> transcribe -> chat)
  const turnsRef = useRef(turns)
  const scenarioRef = useRef(scenario)
  const settingsRef = useRef(settings)
  const playerRef = useRef(player)
  useEffect(() => {
    turnsRef.current = turns
    scenarioRef.current = scenario
    settingsRef.current = settings
    playerRef.current = player
  })

  const speak = (text: string) => {
    const { voiceEnabled, voice } = settingsRef.current
    if (voiceEnabled) void playerRef.current.play(text, voice)
  }

  const fail = (err: unknown) =>
    setError(err instanceof Error ? err.message : "Unknown error")

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
      setPhase("thinking")
      setStreamingText("")
      const result = await streamChat(
        {
          transcript,
          history: historyFromTurns(turnsRef.current),
          scenario: activeScenario,
          difficulty: settingsRef.current.difficulty,
        },
        {
          onDelta: setStreamingText,
          onResponse: speak,
        }
      )
      setTurns((prev) => [
        ...prev,
        { transcript, response: result.response, coaching: result.coaching },
      ])
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

  const startScenario = async (id: ScenarioId) => {
    setScenario(id)
    setError(null)
    setIsStarting(true)
    setStreamingText("")
    try {
      const result = await streamChat(
        {
          history: [],
          scenario: id,
          start: true,
          difficulty: settings.difficulty,
        },
        { onDelta: setStreamingText, onResponse: speak }
      )
      setTurns([{ transcript: "", response: result.response, coaching: "" }])
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
    setScenario(null)
    setTurns([])
    setPhase(null)
    setPendingTranscript(null)
    setStreamingText(null)
    setSuggestions(null)
    setHintLoading(false)
    setIsStarting(false)
    setError(null)
  }

  return {
    scenario,
    turns,
    phase,
    pendingTranscript,
    streamingText,
    suggestions,
    hintLoading,
    isStarting,
    error,
    hasSpoken: hasUserSpoken(turns),
    capture: { status, startAuto, stopAuto, pttStart, pttStop },
    startScenario,
    requestHint,
    reset,
  }
}
