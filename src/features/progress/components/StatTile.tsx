import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/shared/components/ui/card"
import { cn } from "@/shared/lib/utils"

interface StatTileProps {
  icon: LucideIcon
  iconTile: string
  label: string
  value: string
  sub?: string
}

export function StatTile({
  icon: Icon,
  iconTile,
  label,
  value,
  sub,
}: StatTileProps) {
  return (
    <Card size="sm" className="rounded-3xl">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              iconTile
            )}
          >
            <Icon className="size-3.5" />
          </div>
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="min-w-0">
          <div className="truncate font-heading text-2xl font-semibold tracking-tight">
            {value}
          </div>
          {sub && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {sub}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
