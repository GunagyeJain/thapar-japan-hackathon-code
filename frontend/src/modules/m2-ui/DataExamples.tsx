// Gallery entries for the data components, filled from the live JL740 seed.
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { api, FLIGHT_ID } from "@/lib/api"
import { useFlight } from "@/lib/flight"
import { fmtPaxName } from "@/lib/format"
import type { Lang, PassengerWithPromise } from "@/lib/types"
import { DataTable, DiffView, KpiTile, RawMessage, SeatMap, StatusChip, Timeline, type Column, type SeatInfo } from "@/ui"
import { PRIYA_ADL, PRIYA_PNL, PRIYA_TIMELINE, PRIYA_TIMELINE_BREAK } from "@/modules/m2-ui/examples"
import { Specimen } from "@/modules/m2-ui/Specimen"

const PROMISE_CHIP = {
  ok: { status: "safe", label: "On track" },
  at_risk: { status: "warn", label: "At risk" },
  broken: { status: "unsafe", label: "Broken" },
  fixed: { status: "safe", label: "Fixed" },
} as const

const COLUMNS: Column<PassengerWithPromise>[] = [
  { key: "seat", header: "Seat", cell: (p) => <span className="font-medium tabular">{p.seat}</span>, sortValue: (p) => parseInt(p.seat) * 10 + p.seat.charCodeAt(p.seat.length - 1) / 100 },
  { key: "name", header: "Name", cell: (p) => fmtPaxName(p), sortValue: (p) => p.surname },
  { key: "pnr", header: "PNR", cell: (p) => <span className="code">{p.pnr}</span> },
  { key: "ssr", header: "Booked", cell: (p) => <span className="code">{p.ssr_meal}</span>, sortValue: (p) => p.ssr_meal ?? "" },
  { key: "note", header: "Note", cell: (p) => p.ssr_note ?? <span className="text-muted-foreground">–</span> },
  {
    key: "promise",
    header: "Promise",
    cell: (p) =>
      p.promise ? (
        <StatusChip size="sm" {...PROMISE_CHIP[p.promise.status]} />
      ) : (
        <StatusChip size="sm" status="neutral" label="No profile" />
      ),
  },
]

function seatInfo(passengers: PassengerWithPromise[]): Record<string, SeatInfo> {
  const seats: Record<string, SeatInfo> = {}
  for (const letter of "ACDGHK") seats[`5${letter}`] = { occupied: false, mark: "J", title: `5${letter} · held for a judge` }
  for (const p of passengers) {
    seats[p.seat] = {
      status: p.seat === "31K" ? "warn" : p.ssr_meal ? "info" : "neutral",
      mark: p.ssr_meal ? p.ssr_meal[0] : "",
      title: `${p.seat} · ${fmtPaxName(p)}${p.ssr_meal ? ` · ${p.ssr_meal}` : ""}`,
    }
  }
  return seats
}

export function DataExamples({ lang }: { lang: Lang }) {
  const flight = useFlight()
  const passengers = useQuery({
    queryKey: ["passengers", FLIGHT_ID, "with_promises"],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
  })
  const [selected, setSelected] = useState<string | null>(null)
  const pax = passengers.data ?? []
  const specials = pax.filter((p) => p.ssr_meal)

  return (
    <>
      <Specimen name="KpiTile" usage={'<KpiTile label="Special meals" value={24} status={{status: "safe", label: "All on the list"}} />'}>
        <KpiTile className="min-w-48" label="Passengers" value={flight.data?.counts.passengers ?? "–"} />
        <KpiTile
          className="min-w-48"
          label="Special meals"
          value={specials.length || "–"}
          delta={`${pax.filter((p) => p.promise).length} with a profile`}
          status={{ status: "safe", label: "All on the list" }}
        />
        <KpiTile className="min-w-48" label="Sealed backups" value={flight.data?.backup_count ?? "–"} status={{ status: "info", label: "2 held for the galley" }} />
      </Specimen>

      <Specimen name="DataTable" usage="<DataTable rows={…} columns={…} rowKey={(p) => p.id} onRowClick={…} />" dark={false}>
        <DataTable
          className="w-full"
          rows={specials}
          columns={COLUMNS}
          rowKey={(p) => p.id}
          isLoading={passengers.isLoading}
          selectedKey={selected}
          onRowClick={(p) => setSelected(p.id)}
          maxHeight={360}
        />
      </Specimen>

      <Specimen name="Timeline" usage="<Timeline events={events} breakpoint={breakpoint} lang={lang} />">
        <Timeline className="w-full" events={PRIYA_TIMELINE} breakpoint={PRIYA_TIMELINE_BREAK} lang={lang} />
      </Specimen>

      <Specimen name="RawMessage" usage="<RawMessage text={msg.text} title=… highlight={{ 4: 'remove', 6: 'add' }} />">
        <RawMessage className="w-full" title="ADL 2 · received 24 Oct 23:02 IST" text={PRIYA_ADL} highlight={{ 5: "remove", 7: "add", 9: "mark" }} />
      </Specimen>

      <Specimen name="DiffView" usage="<DiffView before={pnlLines} after={adlLines} beforeLabel=… afterLabel=… />">
        <DiffView
          className="w-full"
          before={PRIYA_PNL.split("\n")}
          after={PRIYA_PNL.replace(".L/6XK2QP", ".L/8MZ2TN").replace(".R/AVML HK1 NO ONION NO GARLIC\n", "").replace("6E5318", "6E5102").split("\n")}
          beforeLabel="PNL · 23C"
          afterLabel="after ADL 2"
        />
      </Specimen>

      <Specimen name="SeatMap" usage="<SeatMap cabins={flight.cabins} seats={…} highlight={['23C']} />" dark>
        {flight.data && pax.length > 0 ? (
          <SeatMap className="w-full" cabins={flight.data.cabins} seats={seatInfo(pax)} highlight={["23C", "31K"]} />
        ) : (
          <span className="text-muted-foreground">Loading seats…</span>
        )}
      </Specimen>
    </>
  )
}
