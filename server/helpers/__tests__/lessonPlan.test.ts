import { describe, expect, it } from "vitest"
import {
  fallbackPlan,
  formatPlanContext,
  hasHistory,
  sanitizePlan,
  sanitizePlanCheck,
  type PlanContextRows,
} from "../lessonPlan"

const emptyRows: PlanContextRows = {
  sessions: [],
  corrections: [],
  vocabulary: [],
  previousPlan: null,
}

const rows: PlanContextRows = {
  sessions: [
    { scenario: "casual", startedAt: 3_000 },
    { scenario: "standup", startedAt: 2_000 },
    { scenario: "casual", startedAt: 1_000 },
  ],
  corrections: [
    { you: "I go yesterday", better: "I went yesterday", tag: "tenses" },
    { you: "depends of", better: "depends on", tag: "prepositions" },
    { you: "I very like it", better: "I really like it", tag: "tenses" },
  ],
  vocabulary: ["to figure out — разобраться", "deadline — срок"],
  previousPlan: {
    scenario: "standup",
    focusTags: ["tenses"],
    microGoal: "Говори развёрнуто",
    focusResult: "Частично справился",
    goalAchieved: false,
  },
}

describe("fallbackPlan", () => {
  it("returns a casual first lesson when there is no history", () => {
    const plan = fallbackPlan(emptyRows)
    expect(plan.scenario).toBe("casual")
    expect(plan.focusTags).toEqual([])
    expect(plan.targetPhrases).toEqual([])
    expect(plan.focusNote).toBeTruthy()
    expect(plan.microGoal).toBeTruthy()
  })

  it("picks a never-practiced scenario and the top error tags", () => {
    const plan = fallbackPlan(rows)
    expect(plan.scenario).toBe("interview-frontend")
    expect(plan.focusTags).toEqual(["tenses", "prepositions"])
    expect(plan.targetPhrases).toContain("I went yesterday")
  })

  it("falls back to the least recently practiced scenario when all were used", () => {
    const allUsed: PlanContextRows = {
      ...emptyRows,
      sessions: [
        "casual",
        "standup",
        "tech-discussion",
        "interview-frontend",
        "interview-backend",
        "interview-fullstack",
        "interview-general",
      ].map((scenario, i) => ({
        scenario: scenario as PlanContextRows["sessions"][number]["scenario"],
        startedAt: 7_000 - i * 1_000,
      })),
    }
    expect(fallbackPlan(allUsed).scenario).toBe("interview-general")
  })
})

describe("sanitizePlan", () => {
  it("keeps valid model output", () => {
    const plan = sanitizePlan(
      {
        scenario: "tech-discussion",
        focusTags: ["tenses", "articles"],
        focusNote: "Фокус на временах.",
        targetPhrases: ["I went yesterday", "depends on"],
        microGoal: "Три предложения на ответ.",
      },
      rows
    )
    expect(plan).toEqual({
      scenario: "tech-discussion",
      focusTags: ["tenses", "articles"],
      focusNote: "Фокус на временах.",
      targetPhrases: ["I went yesterday", "depends on"],
      microGoal: "Три предложения на ответ.",
    })
  })

  it("replaces invalid fields with fallback values", () => {
    const plan = sanitizePlan(
      {
        scenario: "made-up",
        focusTags: ["nonsense"],
        focusNote: "  ",
        targetPhrases: [42, ""],
        microGoal: null,
      },
      rows
    )
    const fallback = fallbackPlan(rows)
    expect(plan).toEqual(fallback)
  })

  it("drops duplicates and over-long phrases", () => {
    const plan = sanitizePlan(
      {
        scenario: "casual",
        focusTags: ["tenses", "tenses", "articles", "phrasing"],
        focusNote: "ok",
        targetPhrases: [
          "depends on",
          "Depends on",
          "one two three four five six seven eight nine ten eleven twelve thirteen",
        ],
        microGoal: "ok",
      },
      rows
    )
    expect(plan.focusTags).toEqual(["tenses", "articles"])
    expect(plan.targetPhrases).toEqual(["depends on"])
  })

  it("drops invented phrases that are not backed by the history", () => {
    const plan = sanitizePlan(
      {
        scenario: "casual",
        focusTags: ["tenses"],
        focusNote: "ok",
        targetPhrases: [
          "I worked on a project where...",
          "The main challenge was...",
          "I went yesterday",
        ],
        microGoal: "ok",
      },
      rows
    )
    expect(plan.targetPhrases).toEqual(["I went yesterday"])
  })

  it("survives a non-object payload", () => {
    expect(sanitizePlan("garbage", rows)).toEqual(fallbackPlan(rows))
  })
})

describe("sanitizePlanCheck", () => {
  it("accepts a valid check", () => {
    expect(
      sanitizePlanCheck({ focusResult: "Справился.", goalAchieved: true })
    ).toEqual({ focusResult: "Справился.", goalAchieved: true })
  })

  it("coerces a missing or non-boolean goalAchieved to false", () => {
    expect(sanitizePlanCheck({ focusResult: "ok" })?.goalAchieved).toBe(false)
    expect(
      sanitizePlanCheck({ focusResult: "ok", goalAchieved: "yes" })
        ?.goalAchieved
    ).toBe(false)
  })

  it("rejects payloads without a focus result", () => {
    expect(sanitizePlanCheck({ focusResult: "  " })).toBeNull()
    expect(sanitizePlanCheck(null)).toBeNull()
    expect(sanitizePlanCheck("text")).toBeNull()
  })
})

describe("formatPlanContext", () => {
  it("includes every section with relative dates", () => {
    const text = formatPlanContext(rows, 90_000_000)
    expect(text).toContain("- casual (yesterday)")
    expect(text).toContain('"I go yesterday" -> "I went yesterday" [tenses]')
    expect(text).toContain("to figure out — разобраться")
    expect(text).toContain("goal NOT achieved")
  })

  it("omits empty sections", () => {
    const text = formatPlanContext(
      { ...emptyRows, sessions: [{ scenario: "casual", startedAt: 0 }] },
      0
    )
    expect(text).toContain("Recent sessions")
    expect(text).not.toContain("Recent mistakes")
    expect(text).not.toContain("Vocabulary")
    expect(text).not.toContain("Previous lesson")
  })
})

describe("hasHistory", () => {
  it("is false only when there are no sessions", () => {
    expect(hasHistory(emptyRows)).toBe(false)
    expect(hasHistory(rows)).toBe(true)
  })
})
