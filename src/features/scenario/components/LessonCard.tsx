import { ArrowRight, Repeat2, Target, Volume2 } from "lucide-react"
import {
  ERROR_TAG_LABELS,
  scenarioCardFor,
  scenarioTitle,
  type LessonPlan,
} from "@/core/session"
import { Button } from "@/shared/components/ui/button"
import { cn } from "@/shared/lib/utils"

interface LessonCardProps {
  plan: LessonPlan
  onStart: () => void
  onChangeScenario: () => void
  onPlayPhrase: (text: string) => void
  disabled?: boolean
}

export function LessonCard({
  plan,
  onStart,
  onChangeScenario,
  onPlayPhrase,
  disabled,
}: LessonCardProps) {
  const card = scenarioCardFor(plan.scenario)
  const Icon = card.icon

  return (
    <div className="w-full max-w-xl">
      <div className="rounded-3xl bg-card p-6 shadow-xs ring-1 ring-border">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              card.iconTile
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-lg font-semibold tracking-tight">
              {scenarioTitle(plan.scenario)}
            </h3>
            {plan.focusTags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {plan.focusTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {ERROR_TAG_LABELS[tag]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed">{plan.focusNote}</p>

        {plan.targetPhrases.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Phrases to work in
            </p>
            <ul className="mt-1.5 space-y-1">
              {plan.targetPhrases.map((phrase) => (
                <li key={phrase}>
                  <button
                    onClick={() => onPlayPhrase(phrase)}
                    disabled={disabled}
                    title="Tap to hear it"
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted/60 disabled:pointer-events-none"
                  >
                    <span className="flex-1">{phrase}</span>
                    <Volume2 className="size-3.5 shrink-0 text-muted-foreground/60" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-primary/5 px-3.5 py-2.5 ring-1 ring-primary/15">
          <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed">{plan.microGoal}</p>
        </div>

        <Button
          className="mt-5 w-full shadow-lg shadow-primary/25"
          onClick={onStart}
          disabled={disabled}
        >
          Start lesson
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <button
        onClick={onChangeScenario}
        disabled={disabled}
        className="mx-auto mt-3 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <Repeat2 className="size-3.5" />
        Pick a different scenario — focus and goals stay
      </button>
    </div>
  )
}
