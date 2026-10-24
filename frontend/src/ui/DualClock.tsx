// Sim time in Delhi and Tokyo, side by side.
import { useSimClock } from "@/lib/clock"
import { fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DualClockProps {
  size?: "sm" | "lg"
  className?: string
}

export function DualClock({ size = "sm", className }: DualClockProps) {
  const { now } = useSimClock()
  const big = size === "lg"
  const zones = [
    { zone: "IST" as const, city: "Delhi" },
    { zone: "JST" as const, city: "Tokyo" },
  ]
  return (
    <div className={cn("flex items-baseline tabular", big ? "gap-5" : "gap-3", className)} aria-label="Sim clock" role="timer">
      {zones.map(({ zone, city }) => (
        <span key={zone} className="whitespace-nowrap">
          <span className={cn("font-display font-semibold", big ? "text-2xl" : "text-sm")}>
            {now ? fmtTime(now, zone, { zone: false }) : "--:--"}
          </span>
          <span className={cn("ml-1 text-muted-foreground", big ? "text-xs" : "text-[11px]")}>
            {zone}
            {big && ` · ${city}`}
          </span>
        </span>
      ))}
    </div>
  )
}
