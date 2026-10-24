// /ops/days: legs in the coming weeks where a passenger's fast day changes the meal, before each caterer list.
// Ops sees "fast day" and the food rules, never which fast it is.
import { useQuery } from "@tanstack/react-query"
import { CalendarDays } from "lucide-react"

import { api, POLL_MS } from "@/lib/api"
import { Badge, Button, DataTable, EmptyState, PageHeader, StatusChip, type Column } from "@/ui"

import { dayLabel } from "./format"
import type { AheadLeg, AheadOut } from "./types"

const DAYS = 30

const columns: Column<AheadLeg>[] = [
  {
    key: "date",
    header: "Date",
    cell: (l) => (
      <span className="tabular">
        {dayLabel(l.date, "en")} <span className="text-grey">· in {l.days_to_go} d</span>
      </span>
    ),
    sortValue: (l) => l.date,
  },
  {
    key: "flight",
    header: "Flight",
    cell: (l) => (
      <span className="tabular">
        {l.flight_no} <span className="text-grey">{l.from} → {l.to}</span>
      </span>
    ),
  },
  { key: "seat", header: "Seat", cell: (l) => <span className="tabular">{l.seat}</span>, sortValue: (l) => l.seat },
  { key: "name", header: "Passenger", cell: (l) => l.name, sortValue: (l) => l.name },
  {
    key: "usual",
    header: "Usual meal",
    cell: (l) =>
      l.usual ? (
        <span className="code text-grey">
          {l.usual.code}
          {l.usual.kitchen_note ? ` · ${l.usual.kitchen_note}` : ""}
        </span>
      ) : null,
  },
  {
    key: "day",
    header: "On the fast day",
    className: "w-[38%] whitespace-normal",
    cell: (l) => (
      <div className="flex max-w-md flex-col gap-1 py-1 whitespace-normal">
        <span className="flex items-center gap-2">
          <StatusChip status="info" size="sm" label="Fast day" />
          {l.code && <Badge variant="secondary" className="code">{l.code}</Badge>}
        </span>
        {l.kitchen_note && <span className="code text-navy">{l.kitchen_note}</span>}
        {l.catered_in === "NRT" && l.kitchen_note_ja && (
          <span lang="ja" className="text-grey">
            Tokyo kitchen: {l.kitchen_note_ja}
          </span>
        )}
      </div>
    ),
  },
]

export function OpsDaysPage() {
  const ahead = useQuery({
    queryKey: ["m16", "ahead", DAYS],
    queryFn: () => api.get<AheadOut>(`/days/ahead?days=${DAYS}`),
    refetchInterval: POLL_MS,
  })
  const legs = ahead.data?.legs ?? []
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow="DEL ↔ NRT · next 30 days"
        title="Fast days ahead"
        subtitle={
          ahead.data
            ? `${legs.length} fast-day ${legs.length === 1 ? "leg" : "legs"} · only dates sent`
            : undefined
        }
      />
      {ahead.isError ? (
        <EmptyState
          title="Couldn't load the fast-day list"
          body="Try again in a moment."
          action={<Button variant="outline" onClick={() => ahead.refetch()}>Retry</Button>}
        />
      ) : (
        <DataTable
          rows={legs}
          columns={columns}
          rowKey={(l) => `${l.passenger_id}-${l.flight_no}-${l.date}`}
          isLoading={ahead.isLoading}
          empty={
            <EmptyState
              icon={CalendarDays}
              title="No fast days in the next 30 days"
              body="Legs appear when a passenger saves a fast day."
            />
          }
        />
      )}
    </div>
  )
}
