import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ReviewData,
  ScenarioId,
  Turn,
} from "@/core/session"

async function postJson(path: string, body: unknown): Promise<Response> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`)
  return res
}

export async function transcribe(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append("audio", blob, "audio.webm")
  const res = await fetch("/api/transcribe", { method: "POST", body: form })
  if (!res.ok) throw new Error(`Transcription failed with ${res.status}`)
  return ((await res.json()) as { transcript: string }).transcript
}

export interface ChatResult {
  response: string
  coaching: string
  suggestions?: string[]
}

export interface ChatCallbacks {
  // Accumulated reply text as it grows, token by token
  onDelta: (text: string) => void
  // The complete English reply, before coaching finishes — TTS can start here
  onResponse: (text: string) => void
}

export async function streamChat(
  body: ChatRequest,
  callbacks: ChatCallbacks
): Promise<ChatResult> {
  const res = await postJson("/api/chat", body)
  if (!res.body) throw new Error("Chat response has no body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let acc = ""
  const result: ChatResult = { response: "", coaching: "" }

  const handle = (ev: ChatEvent) => {
    if (ev.t === "delta") {
      acc += ev.x
      callbacks.onDelta(acc)
    } else if (ev.t === "response") {
      result.response = ev.x
      callbacks.onResponse(ev.x)
    } else if (ev.t === "coaching") {
      result.coaching = ev.x
    } else if (ev.t === "suggestions") {
      result.suggestions = ev.x
    } else if (ev.t === "error") {
      throw new Error(ev.x)
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop()!
    for (const line of lines) {
      if (line.trim()) handle(JSON.parse(line) as ChatEvent)
    }
  }

  result.response ||= acc.trim()
  return result
}

export async function synthesizeSpeech(
  text: string,
  voice: string
): Promise<Blob> {
  const res = await postJson("/api/tts", { text, voice })
  return res.blob()
}

export async function requestHints(
  scenario: ScenarioId,
  history: ChatMessage[]
): Promise<string[]> {
  const res = await postJson("/api/hint", { scenario, history })
  return ((await res.json()) as { suggestions: string[] }).suggestions
}

export async function requestDebrief(
  scenario: ScenarioId,
  turns: Turn[]
): Promise<ReviewData> {
  const res = await postJson("/api/debrief", { scenario, turns })
  return (await res.json()) as ReviewData
}
