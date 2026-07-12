import { Check, Target, Volume2 } from "lucide-react"
import type { WarmupPhrase } from "@/core/session"
import { cn } from "@/shared/lib/utils"

interface WarmupCardProps {
  phrases: WarmupPhrase[]
  used: boolean[]
  onPlay: (text: string) => void
}

export function WarmupCard({ phrases, used, onPlay }: WarmupCardProps) {
  const usedCount = used.filter(Boolean).length
  const allUsed = usedCount === phrases.length

  return (
    <section className="animate-message-in rounded-3xl bg-card p-4 shadow-xs ring-1 ring-primary/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-widest text-primary uppercase">
              Warm-up
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Phrases from your past sessions — work them in today
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors",
            allUsed
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {allUsed ? "All done!" : `${usedCount} of ${phrases.length}`}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {phrases.map((phrase, i) => (
          <li key={phrase.text}>
            <button
              onClick={() => onPlay(phrase.text)}
              title="Tap to hear it, then say it yourself"
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors",
                used[i] ? "bg-emerald-500/8" : "hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-all duration-300",
                  used[i]
                    ? "bg-emerald-500 text-white"
                    : "text-transparent ring-1 ring-border"
                )}
              >
                <Check className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    used[i] && "text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  {phrase.text}
                </span>
                {phrase.hint && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {phrase.source === "correction"
                      ? `instead of “${phrase.hint}”`
                      : phrase.hint}
                  </span>
                )}
              </span>
              <Volume2 className="mt-1 size-3.5 shrink-0 text-muted-foreground/60" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
