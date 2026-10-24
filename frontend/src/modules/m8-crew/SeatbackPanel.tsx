// m22 on the copilot: "Ask seats now", the answers so far, the seats to bring first and the ones to ask in person.
// Live while the tablet is on the cabin network (the aircraft server); the downloaded package doesn't change.
import { CheckCircle2, MessageCircleQuestion, MonitorPlay, Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, StatusChip, type Status } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { SEATBACK, type Bilingual } from "@/modules/m8-crew/i18n"
import { useSay } from "@/modules/m8-crew/lang"
import { useAskSeats, type SeatbackRow, type SeatbackStatus, type SeatStatus } from "@/modules/m22-seatback"

/** How a seat's answer shows on the serve list and the card: icon + word. */
export const SEAT_ANSWER: Record<SeatStatus, { status: Status; word: Bilingual }> = {
  asked: { status: "neutral", word: SEATBACK.asked },
  confirmed: { status: "safe", word: SEATBACK.confirmed },
  changed: { status: "info", word: SEATBACK.changed },
  skipped: { status: "neutral", word: SEATBACK.skipped },
  no_answer: { status: "warn", word: SEATBACK.noAnswer },
}

interface SeatbackPanelProps {
  flightId: string
  online: boolean
  status: SeatbackStatus | undefined
  /** Seats whose tray is already served or eaten: nothing left to bring. */
  served: Set<string>
  onSeat: (seat: string) => void
}

export function SeatbackPanel({ flightId, online, status, served, onSeat }: SeatbackPanelProps) {
  const say = useSay()
  const ask = useAskSeats(flightId)
  const seats = (status?.seats ?? []).filter((s) => !served.has(s.seat))
  const ready = seats.filter((s) => s.status === "confirmed" || s.status === "changed")
  const silent = seats.filter((s) => s.status === "no_answer")
  const c = status?.counts
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Seat screens">
      <div className="flex flex-wrap items-center gap-3">
        <MonitorPlay className="size-6 shrink-0 text-sky" aria-hidden="true" />
        <Bi text={SEATBACK.title} size="md" className="font-semibold" />
        <Button size="lg" className="ml-auto h-12" disabled={!online || ask.isPending} onClick={() => ask.mutate()}>
          <Send /> {say(status?.round ? SEATBACK.askRest : SEATBACK.ask)}
        </Button>
      </div>
      <Bi text={online ? SEATBACK.why : SEATBACK.needsNetwork} size="sm" className="text-muted-foreground" />
      {c && (status?.round ?? 0) > 0 && (
        <Bi text={SEATBACK.counts(c.confirmed, c.changed, c.skipped, c.asked, c.no_answer)} size="sm" className="font-medium tabular" />
      )}
      {ready.length > 0 && <SeatRow label={SEATBACK.deliverNow} rows={ready} icon={CheckCircle2} tone="text-safe" onSeat={onSeat} />}
      {silent.length > 0 && <SeatRow label={SEATBACK.askInPerson} rows={silent} icon={MessageCircleQuestion} tone="text-warn" onSeat={onSeat} />}
      {ready.length > 0 && <Bi text={SEATBACK.scanStill} size="sm" className="text-muted-foreground" />}
      {ask.isError && <StatusChip status="warn" label={say(SEATBACK.failed)} className="self-start" />}
    </section>
  )
}

interface SeatRowProps {
  label: Bilingual
  rows: SeatbackRow[]
  icon: typeof CheckCircle2
  tone: string
  onSeat: (seat: string) => void
}

function SeatRow({ label, rows, icon: Icon, tone, onSeat }: SeatRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", tone)}>
        <Icon className="size-4" aria-hidden="true" />
        <Bi text={label} size="sm" inline />
      </span>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <button
            key={r.seat}
            type="button"
            onClick={() => onSeat(r.seat)}
            className="h-11 min-w-14 rounded-md border border-border bg-muted px-2.5 font-display text-base font-bold tabular transition-colors duration-150 hover:border-sky"
          >
            {r.seat}
          </button>
        ))}
      </div>
    </div>
  )
}
