// Copilot seat map: every seat coloured by the passenger's strictness tier, with flex, sun and done marks.
import { CheckCircle2, Repeat, Sunrise } from "lucide-react"
import { useMemo } from "react"

import { SeatMap, type SeatInfo } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { lastTaps, trayFor, type CopilotPackage, type CopilotTap } from "@/modules/m8-crew/copilot"
import { COPILOT } from "@/modules/m8-crew/i18n"
import { TIER_LOOK, TIER_MAP, TIER_ORDER } from "@/modules/m8-crew/tier"
import { cn } from "@/lib/utils"

interface CopilotMapProps {
  pkg: CopilotPackage
  selected: string | null
  onSeat: (seat: string) => void
}

function seatInfo(pkg: CopilotPackage): Record<string, SeatInfo> {
  const copilot = pkg.copilot
  const bySeat = new Map((copilot?.seats ?? []).map((s) => [s.seat, s]))
  const taps = copilot ? lastTaps(copilot) : new Map<string, CopilotTap>()
  const seats: Record<string, SeatInfo> = {}
  for (const p of pkg.passengers) {
    const s = bySeat.get(p.seat)
    const name = p.display_name ?? `${p.surname}/${p.given}`
    if (!s) {
      seats[p.seat] = { status: "neutral", title: `${TIER_LOOK.none.tag} · ${p.seat} · ${name}` }
      continue
    }
    const { item } = trayFor(pkg, s)
    const done = taps.get(s.passenger_id)?.type === "eaten" || item?.status === "served"
    const sun = s.sun_rule || s.may_eat_from || s.sunrise_box
    seats[p.seat] = {
      status: "neutral",
      mark: done ? "✓" : sun ? "日" : s.flex ? "F" : "",
      title: `${TIER_LOOK[s.tier].tag} · ${p.seat} · ${name}${s.flex ? " · Flex" : ""}`,
    }
  }
  return seats
}

export function CopilotMap({ pkg, selected, onSeat }: CopilotMapProps) {
  const seats = useMemo(() => seatInfo(pkg), [pkg])
  return (
    <div className="flex flex-col gap-3">
      <SeatMap
        cabins={pkg.flight.cabins}
        seats={seats}
        highlight={selected ? [selected] : undefined}
        onSeatClick={onSeat}
        variant="plane"
        className={TIER_MAP}
      />
      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legend">
      {TIER_ORDER.map((tier) => {
        const look = TIER_LOOK[tier]
        return (
          <li key={tier} className="flex items-center gap-1.5">
            <span className={cn("inline-flex size-5 items-center justify-center rounded-[5px] border", look.tone)}>
              <look.icon className="size-3" aria-hidden="true" />
            </span>
            <Bi text={look.word} inline />
          </li>
        )
      })}
      <li className="flex items-center gap-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-[5px] border border-dashed border-sky text-[10px] font-semibold text-sky">F</span>
        <Repeat className="size-3.5 text-sky" aria-hidden="true" />
        <Bi text={COPILOT.flex} inline />
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-[5px] bg-muted text-[10px] font-semibold">日</span>
        <Sunrise className="size-3.5 text-sky" aria-hidden="true" />
        <Bi text={COPILOT.sunMark} inline />
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-[5px] bg-muted text-[10px] font-semibold">✓</span>
        <CheckCircle2 className="size-3.5 text-safe" aria-hidden="true" />
        <Bi text={COPILOT.doneMark} inline />
      </li>
    </ul>
  )
}
