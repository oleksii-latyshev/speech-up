import type { ChatEvent } from "../../src/core/session/contract"

const DELIM = "\n---"

// Splits the model's plain-text output (reply / coaching / suggestions,
// separated by "---" lines) into chat events while it streams. A small tail is
// held back so a partial "\n---" never leaks into deltas.
export function createReplySplitter(send: (event: ChatEvent) => void) {
  let pending = ""
  let replyDone = false
  let reply = ""
  let rest = ""

  const feed = (chunk: string) => {
    if (replyDone) {
      rest += chunk
      return
    }
    pending += chunk
    const at = pending.indexOf(DELIM)
    if (at !== -1) {
      const last = pending.slice(0, at)
      if (last) send({ t: "delta", x: last })
      reply += last
      rest = pending.slice(at + DELIM.length)
      pending = ""
      replyDone = true
      reply = reply.trim()
      send({ t: "response", x: reply })
      return
    }
    const safe = Math.max(0, pending.length - DELIM.length)
    if (safe > 0) {
      send({ t: "delta", x: pending.slice(0, safe) })
      reply += pending.slice(0, safe)
      pending = pending.slice(safe)
    }
  }

  const finish = () => {
    if (!replyDone) {
      if (pending) send({ t: "delta", x: pending })
      reply = (reply + pending).trim()
      send({ t: "response", x: reply })
    }

    const [coachingRaw = "", suggestionsRaw = ""] = rest.split(/\n\s*---\s*/)
    send({ t: "coaching", x: coachingRaw.replace(/^[-\s]+/, "").trim() })

    const suggestions = suggestionsRaw
      .split("\n")
      .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3)
    if (suggestions.length) send({ t: "suggestions", x: suggestions })

    send({ t: "done" })
  }

  return { feed, finish }
}
