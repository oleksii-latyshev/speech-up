import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import type { DayActivity } from "@/core/session"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/components/ui/chart"
import { dayTickLabel, dayTooltipLabel } from "../helpers/format"

const chartConfig = {
  minutes: { label: "Practice", color: "var(--primary)" },
} satisfies ChartConfig

interface ActivityChartProps {
  days: DayActivity[]
}

export function ActivityChart({ days }: ActivityChartProps) {
  return (
    <Card size="sm" className="rounded-3xl">
      <CardHeader>
        <CardTitle>Last 14 days</CardTitle>
        <CardDescription>Minutes practiced per day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-44 w-full"
        >
          <BarChart
            data={days}
            margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={dayTickLabel}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => dayTooltipLabel(String(value))}
                  formatter={(value, _name, item) => {
                    const day = item.payload as DayActivity
                    return (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">Practice</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {String(value)} min ·{" "}
                          {`${day.sessions} ${day.sessions === 1 ? "session" : "sessions"}`}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Bar
              dataKey="minutes"
              fill="var(--color-minutes)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
