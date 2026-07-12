import { describe, expect, it } from "vitest"
import { extractJsonObject } from "../modelJson"

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 })
  })

  it("ignores prose and markdown fences around the object", () => {
    expect(
      extractJsonObject(
        'Sure! Here you go:\n```json\n{"suggestions":["hi"]}\n```'
      )
    ).toEqual({ suggestions: ["hi"] })
  })

  it("throws when there is no object at all", () => {
    expect(() => extractJsonObject("no json here")).toThrow(
      /Unexpected model output/
    )
  })
})
