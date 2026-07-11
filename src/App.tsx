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
const VOICE_ENABLED_STORAGE_KEY = "speech-up:voice-enabled"
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

type ChatEvent =
  | { t: "delta"; x: string }
  | { t: "response"; x: string }
  | { t: "coaching"; x: string }
  | { t: "suggestions"; x: string[] }
  | { t: "done" }
  | { t: "error"; x: string }

// Streams /api/chat NDJSON events. onDelta gets the accumulated reply text as it
// grows; onResponse fires once the English reply is complete (before coaching).
async function streamChat(
  body: {
    transcript?: string
    history: { role: string; content: string }[]
    scenario: ScenarioId
    start?: boolean
    difficulty: Difficulty
  },
  callbacks: { onDelta: (text: string) => void; onResponse: (text: string) => void },
): Promise<{ response: string; coaching: string; suggestions?: string[] }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw new Error(`LLM error ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let acc = ""
  let response = ""
  let coaching = ""
  let suggestions: string[] | undefined

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop()!
    for (const line of lines) {
      if (!line.trim()) continue
      const ev = JSON.parse(line) as ChatEvent
      if (ev.t === "delta") {
        acc += ev.x
        callbacks.onDelta(acc)
      } else if (ev.t === "response") {
        response = ev.x
        callbacks.onResponse(response)
      } else if (ev.t === "coaching") {
        coaching = ev.x
      } else if (ev.t === "suggestions") {
        suggestions = ev.x
      } else if (ev.t === "error") {
        throw new Error(ev.x)
      }
    }
  }
  return { response: response || acc.trim(), coaching, suggestions }
}

// Splits text into sentences for pipelined TTS (synthesize next while playing current)
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean)
  return parts?.length ? parts : [text]
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
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(
    () => localStorage.getItem(VOICE_ENABLED_STORAGE_KEY) !== "off",
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
  const [phase, setPhase] = useState<"transcribing" | "thinking" | null>(null)
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState<string | null>(null)
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
  const voiceEnabledRef = useRef<boolean>(voiceEnabled)
  const scenarioRef = useRef<ScenarioId | null>(scenario)
  const difficultyRef = useRef<Difficulty>(difficulty)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    turnsRef.current = turns
    voiceRef.current = voice
    voiceEnabledRef.current = voiceEnabled
    scenarioRef.current = scenario
    difficultyRef.current = difficulty
  }, [turns, voice, voiceEnabled, scenario, difficulty])

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
  }, [turns, isStarting, pendingTranscript, streamingText])

  // Bumping the generation counter invalidates any in-flight playback queue
  const playSeqRef = useRef(0)

  const stopAudio = () => {
    playSeqRef.current++
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
  }

  const playBlob = (blob: Blob) =>
    new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      const finish = () => {
        URL.revokeObjectURL(url)
        resolve()
      }
      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(finish)
    })

  // Plays text sentence-by-sentence, synthesizing the next sentence while the
  // current one plays, so audio starts as soon as the first sentence is ready.
  const playTTS = useCallback(async (text: string, voiceOverride?: string) => {
    stopAudio()
    const gen = ++playSeqRef.current
    const voice = voiceOverride ?? voiceRef.current
    const sentences = splitSentences(text)

    const fetchTTS = async (t: string) => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, voice }),
      })
      if (!res.ok) throw new Error(`TTS error ${res.status}`)
      return res.blob()
    }

    setIsPlaying(true)
    try {
      let next = fetchTTS(sentences[0])
      for (let i = 0; i < sentences.length; i++) {
        const blob = await next
        if (playSeqRef.current !== gen) return
        if (i + 1 < sentences.length) next = fetchTTS(sentences[i + 1])
        await playBlob(blob)
        if (playSeqRef.current !== gen) return
      }
    } catch {
      // playback is best-effort; text is already on screen
    } finally {
      if (playSeqRef.current === gen) {
        audioRef.current = null
        setIsPlaying(false)
      }
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

  const handleVoiceEnabledChange = (on: boolean) => {
    setVoiceEnabled(on)
    localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, on ? "on" : "off")
    if (!on) stopAudio()
  }

  const handleVoiceClick = (v: string) => {
    handleVoiceChange(v)
    playTTS(VOICE_PREVIEW_TEXT, v)
  }

  const handleAudioReady = useCallback(async (blob: Blob) => {
    const activeScenario = scenarioRef.current
    if (!activeScenario) return
    setError(null)
    setSuggestions(null)
    stopAudio()
    try {
      setPhase("transcribing")
      const transcript = await transcribeAudio(blob)
      setPendingTranscript(transcript)
      setPhase("thinking")
      setStreamingText("")
      const { response, coaching, suggestions: nextSuggestions } = await streamChat(
        {
          transcript,
          history: historyFromTurns(turnsRef.current),
          scenario: activeScenario,
          difficulty: difficultyRef.current,
        },
        {
          onDelta: setStreamingText,
          // speak while coaching still generates (unless voice is off)
          onResponse: (text) => { if (voiceEnabledRef.current) void playTTS(text) },
        },
      )
      setTurns((prev) => [...prev, { transcript, response, coaching }])
      setSuggestions(nextSuggestions?.length ? nextSuggestions : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setPhase(null)
      setPendingTranscript(null)
      setStreamingText(null)
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
    setStreamingText("")
    try {
      const { response, suggestions: nextSuggestions } = await streamChat(
        { history: [], scenario: id, start: true, difficulty },
        {
          onDelta: setStreamingText,
          onResponse: (text) => { if (voiceEnabledRef.current) void playTTS(text) },
        },
      )
      setTurns([{ transcript: "", response, coaching: "" }])
      setSuggestions(nextSuggestions?.length ? nextSuggestions : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsStarting(false)
      setStreamingText(null)
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
    setPhase(null)
    setPendingTranscript(null)
    setStreamingText(null)
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

            {pendingTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2">
                  <p className="text-sm text-primary-foreground">{pendingTranscript}</p>
                </div>
              </div>
            )}

            {streamingText !== null &&
              (streamingText ? (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2">
                    <p className="text-sm">
                      {streamingText}
                      <span className="ml-1 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-muted-foreground/70 align-middle" />
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3.5">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              ))}

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

            <p className={`text-xs font-medium transition-colors ${isPlaying ? "text-violet-400" : phase ? "text-yellow-400" : STATUS_COLOR[status]}`}>
              {isPlaying
                ? "Speaking… (tap to skip)"
                : phase === "transcribing"
                  ? "Transcribing…"
                  : phase === "thinking"
                    ? "Thinking…"
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

            {/* Voice on/off */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Speak replies aloud</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Turn off to read replies as text only — the fastest way to keep the
                  conversation flowing. Suggestion chips still play when tapped.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={voiceEnabled}
                aria-label="Speak replies aloud"
                onClick={() => handleVoiceEnabledChange(!voiceEnabled)}
                className={[
                  "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  voiceEnabled ? "bg-primary" : "bg-muted-foreground/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                    voiceEnabled ? "translate-x-4" : "",
                  ].join(" ")}
                />
              </button>
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
