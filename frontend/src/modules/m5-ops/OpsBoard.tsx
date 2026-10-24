// /ops: the flight board ground staff watch overnight. KPIs, the alert queue (live), the latest feed messages.
import { FileText, RefreshCw } from "lucide-react"
import { useNavigate } from "react-router"

import { fmtTime } from "@/lib/format"
import { useFlight } from "@/lib/flight"
import type { Alert } from "@/lib/types"
import {
  Button,
  Countdown,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  KpiTile,
  PageHeader,
  RawMessage,
  type Column,
} from "@/ui"
import { useAlerts, useMessages, usePassengers } from "@/modules/m5-ops/data"
import { byUrgency, passengerOf, SeverityChip, StandInBanner, StateChip } from "@/modules/m5-ops/parts"

function caughtInTime(alerts: Alert[]): number {
  return alerts.filter((a) => {
    if (a.type !== "LOST_MEAL" || a.status !== "resolved" || !a.deadline_at) return false
    const fixed = a.actions.find((x) => x.action === "resolve" || x.action === "request_again")
    return fixed ? new Date(fixed.at) <= new Date(a.deadline_at) : false
  }).length
}

function Feed() {
  const messages = useMessages()
  const rows = [...(messages.data?.rows ?? [])].sort((a, b) => b.seq - a.seq).slice(0, 8)
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="feed-title">
      <h2 id="feed-title" className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="size-4 text-muted-foreground" aria-hidden="true" /> PNL / ADL feed
      </h2>
      {messages.isError ? (
        <p className="text-sm text-unsafe">Couldn't load the feed: {messages.error.message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Passenger name lists from the reservation system appear here as they arrive.</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">
          {rows.map((m) => (
            <li key={m.id}>
              <Dialog>
                <DialogTrigger className="flex w-full items-baseline justify-between gap-2 rounded-md py-2 text-left hover:bg-ice/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                  <span>
                    <span className="code font-semibold">{m.kind}</span> <span className="text-muted-foreground">#{m.seq}</span>
                  </span>
                  <span className="text-muted-foreground tabular">
                    {fmtTime(m.received_at, "IST")} · {m.text.trim().split("\n").length} lines
                  </span>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {m.kind} #{m.seq} · received {fmtTime(m.received_at, "IST", { date: true })}
                    </DialogTitle>
                  </DialogHeader>
                  <RawMessage text={m.text} className="max-h-[60vh] overflow-y-auto" />
                </DialogContent>
              </Dialog>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function OpsBoard() {
  const navigate = useNavigate()
  const flight = useFlight()
  const alerts = useAlerts()
  const passengers = usePassengers()
  const rows = [...(alerts.data?.rows ?? [])].sort(byUrgency)
  const promises = (passengers.data ?? []).filter((p) => p.promise).length
  const open = rows.filter((a) => a.status !== "resolved").length

  const columns: Column<Alert>[] = [
    { key: "sev", header: "Severity", cell: (a) => <SeverityChip severity={a.severity} />, className: "w-28" },
    { key: "seat", header: "Seat", cell: (a) => <span className="font-semibold tabular">{passengerOf(a, passengers.data)?.seat ?? "—"}</span>, className: "w-16" },
    {
      key: "pax",
      header: "Passenger",
      cell: (a) => {
        const p = passengerOf(a, passengers.data)
        return p ? `${p.surname}/${p.given} ${p.title}` : "—"
      },
    },
    {
      key: "title",
      header: "What happened",
      cell: (a) => (
        <span className="flex flex-col">
          <span>{a.title}</span>
          <span className="code text-xs text-muted-foreground">{a.type}</span>
        </span>
      ),
    },
    { key: "due", header: "Deadline", cell: (a) => (a.deadline_at && a.status !== "resolved" ? <Countdown until={a.deadline_at} /> : "—"), className: "w-36" },
    { key: "state", header: "Status", cell: (a) => <StateChip state={a.status} />, className: "w-32" },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader eyebrow="Delhi ground ops · overnight watch" title="Ops console" subtitle="Every special meal on JL740, watched across every hand-off. A person approves every fix." />
      <StandInBanner live={alerts.data?.live ?? true} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label="Passengers" value={flight.data?.counts.passengers ?? "—"} />
        <KpiTile label="Special meals" value={flight.data?.counts.special_meals ?? "—"} />
        <KpiTile label="Meal promises" value={passengers.data ? promises : "—"} />
        <KpiTile label="Open alerts" value={alerts.data ? open : "—"} status={open > 0 ? { status: "warn", label: "Needs a person" } : undefined} />
        <KpiTile label="Lost meals caught before the deadline" value={alerts.data ? caughtInTime(rows) : "—"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-xl border bg-card p-4" aria-labelledby="queue-title">
          <h2 id="queue-title" className="pb-3 text-base font-semibold">
            Alerts
          </h2>
          {alerts.isError ? (
            <EmptyState
              title="Couldn't load alerts"
              body={alerts.error.message}
              action={
                <Button variant="outline" onClick={() => alerts.refetch()}>
                  <RefreshCw /> Retry
                </Button>
              }
            />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(a) => a.id}
              onRowClick={(a) => navigate(`/ops/alerts/${a.id}`)}
              isLoading={alerts.isPending}
              empty={<EmptyState title="No alerts" body="When a booking change drops or breaks a meal promise, it shows up here within 2 seconds." />}
            />
          )}
        </section>
        <Feed />
      </div>
    </div>
  )
}
