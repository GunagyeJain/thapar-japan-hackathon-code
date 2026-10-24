// JL740 · DEL 04:35 IST → NRT 15:20 JST · sim clock · countdown to the next hand-off.
import { Plane } from "lucide-react"

import { useSimClock } from "@/lib/clock"
import { nextDeadline, useFlight } from "@/lib/flight"
import { fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Countdown } from "@/ui/Countdown"
import { DualClock } from "@/ui/DualClock"

export interface FlightContextBarProps {
  className?: string
}

export function FlightContextBar({ className }: FlightContextBarProps) {
  const flight = useFlight()
  const { now } = useSimClock()
  const f = flight.data
  const next = f && now ? nextDeadline(f, now) : null

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-x-5 gap-y-1 border-b bg-card px-6 py-2 text-sm",
        className,
      )}
    >
      {f ? (
        <span className="flex items-center gap-2 font-medium tabular">
          <span className="font-display font-semibold">{f.flight_no}</span>
          <span className="text-muted-foreground">
            {f.origin} {fmtTime(f.std, "IST")}
          </span>
          <Plane className="size-3.5 text-sky" aria-hidden="true" />
          <span className="text-muted-foreground">
            {f.dest} {fmtTime(f.sta, "JST")}
          </span>
          {f.status !== "scheduled" && (
            <span className="text-warn">
              · {f.status}
              {f.delay_min ? ` +${f.delay_min} min` : ""}
            </span>
          )}
        </span>
      ) : (
        <span className="h-4 w-56 animate-pulse rounded bg-muted" aria-label="Loading flight" />
      )}
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sim</span>
        <DualClock />
      </span>
      {next && (
        <span className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">Next: {next.label}</span>
          <Countdown until={next.at} />
        </span>
      )}
    </div>
  )
}
