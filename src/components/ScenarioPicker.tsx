import { ArrowRight } from "lucide-react"
import { SCENARIOS, type ScenarioId } from "@/lib/scenarios"
import { cn } from "@/lib/utils"

interface ScenarioPickerProps {
  onPick: (id: ScenarioId) => void
  disabled?: boolean
}

const cardBase =
  "group relative rounded-3xl bg-card p-5 text-left ring-1 ring-foreground/10 transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/20 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50"

export function ScenarioPicker({ onPick, disabled }: ScenarioPickerProps) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Practice session
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            What do you want to practice today?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            Pick a scenario — the AI starts the conversation, you just answer.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const Icon = s.icon

            if (s.roles) {
              return (
                <div
                  key={s.id}
                  className={cn(
                    cardBase,
                    "sm:col-span-2",
                    disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-2xl",
                        s.iconTile,
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">{s.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.roles.map((role) => (
                          <button
                            key={role.id}
                            onClick={() => onPick(role.id)}
                            disabled={disabled}
                            className={cn(
                              "rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium",
                              "transition-colors hover:border-violet-500/50 hover:bg-violet-500/10",
                              "hover:text-violet-600 dark:hover:text-violet-400",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              "disabled:pointer-events-none disabled:opacity-50",
                            )}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <button
                key={s.id}
                onClick={() => onPick(s.id as ScenarioId)}
                disabled={disabled}
                className={cardBase}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-2xl",
                      s.iconTile,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-1.5 font-medium">
                      {s.title}
                      <ArrowRight className="size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
