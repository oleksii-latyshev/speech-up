import { Lightbulb, Loader2, Mic, MicOff, Volume2 } from "lucide-react"
import type { CaptureStatus } from "@/core/capture"
import { cn } from "@/shared/lib/utils"
import type { ConversationPhase } from "../hooks/useConversation"

export type CaptureMode = "auto" | "ptt"

interface MicDockProps {
  mode: CaptureMode
  status: CaptureStatus
  phase: ConversationPhase
  isStarting: boolean
  isPlaying: boolean
  hintVisible: boolean
  hintLoading: boolean
  onHint: () => void
  onStopPlayback: () => void
  onAutoStart: () => void
  onAutoStop: () => void
  onPttStart: () => void
  onPttStop: () => void
}

type DockState = "playing" | "recording" | "listening" | "busy" | "idle"

function dockState(props: MicDockProps): DockState {
  if (props.isPlaying) return "playing"
  if (props.status === "speaking") return "recording"
  if (props.status === "listening") return "listening"
  if (props.status === "processing" || props.phase || props.isStarting)
    return "busy"
  return "idle"
}

const STATUS_TEXT: Record<DockState, (p: MicDockProps) => string> = {
  playing: () => "Speaking… tap to skip",
  recording: () => "Recording — pause when you're done",
  listening: () => "Listening…",
  busy: (p) =>
    p.phase === "transcribing"
      ? "Transcribing…"
      : p.phase === "thinking"
        ? "Thinking…"
        : p.isStarting
          ? "Starting conversation…"
          : "Processing…",
  idle: (p) => (p.mode === "ptt" ? "Hold to speak" : "Tap to start speaking"),
}

const STATUS_DOT: Record<DockState, string> = {
  playing: "bg-primary",
  recording: "bg-red-500",
  listening: "bg-sky-500",
  busy: "bg-amber-500",
  idle: "bg-muted-foreground/50",
}

export function MicDock(props: MicDockProps) {
  const {
    mode,
    isStarting,
    isPlaying,
    hintVisible,
    hintLoading,
    onHint,
    onStopPlayback,
    onAutoStart,
    onAutoStop,
    onPttStart,
    onPttStop,
  } = props
  const state = dockState(props)
  const busy = state === "busy"
  const active = state === "recording" || state === "listening"

  const buttonFace = busy ? (
    <Loader2 className="size-6 animate-spin text-white" />
  ) : state === "playing" ? (
    <Volume2 className="size-6 text-white" />
  ) : active && mode === "auto" ? (
    <MicOff className="size-6 text-white" />
  ) : (
    <Mic className="size-6 text-white" />
  )

  const buttonClass = cn(
    "relative flex size-16 items-center justify-center rounded-full transition-all",
    "shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
    "disabled:opacity-50",
    state === "playing" && "bg-primary shadow-primary/40 hover:brightness-110",
    state === "recording" && "bg-red-500 shadow-red-500/40",
    state === "listening" && "bg-sky-500 shadow-sky-500/40",
    (state === "idle" || state === "busy") &&
      "bg-gradient-to-b from-primary to-primary/80 shadow-primary/40 hover:brightness-110",
    mode === "ptt" && state === "recording" && "scale-95"
  )

  const pulse = active && (
    <>
      <span
        className={cn(
          "absolute inset-0 animate-ping rounded-full opacity-20 motion-reduce:hidden",
          state === "recording" ? "bg-red-500" : "bg-sky-500"
        )}
      />
      <span
        className={cn(
          "absolute -inset-2 rounded-full border-2 opacity-40",
          state === "recording" ? "border-red-500/50" : "border-sky-500/50"
        )}
      />
    </>
  )

  return (
    <div className="relative shrink-0 px-4 pt-2 pb-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2.5">
        <div className="relative">
          {mode === "auto" ? (
            <button
              onClick={() => {
                if (isPlaying) onStopPlayback()
                else if (active) onAutoStop()
                else onAutoStart()
              }}
              disabled={busy}
              className={buttonClass}
              aria-label={
                isPlaying
                  ? "Stop playback"
                  : active
                    ? "Stop listening"
                    : "Start listening"
              }
            >
              {pulse}
              {buttonFace}
            </button>
          ) : (
            <button
              onPointerDown={() => {
                if (isPlaying) onStopPlayback()
                else onPttStart()
              }}
              onPointerUp={onPttStop}
              onPointerLeave={onPttStop}
              disabled={busy}
              className={cn(buttonClass, "touch-none select-none")}
              aria-label={isPlaying ? "Stop playback" : "Hold to speak"}
            >
              {pulse}
              {buttonFace}
            </button>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[state])} />
          {STATUS_TEXT[state](props)}
        </p>
      </div>

      {hintVisible && (
        <button
          onClick={onHint}
          disabled={hintLoading || busy || isStarting}
          className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-xs transition-all hover:border-sky-500/40 hover:text-sky-600 active:scale-[0.98] disabled:opacity-50 dark:hover:text-sky-400"
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
    </div>
  )
}
