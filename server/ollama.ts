import { config } from "./config"

export interface OllamaMessage {
  role: string
  content: string
}

async function requestChat(
  messages: OllamaMessage[],
  stream: boolean
): Promise<Response> {
  const res = await fetch(`${config.ollama.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollama.model,
      think: false,
      stream,
      messages,
    }),
  })
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  }
  return res
}

export async function chatCompletion(
  messages: OllamaMessage[]
): Promise<string> {
  const res = await requestChat(messages, false)
  const data = (await res.json()) as { message: { content: string } }
  return data.message.content.trim()
}

export async function* chatTokens(
  messages: OllamaMessage[]
): AsyncGenerator<string> {
  const res = await requestChat(messages, true)
  if (!res.body) throw new Error("Ollama response has no body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop()!
    for (const line of lines) {
      if (!line.trim()) continue
      const data = JSON.parse(line) as { message?: { content?: string } }
      if (data.message?.content) yield data.message.content
    }
  }
}
