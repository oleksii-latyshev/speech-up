import { useState } from "react"
import { isDifficulty, type Difficulty } from "@/core/session"
import { DEFAULT_VOICE } from "./voices"

const KEYS = {
  voice: "speech-up:voice",
  voiceEnabled: "speech-up:voice-enabled",
  silenceMs: "speech-up:silence-ms",
  difficulty: "speech-up:difficulty",
}

export const MIN_SILENCE_MS = 1000
export const MAX_SILENCE_MS = 5000
const DEFAULT_SILENCE_MS = 2500

export interface Settings {
  voice: string
  setVoice: (v: string) => void
  voiceEnabled: boolean
  setVoiceEnabled: (on: boolean) => void
  silenceMs: number
  setSilenceMs: (ms: number) => void
  difficulty: Difficulty
  setDifficulty: (d: Difficulty) => void
}

function usePersisted<T>(
  key: string,
  parse: (stored: string | null) => T,
  serialize: (value: T) => string
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => parse(localStorage.getItem(key)))
  const set = (next: T) => {
    setValue(next)
    localStorage.setItem(key, serialize(next))
  }
  return [value, set]
}

export function useSettings(): Settings {
  const [voice, setVoice] = usePersisted(
    KEYS.voice,
    (s) => s ?? DEFAULT_VOICE,
    (v) => v
  )
  const [voiceEnabled, setVoiceEnabled] = usePersisted(
    KEYS.voiceEnabled,
    (s) => s !== "off",
    (on) => (on ? "on" : "off")
  )
  const [silenceMs, setSilenceMs] = usePersisted(
    KEYS.silenceMs,
    (s) => {
      const n = Number(s)
      return Number.isFinite(n) && n >= MIN_SILENCE_MS && n <= MAX_SILENCE_MS
        ? n
        : DEFAULT_SILENCE_MS
    },
    String
  )
  const [difficulty, setDifficulty] = usePersisted<Difficulty>(
    KEYS.difficulty,
    (s) => (s && isDifficulty(s) ? s : "easy"),
    (d) => d
  )

  return {
    voice,
    setVoice,
    voiceEnabled,
    setVoiceEnabled,
    silenceMs,
    setSilenceMs,
    difficulty,
    setDifficulty,
  }
}
