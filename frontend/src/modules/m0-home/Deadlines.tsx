// Every hand-off deadline of the flight, on the sim clock.
import { msUntil, useSimClock } from "@/lib/clock"
import { flightDeadlines, nextDeadline } from "@/lib/flight"
import { fmtDuration, fmtTime } from "@/lib/format"
import type { Flight } from "@/lib/types"
import { cn } from "@/lib/utils"

interface DeadlineListProps {
  flight: Flight
}

export function DeadlineList({ flight }: DeadlineListProps) {
  const { now } = useSimClock()
  if (!now) return null
  const next = nextDeadline(flight, now)
  return (
    <ol className="flex flex-col">
      {flightDeadlines(flight).map((d) => {
        const left = msUntil(d.at, now)
        const done = left <= 0
        const isNext = d.id === next?.id
        return (
          <li key={d.id} className="flex h-10 items-center gap-3 border-b last:border-b-0">
            <span
              className={cn("size-2 shrink-0 rounded-full", done ? "bg-grey/40" : isNext ? "bg-blue" : "border border-line")}
              aria-hidden="true"
            />
            <span className={cn("flex-1 text-sm", done ? "text-grey" : "text-navy", isNext && "font-medium")}>{d.label}</span>
            <span className="text-sm text-grey tabular">{fmtTime(d.at, "IST", { date: true })}</span>
            <span className={cn("w-24 text-right text-xs tabular", isNext ? "font-medium text-blue" : "text-grey")}>
              {done ? "done" : `in ${fmtDuration(left)}`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
