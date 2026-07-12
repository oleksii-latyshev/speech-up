import { describe, expect, it } from "vitest"
import { parseVocabularyEntry, selectWarmupPhrases } from "../warmup"

const first = () => 0 // always picks the highest-weight (most recent) candidate

describe("parseVocabularyEntry", () => {
  it("splits phrase and Russian explanation on a dash", () => {
    expect(parseVocabularyEntry("deadline — крайний срок")).toEqual({
      text: "deadline",
      hint: "крайний срок",
    })
    expect(parseVocabularyEntry("to be on track – идти по плану")).toEqual({
      text: "to be on track",
      hint: "идти по плану",
    })
  })

  it("keeps the whole entry as text when there is no dash", () => {
    expect(parseVocabularyEntry("figure out")).toEqual({
      text: "figure out",
      hint: "",
    })
  })
})

describe("selectWarmupPhrases", () => {
  it("returns an empty list when there is no history", () => {
    expect(
      selectWarmupPhrases({ corrections: [], vocabulary: [] }, first)
    ).toEqual([])
  })

  it("mixes 2 corrections with 1 vocabulary phrase", () => {
    const picked = selectWarmupPhrases(
      {
        corrections: [
          { you: "I am agree", better: "I agree" },
          { you: "It depends of", better: "It depends on" },
          { you: "I did a mistake", better: "I made a mistake" },
        ],
        vocabulary: ["deadline — крайний срок", "roughly — примерно"],
      },
      first
    )
    expect(picked).toHaveLength(3)
    expect(picked.filter((p) => p.source === "correction")).toHaveLength(2)
    expect(picked.filter((p) => p.source === "vocabulary")).toHaveLength(1)
    expect(picked[0]).toEqual({
      text: "I agree",
      hint: "I am agree",
      source: "correction",
    })
  })

  it("backfills from the other pool when one side is short", () => {
    const picked = selectWarmupPhrases(
      {
        corrections: [],
        vocabulary: [
          "deadline — крайний срок",
          "roughly — примерно",
          "to figure out — разобраться",
          "workaround — обходное решение",
        ],
      },
      first
    )
    expect(picked).toHaveLength(3)
    expect(picked.every((p) => p.source === "vocabulary")).toBe(true)
  })

  it("skips duplicates and phrases that are too long to reuse", () => {
    const long =
      "When I was working on that project I realized that the main problem was the legacy build system"
    const picked = selectWarmupPhrases(
      {
        corrections: [
          { you: "I am agree", better: "I agree" },
          { you: "i am agree", better: "i agree" },
          { you: "long story", better: long },
        ],
        vocabulary: [],
      },
      first
    )
    expect(picked).toEqual([
      { text: "I agree", hint: "I am agree", source: "correction" },
    ])
  })
})
