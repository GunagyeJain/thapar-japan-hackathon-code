// Where ThaliBento plugs in: the passenger's own words instead of a code. The live /chat runs inside the booking
// page (same server, same passenger), so everything said here lands in the same passport, promise and Radar.
import { CalendarClock, ExternalLink, Languages, Radio, ShieldCheck, type LucideIcon } from "lucide-react"

import { useSimClock } from "@/lib/clock"
import type { FlightDetail } from "@/lib/types"
import { Button, StatusChip } from "@/ui"

import { isOpen } from "./deadlines"
import { s, tr, type PageLang } from "./i18n"

interface ThaliPanelProps {
  flight: FlightDetail
  passengerId: string
  name: string
  lang: PageLang
}

const POINTS: [LucideIcon, typeof s.point1][] = [
  [ShieldCheck, s.point1],
  [CalendarClock, s.point2],
  [Radio, s.point3],
]

export function ThaliPanel({ flight, passengerId, name, lang }: ThaliPanelProps) {
  const { now } = useSimClock()
  const chat = `/chat?passenger=${encodeURIComponent(passengerId)}`
  const closed = !isOpen(flight.special_meal_cutoff, now)

  return (
    <section aria-labelledby="panel-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:p-6">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-grey uppercase">
          <Languages className="size-3.5" aria-hidden="true" /> {tr(s.panelEyebrow, lang)}
        </p>
        <h2 id="panel-title" className="mt-1 text-xl font-bold text-navy">
          {tr(s.panelTitle, lang)}
        </h2>
        <p className="mt-1 text-sm text-grey">{tr(s.panelBody, lang)}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-navy">
        {POINTS.map(([Icon, text]) => (
          <li key={text.en} className="flex gap-2">
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {tr(text, lang)}
          </li>
        ))}
      </ul>
      {closed && (
        <p className="flex flex-col gap-1.5 rounded-lg bg-muted p-3 text-sm text-navy">
          <StatusChip status="info" size="sm" label={tr(s.stillListening, lang)} />
          {tr(s.afterCutoff, lang)}
        </p>
      )}
      <div className="mx-auto w-full max-w-[400px] rounded-[2rem] border-8 border-navy bg-navy">
        <iframe
          title={tr(s.frameTitle, lang, { name })}
          src={chat}
          loading="lazy"
          className="block h-[600px] w-full rounded-[1.5rem] bg-background md:h-[640px]"
        />
      </div>
      <Button asChild variant="outline" className="w-fit self-center rounded-full">
        <a href={chat} target="_blank" rel="noopener">
          {tr(s.openTab, lang)} <ExternalLink />
        </a>
      </Button>
    </section>
  )
}
