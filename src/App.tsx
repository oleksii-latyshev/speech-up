import { useState, useCallback, useRef, useEffect } from "react"
import { Mic, MicOff, Loader2, Settings, X, Volume2 } from "lucide-react"
import { useVoiceCapture, type CaptureStatus } from "@/hooks/useVoiceCapture"

type CaptureMode = "auto" | "ptt"
type Theme = "system" | "light" | "dark"

interface Turn {
  transcript: string
  response: string
  coaching: string
}

const VOICE_GROUPS = [
  {
    label: "American Female",
    voices: ["af_heart", "af_bella", "af_nova", "af_jessica", "af_sarah", "af_sky", "af_nicole", "af_alloy", "af_aoede", "af_jadzia", "af_kore", "af_river"],
  },
  {
    label: "American Male",
    voices: ["am_michael", "am_adam", "am_echo", "am_liam", "am_eric", "am_fenrir", "am_onyx", "am_puck"],
  },
  {
    label: "British Female",
    voices: ["bf_alice", "bf_emma", "bf_lily"],
  },
  {
    label: "British Male",
    voices: ["bm_george", "bm_daniel", "bm_lewis", "bm_fable"],
  },
] as const

const DEFAULT_VOICE = "af_heart"
const VOICE_STORAGE_KEY = "speech-up:voice"
const THEME_STORAGE_KEY = "speech-up:theme"
const VOICE_PREVIEW_TEXT = "Hello! I'm your English conversation partner. Let's practice together."

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const dark = theme === "dark" || (theme === "system" && prefersDark)
  document.documentElement.classList.toggle("dark", dark)
}

function formatVoiceName(v: string) {
  const name = v.split("_").slice(1).join("_")
  return name.charAt(0).toUpperCase() + name.slice(1)
}

const STATUS_LABEL: Record<CaptureStatus, string> = {
  idle: "Idle",
  listening: "Listening…",
  speaking: "Speaking",
  processing: "Processing…",
}

const STATUS_COLOR: Record<CaptureStatus, string> = {
  idle: "text-muted-foreground",
  listening: "text-blue-400",
  speaking: "text-green-400",
  processing: "text-yellow-400",
}

async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append("audio", blob, "audio.webm")
  const res = await fetch("/api/transcribe", { method: "POST", body: form })
  if (!res.ok) throw new Error(`STT error ${res.status}`)
  return ((await res.json()) as { transcript: string }).transcript
}

async function sendChat(
  transcript: string,
  history: { role: string; content: string }[],
): Promise<{ response: string; coaching: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, history }),
  })
  if (!res.ok) throw new Error(`LLM error ${res.status}`)
  return res.json()
}

function historyFromTurns(turns: Turn[]) {
  return turns.flatMap((t) => [
    { role: "user", content: t.transcript },
    { role: "assistant", content: t.response },
  ])
}

export default function App() {
  const [mode, setMode] = useState<CaptureMode>("auto")
  const [voice, setVoice] = useState<string>(
    () => localStorage.getItem(VOICE_STORAGE_KEY) ?? DEFAULT_VOICE,
  )
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) ?? "system",
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const turnsRef = useRef<Turn[]>([])
  const voiceRef = useRef<string>(voice)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  turnsRef.current = turns
  voiceRef.current = voice

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
    }
  }

  const playTTS = useCallback(async (text: string, voiceOverride?: string) => {
    stopAudio()
    setIsPlaying(true)
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceOverride ?? voiceRef.current }),
      })
      if (!res.ok) throw new Error(`TTS error ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); setIsPlaying(false); audioRef.current = null }
      audio.onerror = () => { URL.revokeObjectURL(url); setIsPlaying(false); audioRef.current = null }
      await audio.play()
    } catch {
      setIsPlaying(false)
    }
  }, [])

  const handleVoiceChange = (v: string) => {
    setVoice(v)
    localStorage.setItem(VOICE_STORAGE_KEY, v)
  }

  const handleThemeChange = (t: Theme) => {
    setTheme(t)
    localStorage.setItem(THEME_STORAGE_KEY, t)
  }

  const handleVoiceClick = (v: string) => {
    handleVoiceChange(v)
    playTTS(VOICE_PREVIEW_TEXT, v)
  }

  const handleAudioReady = useCallback(async (blob: Blob) => {
    setError(null)
    stopAudio()
    try {
      const transcript = await transcribeAudio(blob)
      const { response, coaching } = await sendChat(
        transcript,
        historyFromTurns(turnsRef.current),
      )
      setTurns((prev) => [...prev, { transcript, response, coaching }])
      await playTTS(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [playTTS])

  const { status, startAuto, stopAuto, pttStart, pttStop } = useVoiceCapture({
    onAudioReady: handleAudioReady,
  })

  const isActive = status === "listening" || status === "speaking"
  const isProcessing = status === "processing"
  const micDisabled = isProcessing || isPlaying

  const handleAutoClick = () => {
    if (isPlaying) { stopAudio(); return }
    if (status === "idle") startAuto()
    else if (isActive) stopAuto()
  }

  return (
    <div className="flex h-svh flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h1 className="font-semibold tracking-tight">Speech Up</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {(["auto", "ptt"] as CaptureMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { if (status === "idle" && !isPlaying) setMode(m) }}
                disabled={status !== "idle" || isPlaying}
                className={[
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {m === "auto" ? "Auto" : "Hold"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "ptt"
              ? "Hold the button below and start speaking"
              : "Press the mic below and start speaking"}
          </p>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2">
                <p className="text-sm text-primary-foreground">{turn.transcript}</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2">
                <p className="text-sm">{turn.response}</p>
              </div>
            </div>
            {turn.coaching && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="text-xs text-amber-400">📝 {turn.coaching}</p>
              </div>
            )}
          </div>
        ))}

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      <div className="flex shrink-0 flex-col items-center gap-3 border-t px-4 py-4">
        {mode === "auto" ? (
          <button
            onClick={handleAutoClick}
            disabled={isProcessing}
            className={[
              "flex h-16 w-16 items-center justify-center rounded-full",
              "ring-4 transition-all focus:outline-none disabled:opacity-50",
              isPlaying
                ? "bg-violet-500 ring-violet-400/40 hover:bg-violet-600"
                : isActive
                  ? "bg-red-500 ring-red-400/40 hover:bg-red-600"
                  : "bg-primary ring-primary/30 hover:bg-primary/90",
            ].join(" ")}
            aria-label={isPlaying ? "Stop playback" : isActive ? "Stop listening" : "Start listening"}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : isPlaying ? (
              <Volume2 className="h-6 w-6 text-white" />
            ) : isActive ? (
              <MicOff className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>
        ) : (
          <button
            onPointerDown={() => { if (isPlaying) { stopAudio(); return }; pttStart() }}
            onPointerUp={pttStop}
            onPointerLeave={pttStop}
            disabled={isProcessing}
            className={[
              "flex h-16 w-16 items-center justify-center rounded-full",
              "touch-none select-none ring-4 transition-all focus:outline-none disabled:opacity-50",
              isPlaying
                ? "bg-violet-500 ring-violet-400/40"
                : status === "speaking"
                  ? "scale-95 bg-red-500 ring-red-400/40"
                  : "bg-primary ring-primary/30 hover:bg-primary/90",
            ].join(" ")}
            aria-label={isPlaying ? "Stop playback" : "Hold to speak"}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : isPlaying ? (
              <Volume2 className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>
        )}

        <p className={`text-xs font-medium transition-colors ${isPlaying ? "text-violet-400" : STATUS_COLOR[status]}`}>
          {isPlaying
            ? "Speaking… (tap to skip)"
            : mode === "ptt" && status === "idle"
              ? "Hold to speak"
              : STATUS_LABEL[status]}
        </p>
      </div>

      {/* Settings overlay */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Settings</h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
            {/* Theme */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Theme</h3>
              <div className="flex gap-2">
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors",
                      theme === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Voice */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">AI Voice</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click any voice to select and preview it.
                </p>
              </div>

              {VOICE_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {group.voices.map((v) => (
                      <button
                        key={v}
                        onClick={() => handleVoiceClick(v)}
                        disabled={isProcessing}
                        className={[
                          "rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left",
                          voice === v
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                          isPlaying && voice === v ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        {formatVoiceName(v)}
                        {isPlaying && voice === v && " ♪"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
