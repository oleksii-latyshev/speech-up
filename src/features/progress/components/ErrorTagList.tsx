import { ERROR_TAG_LABELS, type ErrorTagCount } from "@/core/session"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"

const MAX_TAGS = 6

interface ErrorTagListProps {
  tags: ErrorTagCount[]
}

export function ErrorTagList({ tags }: ErrorTagListProps) {
  const top = tags.slice(0, MAX_TAGS)
  const max = top[0]?.count ?? 0

  return (
    <Card size="sm" className="rounded-3xl">
      <CardHeader>
        <CardTitle>Recurring mistakes</CardTitle>
        <CardDescription>
          Error patterns collected from your session reviews
        </CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Finish a session and its review will start tagging your mistakes —
            the patterns show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {top.map(({ tag, count }) => (
              <li key={tag} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm">
                  {ERROR_TAG_LABELS[tag]}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
