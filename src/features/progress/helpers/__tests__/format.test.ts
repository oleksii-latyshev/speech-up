import { describe, expect, it } from "vitest"
import {
  dayTickLabel,
  dayTooltipLabel,
  formatDuration,
  sessionDateLabel,
} from "../format"

describe("formatDuration", () => {
  it("shows zero and sub-minute values", () => {
    expect(formatDuration(0)).toBe("0m")
    expect(formatDuration(20_000)).toBe("<1m")
  })

  it("shows minutes under an hour", () => {
    expect(formatDuration(5 * 60_000)).toBe("5m")
    expect(formatDuration(59 * 60_000)).toBe("59m")
  })

  it("shows hours and minutes", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h 0m")
    expect(formatDuration(135 * 60_000)).toBe("2h 15m")
  })
})

describe("day labels", () => {
  it("parses a day key in local time", () => {
    expect(dayTickLabel("2026-07-08")).toBe("8")
    expect(dayTooltipLabel("2026-07-08")).toBe("Wed, Jul 8")
  })
})

describe("sessionDateLabel", () => {
  const now = new Date(2026, 6, 12, 15, 0).getTime()

  it("labels today and yesterday", () => {
    expect(sessionDateLabel(new Date(2026, 6, 12, 9, 0).getTime(), now)).toBe(
      "Today"
    )
    expect(sessionDateLabel(new Date(2026, 6, 11, 23, 0).getTime(), now)).toBe(
      "Yesterday"
    )
  })

  it("falls back to a short date", () => {
    expect(sessionDateLabel(new Date(2026, 6, 1, 9, 0).getTime(), now)).toBe(
      "Jul 1"
    )
  })
})
