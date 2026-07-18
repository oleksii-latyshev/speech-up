import type { ErrorTag } from "./contract"

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  articles: "Articles",
  tenses: "Verb tenses",
  prepositions: "Prepositions",
  "word-order": "Word order",
  vocabulary: "Word choice",
  phrasing: "Natural phrasing",
  agreement: "Agreement",
  other: "Other",
}
