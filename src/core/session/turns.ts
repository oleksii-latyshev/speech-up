import type { ChatMessage } from "./contract"

export interface Turn {
  transcript: string // empty for the AI's opening turn
  response: string
  coaching: string
}

export function historyFromTurns(turns: Turn[]): ChatMessage[] {
  return turns.flatMap<ChatMessage>((t) => [
    ...(t.transcript ? [{ role: "user" as const, content: t.transcript }] : []),
    { role: "assistant" as const, content: t.response },
  ])
}

export const hasUserSpoken = (turns: Turn[]) => turns.some((t) => t.transcript)
