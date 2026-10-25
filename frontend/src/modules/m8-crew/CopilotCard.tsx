// The copilot's card for one seat: the passenger's food rules in Japanese with English below, how strict,
// the tray to hand over (and which rung put it there), when they may eat, and the eaten / refused / swapped taps.
import { ArrowRightLeft, CalendarDays, CheckCircle2, MonitorPlay, ScanLine, Sunrise, XCircle } from "lucide-react"
import { useState } from "react"

import { msUntil, useSimClock } from "@/lib/clock"
import { fmtDuration, fmtTime } from "@/lib/format"
import type { MealItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, StatusChip, toast, type Status } from "@/ui"
import { AllergyTold } from "@/modules/m8-crew/AllergyTold"
import { Bi } from "@/modules/m8-crew/Bi"
import {
  lastTaps,
  needsScan,
  trayFor,
  type CopilotPackage,
  type CopilotSeat,
  type CopilotTap,
  type SeatTray,
  type TapType,
} from "@/modules/m8-crew/copilot"
import type { NewTap } from "@/modules/m8-crew/copilotStore"
import { COPILOT, COPY, rungLabel, SEATBACK, type Bilingual } from "@/modules/m8-crew/i18n"
import { useCrewLang, useSay } from "@/modules/m8-crew/lang"
import { SEAT_ANSWER } from "@/modules/m8-crew/SeatbackPanel"
import { FlexChip, TIER_LOOK, TierChip } from "@/modules/m8-crew/tier"
import type { SeatbackRow } from "@/modules/m22-seatback"

export interface CopilotCardProps {
  pkg: CopilotPackage
  seat: string
  now: () => string
  onTap: (tap: NewTap) => Promise<void>
  onScan: (seat: string) => void
  /** The seat screen's answer (m22), while the tablet is on the cabin network. */
  answer?: SeatbackRow
}

export const TAP_LOOK: Record<TapType, { status: Status; icon: typeof CheckCircle2; word: Bilingual }> = {
  eaten: { status: "safe", icon: CheckCircle2, word: COPILOT.eaten },
  refused: { status: "warn", icon: XCircle, word: COPILOT.refused },
  swapped: { status: "info", icon: ArrowRightLeft, word: COPILOT.swapped },
}

const TRAY_STATUS: Record<MealItem["status"], { status: Status; word: Bilingual }> = {
  planned: { status: "neutral", word: COPY.trayPlanned },
  loaded: { status: "info", word: COPY.trayLoaded },
  missing: { status: "unsafe", word: COPY.trayMissing },
  served: { status: "safe", word: COPY.trayServed },
}

export function CopilotCard({ pkg, seat, now, onTap, onScan, answer }: CopilotCardProps) {
  const say = useSay()
  const pax = pkg.passengers.find((p) => p.seat === seat)
  const info = pkg.copilot?.seats.find((s) => s.seat === seat)
  const head = <span className="font-display text-4xl font-bold tabular">{seat}</span>
  if (!pax || !info) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-live="polite" aria-label={`${seat} card`}>
        <div className="flex flex-wrap items-center gap-4">
          {head}
          {pax && <span className="font-display text-xl font-semibold">{pax.display_name ?? `${pax.surname}/${pax.given} ${pax.title}`}</span>}
          <StatusChip status="neutral" label={say(pax ? COPILOT.notStated : COPILOT.emptySeat)} className="h-auto py-1 whitespace-normal" />
        </div>
        {pax && <AllergyTold key={pax.id} pkg={pkg} pax={pax} />}
      </section>
    )
  }
  const tap = pkg.copilot ? lastTaps(pkg.copilot).get(info.passenger_id) : undefined
  const current = trayFor(pkg, info)
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-live="polite" aria-label={`${seat} card`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-8">
        {head}
        <span className="font-display text-xl font-semibold">{pax.display_name ?? `${pax.surname}/${pax.given} ${pax.title}`}</span>
        <TierChip tier={info.tier} />
        {info.flex && <FlexChip />}
      </div>
      {answer && (
        <div className="flex flex-col gap-1">
          <StatusChip status={SEAT_ANSWER[answer.status].status} icon={MonitorPlay} label={say(SEAT_ANSWER[answer.status].word)} className="self-start" />
          {(answer.status === "confirmed" || answer.status === "changed") && <Bi text={SEATBACK.scanStill} size="sm" className="text-muted-foreground" />}
        </div>
      )}
      <Rules seat={info} />
      <SunTimer seat={info} />
      <Tray pkg={pkg} seat={info} current={current} />
      <Taps seat={info} item={current.item} tap={tap} now={now} onTap={onTap} onScan={onScan} />
      <AllergyTold key={pax.id} pkg={pkg} pax={pax} />
    </section>
  )
}

/** The passenger's card: Japanese large, English underneath (or one language), and why the tier matters. */
function Rules({ seat }: { seat: CopilotSeat }) {
  const mode = useCrewLang()
  const say = useSay()
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background/40 px-4 py-3">
      {mode !== "en" && (
        <p lang="ja" className="text-xl leading-snug font-semibold">
          {seat.card.ja}
        </p>
      )}
      {mode !== "ja" && <p className={cn(mode === "both" ? "text-muted-foreground" : "text-xl leading-snug font-semibold")}>{seat.card.en}</p>}
      <p className="mt-1 text-sm text-muted-foreground">{say(TIER_LOOK[seat.tier].why)}{seat.flex ? ` · ${say(COPILOT.whyFlex)}` : ""}</p>
      {seat.fast_today && (
        <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-sm">
          <CalendarDays className="size-4 text-sky" aria-hidden="true" />
          {say(COPILOT.fastToday)}
        </span>
      )}
    </div>
  )
}

/** When a daylight-only eater may eat, counted down on the sim clock; or the Sunrise Box. */
function SunTimer({ seat }: { seat: CopilotSeat }) {
  const say = useSay()
  const { now } = useSimClock()
  if (seat.sunrise_box) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-secondary px-4 py-3">
        <Sunrise className="mt-0.5 size-6 shrink-0 text-sky" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <Bi text={COPILOT.sunriseBox} size="lg" />
          <Bi text={seat.sun_note ? { ja: seat.sun_note.ja ?? seat.sun_note.en, en: seat.sun_note.en } : COPILOT.sunriseBoxWhy} size="sm" />
        </div>
      </div>
    )
  }
  if (!seat.may_eat_from) {
    if (!seat.sun_rule) return null
    return (
      <div className="flex items-start gap-3 rounded-lg bg-secondary px-4 py-3">
        <Sunrise className="mt-0.5 size-6 shrink-0 text-sky" aria-hidden="true" />
        <Bi text={COPILOT.sunNoTime} size="sm" />
      </div>
    )
  }
  const from = fmtTime(seat.may_eat_from, "IST", { zone: false })
  const left = now ? msUntil(seat.may_eat_from, now) : null
  const until = seat.may_eat_until ? fmtTime(seat.may_eat_until, "IST", { zone: false }) : null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-secondary px-4 py-3" role="timer" aria-label={say(COPILOT.mayEatFrom(from))}>
      <Sunrise className="size-7 shrink-0 text-sky" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Bi text={COPILOT.mayEatFrom(from)} size="lg" className="tabular" />
        {until && <Bi text={COPILOT.mayEatUntil(until)} size="sm" className="mt-1 tabular" />}
        {seat.sun_note && <p className="mt-1 text-sm text-muted-foreground">{say({ ja: seat.sun_note.ja ?? seat.sun_note.en, en: seat.sun_note.en })}</p>}
      </div>
      {left !== null && (
        <span className={cn("rounded-md px-3 py-2 font-display text-xl font-bold tabular", left > 0 ? "bg-card text-blue" : "bg-safe-bg text-safe")}>
          {left > 0 ? say(COPILOT.mayEatIn(fmtDuration(left))) : say(COPILOT.mayEatNow)}
        </span>
      )}
    </div>
  )
}

/** The tray to hand over: dish, tray id, galley and position, the rung that put it there, and its status. */
function Tray({ pkg, seat, current }: { pkg: CopilotPackage; seat: CopilotSeat; current: SeatTray }) {
  const say = useSay()
  const { tray, item } = current
  const spec = tray?.spec_id ? pkg.specs.find((s) => s.id === tray.spec_id) : undefined
  return (
    <div className="flex flex-col gap-2">
      <Bi text={COPILOT.trayTitle} size="sm" className="font-semibold text-muted-foreground" />
      {tray ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border px-4 py-3">
          <div className="flex items-start gap-2.5">
            {spec?.code && <span className="code mt-0.5 rounded bg-muted px-2 py-0.5 text-base font-semibold">{spec.code}</span>}
            <Bi text={{ ja: tray.spec_name.ja ?? tray.spec_name.en, en: tray.spec_name.en }} size="md" className="min-w-0 flex-1 font-medium [&>span:first-child]:text-lg" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            {tray.item_id && <span className="code font-semibold">{tray.item_id}</span>}
            {item && <span className="text-muted-foreground tabular">{say(COPY.galleyShort(item.galley))} · {item.position}</span>}
            <span className="rounded-md bg-secondary px-2 py-0.5">{say(rungLabel(tray.rung))}</span>
            {item && <StatusChip size="sm" status={TRAY_STATUS[item.status].status} label={say(TRAY_STATUS[item.status].word)} />}
          </div>
        </div>
      ) : seat.needs_tray ? (
        <StatusChip status="warn" label={say(COPILOT.needsTray)} className="h-auto py-2 whitespace-normal" />
      ) : (
        <p className="rounded-lg border border-border p-4 text-base">{say(COPILOT.anyMain)}</p>
      )}
    </div>
  )
}

interface TapsProps {
  seat: CopilotSeat
  item: MealItem | undefined
  tap: CopilotTap | undefined
  now: () => string
  onTap: (tap: NewTap) => Promise<void>
  onScan: (seat: string) => void
}

/** Scan-to-serve stays the gate for special trays; then Eaten · Refused · Swapped go into the sync queue. */
function Taps({ seat, item, tap, now, onTap, onScan }: TapsProps) {
  const say = useSay()
  const mode = useCrewLang()
  const [busy, setBusy] = useState(false)
  const gate = needsScan(item)
  const record = async (type: TapType) => {
    setBusy(true)
    try {
      await onTap({ type, passenger_id: seat.passenger_id, seat: seat.seat, item_id: item?.id ?? null, at: now() })
    } catch (e: unknown) {
      toast.error(`${say(COPILOT.tapFailed)}${e instanceof Error ? ` (${e.message})` : ""}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2.5 border-t pt-3">
      {gate && (
        <div className="flex flex-col gap-2">
          <Button size="lg" className="h-auto min-h-12 w-full py-2 text-base whitespace-normal" onClick={() => onScan(seat.seat)}>
            <ScanLine /> {say(COPILOT.scanToServe)}
          </Button>
          <Bi text={COPILOT.scanFirst} size="sm" className="text-muted-foreground" />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(TAP_LOOK) as TapType[]).map((type) => {
          const look = TAP_LOOK[type]
          const on = tap?.type === type
          return (
            <Button
              key={type}
              size="lg"
              variant={on ? "secondary" : "outline"}
              aria-pressed={on}
              className={cn("h-14 flex-col gap-0 text-base leading-tight", on && "ring-1 ring-blue")}
              disabled={busy || (type === "eaten" && gate)}
              onClick={() => void record(type)}
            >
              <span className="flex items-center gap-1.5">
                <look.icon aria-hidden="true" />
                <span lang={mode === "en" ? "en" : "ja"}>{mode === "en" ? look.word.en : look.word.ja}</span>
              </span>
              {mode === "both" && <span className="text-xs opacity-80">{look.word.en}</span>}
            </Button>
          )
        })}
      </div>
      {tap && (
        <StatusChip
          status={TAP_LOOK[tap.type].status}
          icon={TAP_LOOK[tap.type].icon}
          label={say(COPILOT.lastTap(TAP_LOOK[tap.type].word, fmtTime(tap.at, "IST")))}
        />
      )}
    </div>
  )
}
