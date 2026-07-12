import {
  ChartNoAxesColumn,
  Flame,
  MessageSquareText,
  Mic,
  Timer,
  X,
} from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { useProgress } from "../hooks/useProgress"
import { formatDuration } from "../helpers/format"
import { ActivityChart } from "./ActivityChart"
import { ErrorTagList } from "./ErrorTagList"
import { RecentSessions } from "./RecentSessions"
import { StatTile } from "./StatTile"

interface ProgressScreenProps {
  onClose: () => void
}

export function ProgressScreen({ onClose }: ProgressScreenProps) {
  const { loading, error, stats, sessions, reload } = useProgress()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="sticky top-0 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <h2 className="flex items-center gap-2 font-semibold">
          <ChartNoAxesColumn className="size-4 text-primary" />
          Your progress
        </h2>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close progress"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ProgressSkeleton />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
            <p className="text-center text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : stats && stats.sessionCount === 0 ? (
          <EmptyProgress onClose={onClose} />
        ) : stats ? (
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={Mic}
                iconTile="bg-violet-500/12 text-violet-600 dark:text-violet-400"
                label="Sessions"
                value={String(stats.sessionCount)}
                sub={`${stats.utteranceCount} ${stats.utteranceCount === 1 ? "answer" : "answers"} spoken`}
              />
              <StatTile
                icon={Timer}
                iconTile="bg-sky-500/12 text-sky-600 dark:text-sky-400"
                label="Practice time"
                value={formatDuration(stats.practiceMs)}
                sub={`${stats.wordCount.toLocaleString("en-US")} words spoken`}
              />
              <StatTile
                icon={MessageSquareText}
                iconTile="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                label="Avg answer"
                value={`${stats.avgUtteranceWords} words`}
                sub="aim for longer answers"
              />
              <StatTile
                icon={Flame}
                iconTile="bg-amber-500/12 text-amber-600 dark:text-amber-400"
                label="Day streak"
                value={`${stats.streakDays}${stats.streakDays === 1 ? " day" : " days"}`}
                sub={
                  stats.streakDays === 0
                    ? "practice today to start one"
                    : "keep it going"
                }
              />
            </div>

            <ActivityChart days={stats.days} />
            <ErrorTagList tags={stats.errorTags} />
            <RecentSessions sessions={sessions} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EmptyProgress({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid size-14 place-items-center rounded-3xl bg-primary/10 text-primary">
        <ChartNoAxesColumn className="size-6" />
      </div>
      <div>
        <h3 className="font-heading text-lg font-semibold">No sessions yet</h3>
        <p className="mt-1 max-w-xs text-sm text-balance text-muted-foreground">
          Finish your first conversation and your stats will show up here.
        </p>
      </div>
      <Button className="shadow-lg shadow-primary/25" onClick={onClose}>
        Start practicing
      </Button>
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  )
}
