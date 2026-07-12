import { GraduationCap, Sparkles } from "lucide-react"

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex animate-message-in justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 shadow-sm shadow-primary/20">
        <p className="text-sm leading-relaxed text-primary-foreground">
          {text}
        </p>
      </div>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-sm shadow-primary/30">
      <Sparkles className="size-3.5 text-primary-foreground" />
    </div>
  )
}

export function AssistantBubble({
  text,
  streaming,
}: {
  text: string
  streaming?: boolean
}) {
  return (
    <div className="flex animate-message-in items-start gap-2.5">
      <AssistantAvatar />
      <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-card px-4 py-2.5 shadow-xs ring-1 ring-border">
        <p className="text-sm leading-relaxed">
          {text}
          {streaming && (
            <span className="ml-1 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-primary/70 align-middle" />
          )}
        </p>
      </div>
    </div>
  )
}

export function TypingBubble() {
  return (
    <div className="flex animate-message-in items-start gap-2.5">
      <AssistantAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-card px-4 py-3.5 shadow-xs ring-1 ring-border">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  )
}

export function CoachingNote({ text }: { text: string }) {
  return (
    <div className="ml-9 flex animate-message-in items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5">
      <GraduationCap className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-widest text-amber-600/80 uppercase dark:text-amber-400/80">
          Coach
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          {text}
        </p>
      </div>
    </div>
  )
}
