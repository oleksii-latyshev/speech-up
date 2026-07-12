import { Lightbulb, Volume2 } from "lucide-react"

interface SuggestionChipsProps {
  suggestions: string[]
  onPlay: (text: string) => void
}

export function SuggestionChips({ suggestions, onPlay }: SuggestionChipsProps) {
  return (
    <div className="ml-9 animate-message-in space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        <Lightbulb className="size-3 text-sky-500" />
        You could say
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPlay(s)}
            className="flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/8 px-3.5 py-2 text-left text-xs font-medium text-sky-700 transition-all hover:border-sky-500/50 hover:bg-sky-500/15 active:scale-[0.98] dark:text-sky-300"
            title="Tap to hear it, then say it yourself"
          >
            <Volume2 className="size-3 shrink-0 opacity-60" />
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
