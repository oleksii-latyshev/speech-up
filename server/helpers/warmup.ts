import type { WarmupPhrase } from "../../src/core/session/contract"

export interface CorrectionRow {
  you: string
  better: string
}

export interface WarmupRows {
  corrections: CorrectionRow[] // most recent session first
  vocabulary: string[] // most recent session first
}

export const WARMUP_SIZE = 3
const MAX_PHRASE_WORDS = 12

const normalize = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, " ").trim()

const wordCount = (text: string): number =>
  text.trim() === "" ? 0 : text.trim().split(/\s+/).length

export const parseVocabularyEntry = (
  raw: string
): { text: string; hint: string } => {
  const [text, ...rest] = raw.split(/\s+[—–-]\s+/)
  return { text: text.trim(), hint: rest.join(" — ").trim() }
}

// Recency-weighted sampling without replacement: newest candidates are the
// most likely picks, but older ones still rotate in across sessions.
const weightedSample = <T>(
  items: T[],
  count: number,
  random: () => number
): T[] => {
  const pool = items.map((item, i) => ({ item, weight: items.length - i }))
  const picked: T[] = []
  while (pool.length > 0 && picked.length < count) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0)
    let r = random() * total
    let idx = pool.findIndex((p) => (r -= p.weight) < 0)
    if (idx === -1) idx = pool.length - 1
    picked.push(pool.splice(idx, 1)[0].item)
  }
  return picked
}

const dedupe = (phrases: WarmupPhrase[]): WarmupPhrase[] => {
  const seen = new Set<string>()
  return phrases.filter((p) => {
    const key = normalize(p.text)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function selectWarmupPhrases(
  rows: WarmupRows,
  random: () => number = Math.random
): WarmupPhrase[] {
  const corrections = dedupe(
    rows.corrections
      .filter((c) => c.better.trim() && wordCount(c.better) <= MAX_PHRASE_WORDS)
      .map((c) => ({
        text: c.better.trim(),
        hint: c.you.trim(),
        source: "correction" as const,
      }))
  )
  const vocabulary = dedupe(
    rows.vocabulary
      .map(parseVocabularyEntry)
      .filter((v) => v.text && wordCount(v.text) <= MAX_PHRASE_WORDS)
      .map((v) => ({ ...v, source: "vocabulary" as const }))
  )

  const picked = [
    ...weightedSample(corrections, 2, random),
    ...weightedSample(vocabulary, 1, random),
  ]
  const pickedKeys = new Set(picked.map((p) => normalize(p.text)))
  const backfill = [...corrections, ...vocabulary].filter(
    (p) => !pickedKeys.has(normalize(p.text))
  )
  return dedupe([
    ...picked,
    ...weightedSample(backfill, WARMUP_SIZE - picked.length, random),
  ]).slice(0, WARMUP_SIZE)
}
