import { useState } from "react"
import { ArrowLeft, GraduationCap, Loader2, MessagesSquare } from "lucide-react"
import type { Difficulty, LessonPlan, ScenarioId } from "@/core/session"
import type { PracticeMode } from "@/core/settings"
import { Button } from "@/shared/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { useLessonPlan } from "../hooks/useLessonPlan"
import { LessonCard } from "./LessonCard"
import { ScenarioPicker } from "./ScenarioPicker"

interface HomeScreenProps {
  practiceMode: PracticeMode
  onPracticeModeChange: (m: PracticeMode) => void
  difficulty: Difficulty
  onDifficultyChange: (d: Difficulty) => void
  onPick: (id: ScenarioId, plan?: LessonPlan) => void
  onPlayPhrase: (text: string) => void
  disabled?: boolean
}

const MODES: { id: PracticeMode; label: string; icon: typeof GraduationCap }[] =
  [
    { id: "free", label: "Free practice", icon: MessagesSquare },
    { id: "lesson", label: "Lesson", icon: GraduationCap },
  ]

export function HomeScreen({
  practiceMode,
  onPracticeModeChange,
  difficulty,
  onDifficultyChange,
  onPick,
  onPlayPhrase,
  disabled,
}: HomeScreenProps) {
  const [pickingScenario, setPickingScenario] = useState(false)
  const lesson = useLessonPlan(practiceMode === "lesson")

  const isLesson = practiceMode === "lesson"
  const showPicker = !isLesson || pickingScenario

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex min-h-full flex-col">
        <div className="flex justify-center px-4 pt-6">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 ring-1 ring-border">
            {MODES.map((m) => {
              const ModeIcon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onPracticeModeChange(m.id)
                    setPickingScenario(false)
                  }}
                  disabled={disabled}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold transition-all",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    practiceMode === m.id
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ModeIcon className="size-3.5" />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {showPicker ? (
          <div className="flex flex-1 flex-col">
            {isLesson && (
              <button
                onClick={() => setPickingScenario(false)}
                className="mx-auto mt-4 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Back to today's lesson
              </button>
            )}
            <ScenarioPicker
              onPick={(id) =>
                onPick(id, isLesson ? (lesson.plan ?? undefined) : undefined)
              }
              difficulty={difficulty}
              onDifficultyChange={onDifficultyChange}
              disabled={disabled}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-8">
            {lesson.loading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm font-medium">Preparing your lesson…</p>
                <p className="text-xs">
                  The coach is going through your recent sessions
                </p>
              </div>
            ) : lesson.error ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm text-destructive">
                  {lesson.error}
                </p>
                <Button variant="outline" onClick={lesson.retry}>
                  Try again
                </Button>
              </div>
            ) : lesson.plan ? (
              <div className="w-full max-w-xl">
                <div className="mb-6 text-center">
                  <p className="mb-2.5 text-xs font-semibold tracking-widest text-primary uppercase">
                    {lesson.lessonNumber
                      ? `Lesson ${lesson.lessonNumber}`
                      : "Today's lesson"}
                  </p>
                  <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                    Your coach prepared a plan
                  </h2>
                </div>
                <LessonCard
                  plan={lesson.plan}
                  onStart={() => onPick(lesson.plan!.scenario, lesson.plan!)}
                  onChangeScenario={() => setPickingScenario(true)}
                  onRegenerate={lesson.regenerate}
                  onPlayPhrase={onPlayPhrase}
                  disabled={disabled}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
