import { useState, useCallback } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { useVoiceCapture, type CaptureStatus } from "@/hooks/useVoiceCapture"

type CaptureMode = "auto" | "ptt"

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

async function sendAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append("audio", blob, "audio.webm")
  const res = await fetch("/api/transcribe", { method: "POST", body: form })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  const data = (await res.json()) as { transcript: string }
  return data.transcript
}

export default function App() {
  const [mode, setMode] = useState<CaptureMode>("auto")
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAudioReady = useCallback(async (blob: Blob) => {
    setError(null)
    try {
      setTranscript(await sendAudio(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [])

  const { status, startAuto, stopAuto, pttStart, pttStop } = useVoiceCapture({
    onAudioReady: handleAudioReady,
  })

  const isActive = status !== "idle" && status !== "processing"
  const isProcessing = status === "processing"

  // Auto mode: click toggles on/off
  const handleAutoClick = () => {
    if (status === "idle") startAuto()
    else if (isActive) stopAuto()
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Speech Up</h1>

      {/* Mode toggle */}
      <div className="flex rounded-lg border p-1 gap-1">
        {(["auto", "ptt"] as CaptureMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { if (status === "idle") setMode(m) }}
            disabled={status !== "idle"}
            className={[
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {m === "auto" ? "Auto" : "Hold"}
          </button>
        ))}
      </div>

      {/* Mic button */}
      {mode === "auto" ? (
        <button
          onClick={handleAutoClick}
          disabled={isProcessing}
          className={[
            "flex h-24 w-24 items-center justify-center rounded-full",
            "ring-4 transition-all focus:outline-none disabled:opacity-50",
            isActive
              ? "bg-red-500 ring-red-400/40 hover:bg-red-600"
              : "bg-primary ring-primary/30 hover:bg-primary/90",
          ].join(" ")}
          aria-label={isActive ? "Stop listening" : "Start listening"}
        >
          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          ) : isActive ? (
            <MicOff className="h-8 w-8 text-white" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </button>
      ) : (
        <button
          onPointerDown={pttStart}
          onPointerUp={pttStop}
          onPointerLeave={pttStop}
          disabled={isProcessing}
          className={[
            "flex h-24 w-24 items-center justify-center rounded-full",
            "ring-4 select-none transition-all focus:outline-none disabled:opacity-50",
            "touch-none", // prevent scroll hijack on mobile
            status === "speaking"
              ? "bg-red-500 ring-red-400/40 scale-95"
              : "bg-primary ring-primary/30 hover:bg-primary/90",
          ].join(" ")}
          aria-label="Hold to speak"
        >
          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </button>
      )}

      <p className={`text-sm font-medium transition-colors ${STATUS_COLOR[status]}`}>
        {mode === "ptt" && status === "idle"
          ? "Hold to speak"
          : STATUS_LABEL[status]}
      </p>

      {transcript && (
        <div className="w-full max-w-md rounded-lg border p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Last transcript</p>
          <p className="text-sm">{transcript}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {mode === "auto" && status === "idle" && (
        <p className="text-xs text-muted-foreground">
          Stops after {2.5}s of silence
        </p>
      )}
    </div>
  )
}
