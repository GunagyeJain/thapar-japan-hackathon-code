// Countdown to the caterer's final list, plus every hand-off deadline, all on the sim clock.
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"

import { msUntil } from "@/lib/clock"
import { fmtDuration, fmtTime } from "@/lib/format"
import type { Flight } from "@/lib/types"
import { cn } from "@/lib/utils"

const WARN_MS = 2 * 60 * 60 * 1000

interface DeadlinesProps {
  flight: Flight
  now: Date
}

export function CatererCountdown({ flight, now }: DeadlinesProps) {
  const left = msUntil(flight.caterer_final_list_at, now)
  const passed = left <= 0
  const urgent = !passed && left < WARN_MS
  return (
    <section className="flex flex-col justify-between rounded-xl border bg-card p-5" aria-label="Caterer final list countdown">
      <div className="text-sm text-grey">Caterer's final list</div>
      <div className="mt-2 font-display text-2xl font-bold tracking-tight whitespace-nowrap text-navy tabular">
        {passed ? "Sent" : fmtDuration(left, { seconds: true })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-sm">
        {passed ? (
          <span className="flex items-center gap-1.5 text-safe">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Closed at {fmtTime(flight.caterer_final_list_at, "IST")}
          </span>
        ) : urgent ? (
          <span className="flex items-center gap-1.5 rounded-md bg-warn-bg px-2 py-0.5 text-warn">
            <AlertTriangle className="size-4" aria-hidden="true" /> Under 2 h · due {fmtTime(flight.caterer_final_list_at, "IST")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-grey">
            <Clock className="size-4" aria-hidden="true" /> Due {fmtTime(flight.caterer_final_list_at, "IST", { date: true })}
          </span>
        )}
      </div>
    </section>
  )
}

export function DeadlineList({ flight, now }: DeadlinesProps) {
  const steps = [
    { label: "Special-meal cutoff (T-25 h)", at: flight.special_meal_cutoff },
    { label: "Caterer final list", at: flight.caterer_final_list_at },
    { label: "Meals dispatched", at: flight.dispatch_at },
    { label: "Boarding", at: flight.boarding_at },
    { label: "Departure DEL", at: flight.std },
  ]
  const nextIndex = steps.findIndex((s) => msUntil(s.at, now) > 0)
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const done = msUntil(s.at, now) <= 0
        const next = i === nextIndex
        return (
          <li key={s.label} className="flex h-10 items-center gap-3 border-b last:border-b-0">
            <span
              className={cn("size-2 shrink-0 rounded-full", done ? "bg-grey/40" : next ? "bg-blue" : "border border-line")}
              aria-hidden="true"
            />
            <span className={cn("flex-1 text-sm", done ? "text-grey" : "text-navy", next && "font-medium")}>{s.label}</span>
            <span className="text-sm text-grey tabular">{fmtTime(s.at, "IST", { date: true })}</span>
            <span className={cn("w-24 text-right text-xs tabular", next ? "font-medium text-blue" : "text-grey")}>
              {done ? "done" : `in ${fmtDuration(msUntil(s.at, now))}`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
