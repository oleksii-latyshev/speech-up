import { describe, expect, it } from "vitest"
import { isDifficulty, isScenarioId } from "../contract"
import { hasUserSpoken, historyFromTurns, type Turn } from "../turns"

const opening: Turn = {
  transcript: "",
  response: "Hi! Ready to start?",
  coaching: "",
}
const answer: Turn = {
  transcript: "I am fine",
  response: "Great!",
  coaching: "note",
}

describe("historyFromTurns", () => {
  it("skips the user message for the AI's opening turn", () => {
    expect(historyFromTurns([opening])).toEqual([
      { role: "assistant", content: "Hi! Ready to start?" },
    ])
  })

  it("keeps user and assistant messages in conversation order", () => {
    expect(historyFromTurns([opening, answer])).toEqual([
      { role: "assistant", content: "Hi! Ready to start?" },
      { role: "user", content: "I am fine" },
      { role: "assistant", content: "Great!" },
    ])
  })
})

describe("hasUserSpoken", () => {
  it("is false while only the opening turn exists", () => {
    expect(hasUserSpoken([opening])).toBe(false)
    expect(hasUserSpoken([opening, answer])).toBe(true)
  })
})

describe("contract guards", () => {
  it("accepts known ids and rejects unknown ones", () => {
    expect(isScenarioId("standup")).toBe(true)
    expect(isScenarioId("nope")).toBe(false)
    expect(isDifficulty("easy")).toBe(true)
    expect(isDifficulty("expert")).toBe(false)
  })
})
