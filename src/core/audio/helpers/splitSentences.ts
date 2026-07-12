// Splits text into sentences for pipelined TTS: the next sentence is
// synthesized while the current one plays.
export function splitSentences(text: string): string[] {
  const parts = text
    .match(/[^.!?]+[.!?]*/g)
    ?.map((s) => s.trim())
    .filter(Boolean)
  return parts?.length ? parts : [text]
}
