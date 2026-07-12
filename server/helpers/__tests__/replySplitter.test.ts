import { describe, expect, it } from "vitest"
import type { ChatEvent } from "../../../src/core/session/contract"
import { createReplySplitter } from "../replySplitter"

function run(chunks: string[]): ChatEvent[] {
  const events: ChatEvent[] = []
  const splitter = createReplySplitter((e) => events.push(e))
  for (const chunk of chunks) splitter.feed(chunk)
  splitter.finish()
  return events
}

const eventsOf = (events: ChatEvent[], t: ChatEvent["t"]) =>
  events.filter((e) => e.t === t)

const deltasText = (events: ChatEvent[]) =>
  events.flatMap((e) => (e.t === "delta" ? [e.x] : [])).join("")

describe("createReplySplitter", () => {
  it("emits the reply as deltas and a final response", () => {
    const events = run(["Hello ", "there!", "\n---\nОтлично!"])
    expect(deltasText(events)).toBe("Hello there!")
    expect(eventsOf(events, "response")).toEqual([
      { t: "response", x: "Hello there!" },
    ])
    expect(eventsOf(events, "coaching")).toEqual([
      { t: "coaching", x: "Отлично!" },
    ])
    expect(events.at(-1)).toEqual({ t: "done" })
  })

  it("never leaks a partial delimiter into deltas", () => {
    const events = run(["Nice job", "\n-", "--", "\nСовет"])
    expect(deltasText(events)).toBe("Nice job")
    expect(eventsOf(events, "response")).toEqual([
      { t: "response", x: "Nice job" },
    ])
    expect(eventsOf(events, "coaching")).toEqual([
      { t: "coaching", x: "Совет" },
    ])
  })

  it("parses the suggestions section on easy difficulty", () => {
    const events = run(["Reply\n---\nНорм\n---\n- I think so\n- Maybe not"])
    expect(eventsOf(events, "suggestions")).toEqual([
      { t: "suggestions", x: ["I think so", "Maybe not"] },
    ])
  })

  it("treats output without delimiters as the whole reply", () => {
    const events = run(["Just a reply"])
    expect(eventsOf(events, "response")).toEqual([
      { t: "response", x: "Just a reply" },
    ])
    expect(eventsOf(events, "coaching")).toEqual([{ t: "coaching", x: "" }])
    expect(eventsOf(events, "suggestions")).toEqual([])
  })
})
