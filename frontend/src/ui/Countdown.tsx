// Countdown on the sim clock. Warns under `warnUnder`, pulses under 15 min, says when it has passed.
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"

import { msUntil, useSimClock } from "@/lib/clock"
import { fmtDuration, fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const LIVE_MS = 15 * 60_000

/** "2h", "90m", "45s" or a number of milliseconds. */
export function parseSpan(span: string | number): number {
  if (typeof span === "number") return span
  const m = /^(\d+(?:\.\d+)?)\s*(h|m|s)$/.exec(span.trim())
  if (!m) throw new Error(`Bad time span "${span}": use 2h, 90m or 45s`)
  const unit = { h: 3_600_000, m: 60_000, s: 1000 }[m[2] as "h" | "m" | "s"]
  return Number(m[1]) * unit
}

export interface CountdownProps {
  until: string
  label?: string
  warnUnder?: string | number
  size?: "sm" | "lg"
  className?: string
}

export function Countdown({ until, label, warnUnder = "2h", size = "sm", className }: CountdownProps) {
  const { now } = useSimClock()
  if (!now) return <span className={cn("text-muted-foreground tabular", className)}>--</span>

  const left = msUntil(until, now)
  const passed = left <= 0
  const warn = !passed && left < parseSpan(warnUnder)
  const live = !passed && left < LIVE_MS
  const Icon = passed ? CheckCircle2 : warn ? AlertTriangle : Clock
  const tone = passed ? "text-muted-foreground" : warn ? "text-warn" : "text-foreground"

  if (size === "lg") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
        <span className={cn("font-display text-3xl font-bold tracking-tight whitespace-nowrap tabular", tone, live && "animate-live")}>
          {passed ? "Passed" : fmtDuration(left, { seconds: true })}
        </span>
        <span className={cn("flex items-center gap-1.5 text-sm", warn ? "text-warn" : "text-muted-foreground")}>
          <Icon className="size-4" aria-hidden="true" />
          {passed ? `Closed ${fmtTime(until, "IST")}` : `${warn ? "Under " + fmtDuration(parseSpan(warnUnder)) + " · " : ""}due ${fmtTime(until, "IST", { date: true })}`}
        </span>
      </div>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap tabular",
        warn && "bg-warn-bg px-2 py-0.5",
        tone,
        live && "animate-live",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label && <span className="font-normal text-muted-foreground">{label}</span>}
      {passed ? "passed" : fmtDuration(left)}
    </span>
  )
}
