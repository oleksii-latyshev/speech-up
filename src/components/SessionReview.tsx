import { ArrowRight, BookOpen, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SessionReviewData {
  overview: string
  corrections: { you: string; better: string }[]
  vocabulary: string[]
  praise: string
}

interface SessionReviewProps {
  loading: boolean
  data: SessionReviewData | null
  error: string | null
  onClose: () => void
  onRetry: () => void
  onNewConversation: () => void
}

export function SessionReview({
  loading,
  data,
  error,
  onClose,
  onRetry,
  onNewConversation,
}: SessionReviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Session review</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close review"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Analyzing your conversation…</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
            <p className="text-center text-sm text-red-400">{error}</p>
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : data ? (
          <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
            {data.praise && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{data.praise}</p>
              </div>
            )}

            {data.overview && (
              <section className="space-y-2">
                <h3 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                  Overview
                </h3>
                <p className="text-sm leading-relaxed">{data.overview}</p>
              </section>
            )}

            {data.corrections.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                  Say it better
                </h3>
                <div className="space-y-2">
                  {data.corrections.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card px-4 py-3">
                      <p className="text-sm text-muted-foreground line-through decoration-red-400/60">
                        {c.you}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-sm font-medium">
                        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                        {c.better}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.vocabulary.length > 0 && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                  <BookOpen className="size-3.5" />
                  Vocabulary to remember
                </h3>
                <ul className="space-y-1.5">
                  {data.vocabulary.map((v, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 text-sm text-amber-800 dark:text-amber-200"
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : null}
      </div>

      {data && !loading && (
        <div className="flex shrink-0 justify-center border-t px-4 py-4">
          <Button className="w-full max-w-sm" onClick={onNewConversation}>
            Start a new conversation
          </Button>
        </div>
      )}
    </div>
  )
}
