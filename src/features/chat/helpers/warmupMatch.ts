// Fuzzy check that a warm-up phrase was actually spoken: transcripts are
// imperfect and nobody repeats a phrase verbatim, so match on content words.
const STOPWORDS = new Set([
  "a", "an", "the",
  "i", "you", "he", "she", "it", "we", "they",
  "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their",
  "to", "of", "in", "on", "at", "for", "with", "from", "by",
  "and", "or", "but", "so", "as", "if", "that", "this", "these", "those",
  "is", "are", "am", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "will", "would", "can", "could", "should", "not", "no",
])

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// "deadline" also matches "deadlines" / "deadline's", but short words
// ("art", "run") only match exactly to avoid false positives.
const wordMatches = (spokenWord: string, target: string): boolean =>
  spokenWord === target ||
  (target.length >= 4 && spokenWord.startsWith(target))

export function phraseUsedIn(phrase: string, transcript: string): boolean {
  const target = normalize(phrase)
  const spoken = normalize(transcript)
  if (!target || !spoken) return false

  const spokenWords = spoken.split(" ")
  const words = target.split(" ")
  const content = words.filter((w) => !STOPWORDS.has(w))
  const targets = content.length > 0 ? content : words

  if (words.length > 1 && spoken.includes(target)) return true
  const hits = targets.filter((t) =>
    spokenWords.some((s) => wordMatches(s, t))
  ).length
  if (targets.length === 1) return hits === 1
  return hits / targets.length >= 0.7
}
