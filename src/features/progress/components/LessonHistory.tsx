import { CircleCheck, CircleDashed } from "lucide-react"
import {
  ERROR_TAG_LABELS,
  scenarioTitle,
  type LessonSummary,
} from "@/core/session"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { cn } from "@/shared/lib/utils"
import { sessionDateLabel } from "../helpers/format"

const MAX_LESSONS = 6

interface LessonHistoryProps {
  lessons: LessonSummary[] // newest first
}

export function LessonHistory({ lessons }: LessonHistoryProps) {
  const recent = lessons.slice(0, MAX_LESSONS)
  const achieved = lessons.filter((l) => l.goalAchieved).length

  return (
    <Card size="sm" className="rounded-3xl">
      <CardHeader>
        <CardTitle>Course so far</CardTitle>
        <CardDescription>
          {lessons.length === 0
            ? "Lessons you finish in Lesson mode land here"
            : `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} · ${achieved} ${achieved === 1 ? "goal" : "goals"} achieved`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Switch to Lesson mode on the home screen — the coach plans each
            session around your weak spots, and finished lessons show up here.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((lesson, i) => (
              <li
                key={lesson.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                  {lessons.length - i}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {scenarioTitle(lesson.scenario)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {sessionDateLabel(lesson.createdAt)}
                    {lesson.focusTags.length > 0 &&
                      ` · ${lesson.focusTags
                        .map((tag) => ERROR_TAG_LABELS[tag])
                        .join(" · ")}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 text-xs font-semibold",
                    lesson.goalAchieved
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {lesson.goalAchieved ? (
                    <CircleCheck className="size-3.5" />
                  ) : (
                    <CircleDashed className="size-3.5" />
                  )}
                  {lesson.goalAchieved ? "Goal met" : "Carried over"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {lessons.length > MAX_LESSONS && (
          <p className="mt-2 px-2 text-xs text-muted-foreground">
            and {lessons.length - MAX_LESSONS} more
          </p>
        )}
      </CardContent>
    </Card>
  )
}
