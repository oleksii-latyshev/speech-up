import { useState } from "react"
import {
  ClipboardCheck,
  Mic,
  RotateCcw,
  Settings as SettingsIcon,
} from "lucide-react"
import { useTtsPlayer } from "@/core/audio"
import { scenarioTitle } from "@/core/session"
import { useSettings } from "@/core/settings"
import { ChatScreen, useConversation, type CaptureMode } from "@/features/chat"
import { SessionReview, useSessionReview } from "@/features/review"
import { ScenarioPicker } from "@/features/scenario"
import { SettingsPanel } from "@/features/settings"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog"
import { cn } from "@/shared/lib/utils"

export default function App() {
  const settings = useSettings()
  const player = useTtsPlayer()
  const conversation = useConversation(settings, player)
  const review = useSessionReview()

  const [mode, setMode] = useState<CaptureMode>("auto")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const { scenario, turns, capture, isStarting } = conversation
  const busy = capture.status === "processing" || isStarting
  const captureIdle = capture.status === "idle"

  const openReview = () => {
    if (!scenario) return
    player.stop()
    conversation.capture.stopAuto()
    review.show(scenario, turns, conversation.sessionId)
  }

  const resetSession = () => {
    conversation.reset()
    review.close()
    setResetOpen(false)
  }

  const handleNewConversation = () => {
    if (turns.length > 0) setResetOpen(true)
    else resetSession()
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-sm shadow-primary/30">
            <Mic className="size-3.5 text-primary-foreground" />
          </div>
          <h1 className="font-heading font-semibold tracking-tight">
            Speech Up
          </h1>
          {scenario && (
            <span className="hidden truncate rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-block">
              {scenarioTitle(scenario)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scenario && conversation.hasSpoken && (
            <button
              onClick={openReview}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <ClipboardCheck className="size-3.5" />
              <span className="hidden sm:inline">Finish</span>
            </button>
          )}
          {scenario && (
            <button
              onClick={handleNewConversation}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          )}
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5 ring-1 ring-border">
            {(["auto", "ptt"] as CaptureMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (captureIdle && !player.isPlaying) setMode(m)
                }}
                disabled={!captureIdle || player.isPlaying}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  mode === m
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "auto" ? "Auto" : "Hold"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Settings"
          >
            <SettingsIcon className="size-4" />
          </button>
        </div>
      </header>

      {!scenario ? (
        <ScenarioPicker
          onPick={(id) => void conversation.startScenario(id)}
          difficulty={settings.difficulty}
          onDifficultyChange={settings.setDifficulty}
          disabled={isStarting}
        />
      ) : (
        <ChatScreen
          conversation={conversation}
          player={player}
          settings={settings}
          mode={mode}
        />
      )}

      {review.open && (
        <SessionReview
          loading={review.loading}
          data={review.data}
          error={review.error}
          onClose={review.close}
          onRetry={review.retry}
          onNewConversation={resetSession}
        />
      )}

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              The current conversation will be discarded and you'll pick a new
              scenario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep talking</AlertDialogCancel>
            <AlertDialogAction onClick={resetSession}>
              New conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          player={player}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
