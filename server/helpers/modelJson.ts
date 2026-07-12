// Small models wrap JSON in prose or fences — extract the outermost object.
export function extractJsonObject<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Unexpected model output: ${raw}`)
  return JSON.parse(match[0]) as T
}
