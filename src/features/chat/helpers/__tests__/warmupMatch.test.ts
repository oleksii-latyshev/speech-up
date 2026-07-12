import { describe, expect, it } from "vitest"
import { phraseUsedIn } from "../warmupMatch"

describe("phraseUsedIn", () => {
  it("matches an exact phrase despite casing and punctuation", () => {
    expect(
      phraseUsedIn("I made a mistake", "yesterday, I made a Mistake there")
    ).toBe(true)
  })

  it("matches when most content words are present in another form", () => {
    expect(
      phraseUsedIn(
        "It depends on the project",
        "well I think it really depends on the project size"
      )
    ).toBe(true)
  })

  it("matches a single vocabulary word including plural forms", () => {
    expect(phraseUsedIn("deadline", "we have two deadlines this week")).toBe(
      true
    )
    expect(phraseUsedIn("workaround", "I found a workaround")).toBe(true)
  })

  it("does not match a short word inside a longer one", () => {
    expect(phraseUsedIn("art", "let's start the meeting")).toBe(false)
  })

  it("does not match when the phrase was not said", () => {
    expect(phraseUsedIn("I made a mistake", "I worked on the login page")).toBe(
      false
    )
    expect(phraseUsedIn("deadline", "we shipped it on time")).toBe(false)
  })

  it("handles empty input", () => {
    expect(phraseUsedIn("", "hello")).toBe(false)
    expect(phraseUsedIn("deadline", "")).toBe(false)
  })
})
