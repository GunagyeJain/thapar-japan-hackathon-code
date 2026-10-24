// When a passenger with a sun-time rule may eat, counting down on the sim clock.
// Used on the crew tablet (cabin dark mode) and the passenger phone; strings in EN/HI/JA.
import { Package, Sunrise } from "lucide-react"

import { msUntil, useSimClock } from "@/lib/clock"
import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { StatusChip } from "@/ui"

import { fmtLeft } from "./format"
import { fill, s } from "./i18n"

export interface SunTimerProps {
  /** ISO time with offset, or null when there's no limit on board. */
  mayEatFrom: string | null
  sunriseBox: boolean
  lang: Lang
  size?: "sm" | "md"
  className?: string
}

export function SunTimer({ mayEatFrom, sunriseBox, lang, size = "md", className }: SunTimerProps) {
  const { now } = useSimClock()
  const chip = size === "sm" ? "sm" : "md"

  if (sunriseBox) {
    return <StatusChip status="info" icon={Package} size={chip} label={t(s.box, lang)} className={className} />
  }
  if (!mayEatFrom) {
    return <StatusChip status="neutral" size={chip} label={t(s.noLimit, lang)} className={className} />
  }

  const time = fmtTime(mayEatFrom, "IST")
  const eatFrom = fill(t(s.eatFrom, lang), { time })
  const left = now ? msUntil(mayEatFrom, now) : null
  if (left !== null && left <= 0) {
    return <StatusChip status="safe" size={chip} label={`${t(s.open, lang)} · ${time}`} className={className} />
  }
  const countdown = left === null ? null : fill(t(s.left, lang), { d: fmtLeft(left, lang) })

  if (size === "sm") {
    return (
      <span lang={lang} className={cn("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap tabular", className)}>
        <Sunrise className="size-4 shrink-0 text-blue dark:text-sky" aria-hidden="true" />
        {eatFrom}
        {countdown && <span className="font-normal text-muted-foreground">· {countdown}</span>}
      </span>
    )
  }
  return (
    <div lang={lang} className={cn("flex items-center gap-3", className)}>
      <span className="rounded-full bg-ice p-2 text-blue dark:bg-secondary dark:text-sky">
        <Sunrise className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-semibold tabular">{eatFrom}</span>
        {countdown && <span className="text-sm text-muted-foreground tabular">{countdown}</span>}
      </span>
    </div>
  )
}
