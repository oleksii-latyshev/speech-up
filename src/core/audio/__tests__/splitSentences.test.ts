import { describe, expect, it } from "vitest"
import { splitSentences } from "../helpers/splitSentences"

describe("splitSentences", () => {
  it("splits on sentence punctuation and trims", () => {
    expect(splitSentences("Hello there! How are you? I'm fine.")).toEqual([
      "Hello there!",
      "How are you?",
      "I'm fine.",
    ])
  })

  it("returns the whole text when there is no punctuation", () => {
    expect(splitSentences("just a fragment")).toEqual(["just a fragment"])
  })

  it("keeps trailing text without punctuation as its own part", () => {
    expect(splitSentences("First. and then")).toEqual(["First.", "and then"])
  })
})
