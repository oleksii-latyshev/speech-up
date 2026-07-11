import { useState, useCallback, useRef, useEffect } from "react"
import { ClipboardCheck, Lightbulb, Mic, MicOff, Loader2, RotateCcw, Settings, X, Volume2 } from "lucide-react"
import { useVoiceCapture, type CaptureStatus } from "@/hooks/useVoiceCapture"
import { ScenarioPicker } from "@/components/ScenarioPicker"
import { SessionReview, type SessionReviewData } from "@/components/SessionReview"
import { scenarioTitle, type Difficulty, type ScenarioId } from "@/lib/scenarios"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type CaptureMode = "auto" | "ptt"
type Theme = "system" | "light" | "dark"

interface Turn {
  transcript: string // empty for the AI's opening turn
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
const DEFAULT_SILENCE_MS = 2500
const VOICE_STORAGE_KEY = "speech-up:voice"
const THEME_STORAGE_KEY = "speech-up:theme"
const SILENCE_STORAGE_KEY = "speech-up:silence-ms"
const DIFFICULTY_STORAGE_KEY = "speech-up:difficulty"
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

async function sendChat(body: {
  transcript?: string
  history: { role: string; content: string }[]
  scenario: ScenarioId
  start?: boolean
  difficulty: Difficulty
}): Promise<{ response: string; coaching: string; suggestions?: string[] }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`LLM error ${res.status}`)
  return res.json()
}

function historyFromTurns(turns: Turn[]) {
  return turns.flatMap((t) => [
    // The AI's opening turn has no user message
    ...(t.transcript ? [{ role: "user", content: t.transcript }] : []),
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
  const [silenceMs, setSilenceMs] = useState<number>(() => {
    const stored = Number(localStorage.getItem(SILENCE_STORAGE_KEY))
    return Number.isFinite(stored) && stored >= 1000 && stored <= 5000
      ? stored
      : DEFAULT_SILENCE_MS
  })
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY)
    return stored === "easy" || stored === "medium" || stored === "hard" ? stored : "easy"
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [review, setReview] = useState<SessionReviewData | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const turnsRef = useRef<Turn[]>([])
  const voiceRef = useRef<string>(voice)
  const scenarioRef = useRef<ScenarioId | null>(scenario)
  const difficultyRef = useRef<Difficulty>(difficulty)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    turnsRef.current = turns
    voiceRef.current = voice
    scenarioRef.current = scenario
    difficultyRef.current = difficulty
  }, [turns, voice, scenario, difficulty])

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
  }, [turns, isStarting])

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

  const handleSilenceChange = (ms: number) => {
    setSilenceMs(ms)
    localStorage.setItem(SILENCE_STORAGE_KEY, String(ms))
  }

  const handleDifficultyChange = (d: Difficulty) => {
    setDifficulty(d)
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, d)
  }

  const handleVoiceClick = (v: string) => {
    handleVoiceChange(v)
    playTTS(VOICE_PREVIEW_TEXT, v)
  }

  const handleAudioReady = useCallback(async (blob: Blob) => {
    const activeScenario = scenarioRef.current
    if (!activeScenario) return
    setError(null)
    stopAudio()
    try {
      const transcript = await transcribeAudio(blob)
      const { response, coaching, suggestions: nextSuggestions } = await sendChat({
        transcript,
        history: historyFromTurns(turnsRef.current),
        scenario: activeScenario,
        difficulty: difficultyRef.current,
      })
      setTurns((prev) => [...prev, { transcript, response, coaching }])
      setSuggestions(nextSuggestions?.length ? nextSuggestions : null)
      await playTTS(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [playTTS])

  const { status, startAuto, stopAuto, pttStart, pttStop, cancel } = useVoiceCapture({
    onAudioReady: handleAudioReady,
    silenceDuration: silenceMs,
  })

  const handlePickScenario = async (id: ScenarioId) => {
    setScenario(id)
    setError(null)
    setIsStarting(true)
    try {
      const { response, suggestions: nextSuggestions } = await sendChat({
        history: [],
        scenario: id,
        start: true,
        difficulty,
      })
      setTurns([{ transcript: "", response, coaching: "" }])
      setSuggestions(nextSuggestions?.length ? nextSuggestions : null)
      setIsStarting(false)
      await playTTS(response)
    } catch (err) {
      setIsStarting(false)
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  const requestHint = async () => {
    if (!scenario || hintLoading) return
    setHintLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, history: historyFromTurns(turns) }),
      })
      if (!res.ok) throw new Error(`Hint error ${res.status}`)
      const { suggestions: hints } = (await res.json()) as { suggestions: string[] }
      setSuggestions(hints.length ? hints : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setHintLoading(false)
    }
  }

  const fetchReview = async () => {
    setReviewLoading(true)
    setReviewError(null)
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, turns }),
      })
      if (!res.ok) throw new Error(`Review error ${res.status}`)
      setReview((await res.json()) as SessionReviewData)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setReviewLoading(false)
    }
  }

  const openReview = () => {
    cancel()
    stopAudio()
    setReviewOpen(true)
    setReview(null)
    void fetchReview()
  }

  const resetSession = () => {
    cancel()
    stopAudio()
    setTurns([])
    setScenario(null)
    setSuggestions(null)
    setHintLoading(false)
    setReviewOpen(false)
    setReview(null)
    setReviewError(null)
    setError(null)
    setIsStarting(false)
    setResetOpen(false)
  }

  const handleNewConversation = () => {
    if (turns.length > 0) setResetOpen(true)
    else resetSession()
  }

  const isActive = status === "listening" || status === "speaking"
  const isProcessing = status === "processing"

  const handleAutoClick = () => {
    if (isPlaying) { stopAudio(); return }
    if (status === "idle") startAuto()
    else if (isActive) stopAuto()
  }

  return (
    <div className="flex h-svh flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="font-semibold tracking-tight">Speech Up</h1>
          {scenario && (
            <span className="hidden truncate rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-block">
              {scenarioTitle(scenario)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scenario && turns.some((t) => t.transcript) && (
            <button
              onClick={openReview}
              disabled={isProcessing || isStarting}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Finish</span>
            </button>
          )}
          {scenario && (
            <button
              onClick={handleNewConversation}
              disabled={isProcessing || isStarting}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          )}
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

      {!scenario ? (
        <ScenarioPicker
          onPick={handlePickScenario}
          difficulty={difficulty}
          onDifficultyChange={handleDifficultyChange}
          disabled={isStarting}
        />
      ) : (
        <>
          {/* Conversation */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {turns.map((turn, i) => (
              <div key={i} className="space-y-2">
                {turn.transcript && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2">
                      <p className="text-sm text-primary-foreground">{turn.transcript}</p>
                    </div>
                  </div>
                )}
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

            {isStarting && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
              </div>
            )}

            {suggestions && !isStarting && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                  <Lightbulb className="size-3" />
                  You could say
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => playTTS(s)}
                      className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-left text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/20 dark:text-sky-300"
                      title="Tap to hear it, then say it yourself"
                    >
                      <Volume2 className="size-3 shrink-0 opacity-60" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Controls */}
          <div className="relative flex shrink-0 flex-col items-center gap-3 border-t px-4 py-4">
            {difficulty !== "hard" && turns.length > 0 && (
              <button
                onClick={requestHint}
                disabled={hintLoading || isProcessing || isStarting}
                className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-sky-500/40 hover:text-sky-600 disabled:opacity-50 dark:hover:text-sky-400"
                aria-label="Give me a hint"
              >
                {hintLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Lightbulb className="size-3.5" />
                )}
                <span className="hidden sm:inline">I'm stuck</span>
              </button>
            )}
            {mode === "auto" ? (
              <button
                onClick={handleAutoClick}
                disabled={isProcessing || isStarting}
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
                {isProcessing || isStarting ? (
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
                disabled={isProcessing || isStarting}
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
                {isProcessing || isStarting ? (
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
                : isStarting
                  ? "Starting conversation…"
                  : mode === "ptt" && status === "idle"
                    ? "Hold to speak"
                    : STATUS_LABEL[status]}
            </p>
          </div>
        </>
      )}

      {/* Session review */}
      {reviewOpen && (
        <SessionReview
          loading={reviewLoading}
          data={review}
          error={reviewError}
          onClose={() => setReviewOpen(false)}
          onRetry={() => void fetchReview()}
          onNewConversation={resetSession}
        />
      )}

      {/* New conversation confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              The current conversation will be discarded and you'll pick a new scenario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep talking</AlertDialogCancel>
            <AlertDialogAction onClick={resetSession}>New conversation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

            {/* Silence threshold */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">Pause before sending</h3>
                <span className="text-xs font-semibold tabular-nums text-primary">
                  {silenceMs / 1000} s
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={5000}
                step={250}
                value={silenceMs}
                onChange={(e) => handleSilenceChange(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Pause before sending, seconds"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1 s — fast turns</span>
                <span>5 s — long pauses</span>
              </div>
              <p className="text-xs text-muted-foreground">
                How long Speech Up waits in silence before deciding you finished your
                thought (Auto mode). Take your time — it will never cut you off.
              </p>
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
