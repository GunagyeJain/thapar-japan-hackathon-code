// Seat map with diet badges (from the package), plus boarding alerts for the crew when online.
import { useQuery } from "@tanstack/react-query"
import { BellRing } from "lucide-react"
import { useMemo } from "react"

import { api, POLL_MS } from "@/lib/api"
import { fmtTime } from "@/lib/format"
import type { CrewPackage } from "@/lib/offline/types"
import type { Notification } from "@/lib/types"
import { SeatMap, type SeatInfo } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { COPY } from "@/modules/m8-crew/i18n"
import { lookup } from "@/modules/m8-crew/logic"

interface CrewSeatsProps {
  pkg: CrewPackage
  online: boolean
  onSeat: (seat: string) => void
}

function seatInfo(pkg: CrewPackage): Record<string, SeatInfo> {
  const L = lookup(pkg)
  const seats: Record<string, SeatInfo> = {}
  for (const p of pkg.passengers) {
    const items = pkg.items.filter((i) => i.assigned_passenger_id === p.id)
    const served = items.some((i) => i.status === "served")
    const missing = items.some((i) => i.kind === "special" && i.status === "missing") && !items.some((i) => i.kind !== "special" && i.status === "loaded")
    const code = items.map((i) => L.specs.get(i.spec_id)?.code).find(Boolean) ?? p.ssr_meal
    const diet = pkg.forbid[p.id]
    seats[p.seat] = {
      status: served ? "safe" : missing ? "unsafe" : p.is_judge ? "warn" : diet ? "info" : "neutral",
      mark: p.is_judge ? "J" : code ? code.slice(0, 2) : "",
      title: `${p.seat} · ${p.display_name ?? `${p.surname}/${p.given}`}${code ? ` · ${code}` : ""}${diet ? ` · ${diet.source}` : ""}`,
    }
  }
  return seats
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
  const seats = useMemo(() => seatInfo(pkg), [pkg])
  return (
    <div className="flex flex-col gap-5">
      <SeatMap cabins={pkg.flight.cabins} seats={seats} onSeatClick={onSeat} size="md" />
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-ice align-middle dark:bg-secondary" />特別食 Special meal</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-warn-bg align-middle" />審査員 Judge (J)</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-safe-bg align-middle" />提供済 Served</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-unsafe-bg align-middle" />不足 Missing</span>
      </div>
      {online && <BoardingAlerts flightNo={pkg.flight.flight_no} />}
    </div>
  )
}
