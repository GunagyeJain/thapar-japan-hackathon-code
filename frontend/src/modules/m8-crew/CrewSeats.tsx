// Seat map with diet badges (from the package), a card for the tapped seat, and boarding alerts when online.
import { useQuery } from "@tanstack/react-query"
import { BellRing, ScanLine } from "lucide-react"
import { useMemo, useState } from "react"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import { fmtTime } from "@/lib/format"
import type { CrewPackage } from "@/lib/offline/types"
import { label } from "@/lib/rules"
import type { MealItem, Notification, PassengerWithPromise } from "@/lib/types"
import { Button, SeatMap, StatusChip, type SeatInfo, type Status } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { COPY, type Bilingual } from "@/modules/m8-crew/i18n"
import { useCrewLang, useDish, useSay } from "@/modules/m8-crew/lang"
import { lookup } from "@/modules/m8-crew/logic"

interface CrewSeatsProps {
  pkg: CrewPackage
  online: boolean
  onSeat: (seat: string) => void
}

const TRAY: Record<MealItem["status"], { status: Status; text: Bilingual }> = {
  planned: { status: "neutral", text: COPY.trayPlanned },
  loaded: { status: "info", text: COPY.trayLoaded },
  missing: { status: "unsafe", text: COPY.trayMissing },
  served: { status: "safe", text: COPY.trayServed },
}

/** Judges who joined after the download, seen while the tablet is online. */
function lateJudges(pkg: CrewPackage, live: PassengerWithPromise[]): PassengerWithPromise[] {
  const known = new Set(pkg.passengers.map((p) => p.id))
  return live.filter((p) => p.is_judge && !known.has(p.id))
}

function seatInfo(pkg: CrewPackage, live: PassengerWithPromise[]): Record<string, SeatInfo> {
  const L = lookup(pkg)
  const seats: Record<string, SeatInfo> = {}
  for (const p of [...pkg.passengers, ...lateJudges(pkg, live)]) {
    const items = pkg.items.filter((i) => i.assigned_passenger_id === p.id)
    const served = items.some((i) => i.status === "served")
    const missing = items.some((i) => i.kind === "special" && i.status === "missing") && !items.some((i) => i.kind !== "special" && i.status === "loaded")
    const code = items.map((i) => L.specs.get(i.spec_id)?.code).find(Boolean) ?? p.ssr_meal
    const diet = pkg.forbid[p.id]
    seats[p.seat] = {
      status: served ? "safe" : missing ? "unsafe" : p.is_judge ? "warn" : diet ? "info" : "neutral",
      mark: p.is_judge ? "J" : code ? code.slice(0, 2) : "",
      title: `${p.seat} · ${p.display_name ?? `${p.surname}/${p.given}`}${code ? ` · ${code}` : ""}`,
    }
  }
  return seats
}

/** Who sits in the tapped seat, what they can't eat, and where their tray is. */
function SeatDetail({ pkg, seat, live, onServe }: { pkg: CrewPackage; seat: string; live: PassengerWithPromise[]; onServe: () => void }) {
  const say = useSay()
  const dish = useDish()
  const mode = useCrewLang()
  const L = lookup(pkg)
  const inPackage = pkg.passengers.find((p) => p.seat === seat)
  const late = inPackage ? undefined : lateJudges(pkg, live).find((p) => p.seat === seat)
  const pax = inPackage ?? late
  const head = <span className="font-display text-3xl font-bold tabular">{seat}</span>
  if (!pax) {
    return (
      <section className="flex items-center gap-4 rounded-xl border bg-card p-5">
        {head}
        <StatusChip status="neutral" label={say(COPY.seatEmpty)} />
      </section>
    )
  }
  const promise = inPackage ? pkg.promises.find((p) => p.passenger_id === pax.id) : late?.promise
  const items = pkg.items.filter((i) => i.assigned_passenger_id === pax.id)
  const tagLang = mode === "en" ? "en" : "ja"
  const forbid = pkg.forbid[pax.id]?.forbid ?? []
  const cantEat = forbid.map((t) => label(t, tagLang)).join(tagLang === "ja" ? "、" : ", ")
  const mark = promise?.label_mark
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {head}
        <span className="font-display text-xl font-semibold">{pax.display_name ?? `${pax.surname}/${pax.given} ${pax.title}`}</span>
        {pax.is_judge && <StatusChip status="warn" label={say(COPY.judge)} />}
        {(promise?.code ?? pax.ssr_meal) && <span className="code rounded bg-muted px-2 py-0.5 text-base font-semibold">{promise?.code ?? pax.ssr_meal}</span>}
      </div>
      {mark && <p className="text-lg font-medium">{say({ ja: mark.ja ?? mark.en, en: mark.en })}</p>}
      {late ? (
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">{say(COPY.joinedAfter)}</p>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{say(COPY.cantEat)}</dt>
            <dd className="mt-0.5">{cantEat || say(COPY.noDiet)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{say(COPY.tray)}</dt>
            <dd className="mt-0.5 flex flex-col gap-1.5">
              {items.length === 0 && say(COPY.noTray)}
              {items.map((i) => (
                <span key={i.id} className="flex flex-wrap items-center gap-2">
                  <span className="code font-semibold">{i.id}</span>
                  <span className="text-muted-foreground">
                    {dish(L.specs.get(i.spec_id)?.name, true)} · {i.galley}
                  </span>
                  <StatusChip size="sm" status={TRAY[i.status].status} label={say(TRAY[i.status].text)} />
                </span>
              ))}
            </dd>
          </div>
        </dl>
      )}
      {!late && (
        <Button size="lg" className="h-12 self-start text-base" onClick={onServe}>
          <ScanLine /> {say(COPY.serveSeat)}
        </Button>
      )}
    </section>
  )
}

function BoardingAlerts({ flightNo }: { flightNo: string }) {
  const notes = useQuery({
    queryKey: ["notifications", `crew:${flightNo}`],
    queryFn: () => api.get<Notification[]>(`/notifications?to=${encodeURIComponent(`crew:${flightNo}`)}`),
    refetchInterval: POLL_MS,
  })
  const list = notes.data ?? []
  return (
    <section className="rounded-xl border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <BellRing className="size-5 text-sky" aria-hidden="true" />
        <Bi text={COPY.inbox} size="md" inline />
      </header>
      {list.length === 0 ? (
        <Bi text={COPY.inboxEmpty} size="sm" />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.slice(0, 8).map((n) => (
            <li key={n.id} className="border-l-2 border-sky pl-3">
              <div className="font-medium">{n.title}</div>
              <div className="text-sm text-muted-foreground">{n.body}</div>
              <div className="text-xs text-muted-foreground tabular">{fmtTime(n.at, "IST")} · {fmtTime(n.at, "JST")}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function CrewSeats({ pkg, online, onSeat }: CrewSeatsProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const live = useQuery({
    queryKey: ["passengers", FLIGHT_ID, "with-promises"],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
    refetchInterval: POLL_MS,
    enabled: online,
  })
  const liveRows = useMemo(() => (online ? (live.data ?? []) : []), [online, live.data])
  const seats = useMemo(() => seatInfo(pkg, liveRows), [pkg, liveRows])
  return (
    <div className="flex flex-col gap-5">
      <SeatMap
        cabins={pkg.flight.cabins}
        seats={seats}
        highlight={selected ? [selected] : undefined}
        onSeatClick={setSelected}
        variant="plane"
      />
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-ice align-middle dark:bg-secondary" /><Bi text={COPY.legendSpecial} inline /></span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-warn-bg align-middle" /><Bi text={COPY.legendJudge} inline /></span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-safe-bg align-middle" /><Bi text={COPY.legendServed} inline /></span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-unsafe-bg align-middle" /><Bi text={COPY.legendMissing} inline /></span>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {selected ? (
          <SeatDetail pkg={pkg} seat={selected} live={liveRows} onServe={() => onSeat(selected)} />
        ) : (
          <section className="rounded-xl border border-dashed bg-card/60 p-5">
            <Bi text={COPY.seatPick} size="md" />
          </section>
        )}
        {online && <BoardingAlerts flightNo={pkg.flight.flight_no} />}
      </div>
    </div>
  )
}
