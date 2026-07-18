import { useEffect, useRef } from "react"
import type { TtsPlayer } from "@/core/audio"
import { ERROR_TAG_LABELS } from "@/core/session"
import type { Settings } from "@/core/settings"
import type { Conversation } from "../hooks/useConversation"
import {
  AssistantBubble,
  CoachingNote,
  TypingBubble,
  UserBubble,
} from "./MessageBubbles"
import { MicDock, type CaptureMode } from "./MicDock"
import { SuggestionChips } from "./SuggestionChips"
import { WarmupCard } from "./WarmupCard"

interface ChatScreenProps {
  conversation: Conversation
  player: TtsPlayer
  settings: Settings
  mode: CaptureMode
}

export function ChatScreen({
  conversation,
  player,
  settings,
  mode,
}: ChatScreenProps) {
  const {
    turns,
    phase,
    pendingTranscript,
    streamingText,
    suggestions,
    hintLoading,
    isStarting,
    error,
    capture,
    warmup,
    warmupUsed,
    plan,
  } = conversation

  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns, isStarting, pendingTranscript, streamingText, suggestions])

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {(warmup || plan) && (
            <WarmupCard
              phrases={warmup ?? []}
              used={warmupUsed}
              onPlay={(text) => void player.play(text, settings.voice)}
              lesson={
                plan
                  ? {
                      focusLabels: plan.focusTags.map(
                        (tag) => ERROR_TAG_LABELS[tag]
                      ),
                      microGoal: plan.microGoal,
                    }
                  : undefined
              }
            />
          )}

          {turns.map((turn, i) => (
            <div key={i} className="space-y-2.5">
              {turn.transcript && <UserBubble text={turn.transcript} />}
              <AssistantBubble text={turn.response} />
              {turn.coaching && <CoachingNote text={turn.coaching} />}
            </div>
          ))}

          {pendingTranscript && <UserBubble text={pendingTranscript} />}

          {streamingText !== null &&
            (streamingText ? (
              <AssistantBubble text={streamingText} streaming />
            ) : (
              <TypingBubble />
            ))}

          {suggestions && !isStarting && (
            <SuggestionChips
              suggestions={suggestions}
              onPlay={(text) => void player.play(text, settings.voice)}
            />
          )}

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <MicDock
        mode={mode}
        status={capture.status}
        phase={phase}
        isStarting={isStarting}
        isPlaying={player.isPlaying}
        hintVisible={settings.difficulty !== "hard" && turns.length > 0}
        hintLoading={hintLoading}
        onHint={() => void conversation.requestHint()}
        onStopPlayback={player.stop}
        onAutoStart={capture.startAuto}
        onAutoStop={capture.stopAuto}
        onPttStart={capture.pttStart}
        onPttStop={capture.pttStop}
      />
    </>
  )
}
