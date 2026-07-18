import { GraduationCap } from "lucide-react"
import {
  scenarioCardFor,
  scenarioTitle,
  type SessionSummary,
} from "@/core/session"
import { Badge } from "@/shared/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { cn } from "@/shared/lib/utils"
import { formatDuration, sessionDateLabel } from "../helpers/format"

const MAX_SESSIONS = 6

interface RecentSessionsProps {
  sessions: SessionSummary[]
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
  const recent = sessions.slice(0, MAX_SESSIONS)
  const rest = sessions.length - recent.length

  return (
    <Card size="sm" className="rounded-3xl">
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>Your latest conversations</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {recent.map((s) => {
            const card = scenarioCardFor(s.scenario)
            const Icon = card.icon
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    card.iconTile
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {scenarioTitle(s.scenario)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sessionDateLabel(s.startedAt)} ·{" "}
                    {`${s.turnCount} ${s.turnCount === 1 ? "turn" : "turns"}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {s.endedAt != null
                    ? formatDuration(s.endedAt - s.startedAt)
                    : "in progress"}
                </span>
                {s.lesson && (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-primary/30 text-primary"
                  >
                    <GraduationCap className="size-3" />
                    Lesson
                  </Badge>
                )}
                <Badge variant="outline" className="shrink-0 capitalize">
                  {s.difficulty}
                </Badge>
              </li>
            )
          })}
        </ul>
        {rest > 0 && (
          <p className="mt-2 px-2 text-xs text-muted-foreground">
            and {rest} more {rest === 1 ? "session" : "sessions"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
