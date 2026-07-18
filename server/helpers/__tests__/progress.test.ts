import { describe, expect, it } from "vitest"
import { computeProgressStats, dayKey } from "../progress"

const NOW = new Date(2026, 6, 12, 15, 0, 0).getTime()

const MIN = 60_000
const DAY = 24 * 60 * 60 * 1000

const empty = { sessions: [], turns: [], tags: [] as never[] }

describe("computeProgressStats", () => {
  it("returns zeroes and a full day grid for an empty database", () => {
    const stats = computeProgressStats(empty, NOW)
    expect(stats.sessionCount).toBe(0)
    expect(stats.practiceMs).toBe(0)
    expect(stats.avgUtteranceWords).toBe(0)
    expect(stats.streakDays).toBe(0)
    expect(stats.errorTags).toEqual([])
    expect(stats.days).toHaveLength(14)
    expect(stats.days.every((d) => d.sessions === 0 && d.minutes === 0)).toBe(
      true
    )
    expect(stats.days.at(-1)?.date).toBe(dayKey(NOW))
  })

  it("counts words only in user utterances, skipping the AI opener", () => {
    const stats = computeProgressStats(
      {
        sessions: [{ id: 1, startedAt: NOW - 10 * MIN, endedAt: NOW }],
        turns: [
          { sessionId: 1, transcript: "", createdAt: NOW - 9 * MIN },
          {
            sessionId: 1,
            transcript: "I worked on the login page",
            createdAt: NOW - 8 * MIN,
          },
          { sessionId: 1, transcript: "  Yes  ", createdAt: NOW - 7 * MIN },
        ],
        tags: [],
      },
      NOW
    )
    expect(stats.utteranceCount).toBe(2)
    expect(stats.wordCount).toBe(7)
    expect(stats.avgUtteranceWords).toBe(4)
  })

  it("uses endedAt for duration and falls back to the last turn", () => {
    const stats = computeProgressStats(
      {
        sessions: [
          { id: 1, startedAt: NOW - 30 * MIN, endedAt: NOW - 20 * MIN },
          { id: 2, startedAt: NOW - 10 * MIN, endedAt: null },
        ],
        turns: [
          { sessionId: 2, transcript: "hello", createdAt: NOW - 4 * MIN },
        ],
        tags: [],
      },
      NOW
    )
    expect(stats.practiceMs).toBe(10 * MIN + 6 * MIN)
  })

  it("buckets sessions into local days for the activity grid", () => {
    const stats = computeProgressStats(
      {
        sessions: [
          { id: 1, startedAt: NOW - 2 * DAY, endedAt: NOW - 2 * DAY + 5 * MIN },
          { id: 2, startedAt: NOW - 5 * MIN, endedAt: NOW },
          { id: 3, startedAt: NOW - 20 * MIN, endedAt: NOW - 10 * MIN },
        ],
        turns: [],
        tags: [],
      },
      NOW
    )
    const today = stats.days.at(-1)!
    expect(today.sessions).toBe(2)
    expect(today.minutes).toBe(15)
    const twoDaysAgo = stats.days.at(-3)!
    expect(twoDaysAgo.sessions).toBe(1)
    expect(twoDaysAgo.minutes).toBe(5)
  })

  it("counts a streak of consecutive practice days", () => {
    const session = (id: number, daysBack: number) => ({
      id,
      startedAt: NOW - daysBack * DAY,
      endedAt: NOW - daysBack * DAY + MIN,
    })
    const stats = computeProgressStats(
      {
        sessions: [session(1, 0), session(2, 1), session(3, 3)],
        turns: [],
        tags: [],
      },
      NOW
    )
    expect(stats.streakDays).toBe(2)
  })

  it("keeps the streak alive when today has no session yet", () => {
    const session = (id: number, daysBack: number) => ({
      id,
      startedAt: NOW - daysBack * DAY,
      endedAt: NOW - daysBack * DAY + MIN,
    })
    const stats = computeProgressStats(
      { sessions: [session(1, 1), session(2, 2)], turns: [], tags: [] },
      NOW
    )
    expect(stats.streakDays).toBe(2)
  })

  it("ranks error tags by frequency", () => {
    const stats = computeProgressStats(
      {
        sessions: [],
        turns: [],
        tags: ["articles", "tenses", "articles", "phrasing", "articles"],
      },
      NOW
    )
    expect(stats.errorTags).toEqual([
      { tag: "articles", count: 3 },
      { tag: "tenses", count: 1 },
      { tag: "phrasing", count: 1 },
    ])
  })
})
