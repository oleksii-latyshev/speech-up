import { useState, useCallback, useRef, useEffect } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { useVoiceCapture, type CaptureStatus } from "@/hooks/useVoiceCapture"

type CaptureMode = "auto" | "ptt"

interface Turn {
  transcript: string
  response: string
  coaching: string
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
  history: { role: string; content: string }[]
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
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState<string | null>(null)
  const turnsRef = useRef<Turn[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  turnsRef.current = turns

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  const handleAudioReady = useCallback(async (blob: Blob) => {
    setError(null)
    try {
      const transcript = await transcribeAudio(blob)
      const { response, coaching } = await sendChat(
        transcript,
        historyFromTurns(turnsRef.current)
      )
      setTurns((prev) => [...prev, { transcript, response, coaching }])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [])

  const { status, startAuto, stopAuto, pttStart, pttStop } = useVoiceCapture({
    onAudioReady: handleAudioReady,
  })

  const isActive = status === "listening" || status === "speaking"
  const isProcessing = status === "processing"

  const handleAutoClick = () => {
    if (status === "idle") startAuto()
    else if (isActive) stopAuto()
  }

  return (
    <div className="flex h-svh flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h1 className="font-semibold tracking-tight">Speech Up</h1>
        <div className="flex gap-0.5 rounded-lg border p-0.5">
          {(["auto", "ptt"] as CaptureMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (status === "idle") setMode(m)
              }}
              disabled={status !== "idle"}
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
                <p className="text-sm text-primary-foreground">
                  {turn.transcript}
                </p>
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
              isActive
                ? "bg-red-500 ring-red-400/40 hover:bg-red-600"
                : "bg-primary ring-primary/30 hover:bg-primary/90",
            ].join(" ")}
            aria-label={isActive ? "Stop listening" : "Start listening"}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : isActive ? (
              <MicOff className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>
        ) : (
          <button
            onPointerDown={pttStart}
            onPointerUp={pttStop}
            onPointerLeave={pttStop}
            disabled={isProcessing}
            className={[
              "flex h-16 w-16 items-center justify-center rounded-full",
              "touch-none ring-4 transition-all select-none focus:outline-none disabled:opacity-50",
              status === "speaking"
                ? "scale-95 bg-red-500 ring-red-400/40"
                : "bg-primary ring-primary/30 hover:bg-primary/90",
            ].join(" ")}
            aria-label="Hold to speak"
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>
        )}

        <p
          className={`text-xs font-medium transition-colors ${STATUS_COLOR[status]}`}
        >
          {mode === "ptt" && status === "idle"
            ? "Hold to speak"
            : STATUS_LABEL[status]}
        </p>
      </div>
    </div>
  )
}
