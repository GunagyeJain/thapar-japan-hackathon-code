// /ops: the flight board ground staff watch overnight. How it works, KPIs, the alert queue (live),
// every meal promise across its five hand-offs, and the latest feed messages.
import { ChevronRight, FileText, RefreshCw, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react"
import { useNavigate } from "react-router"

import { fmtTime } from "@/lib/format"
import { useFlight } from "@/lib/flight"
import type { Alert, MealPromise, PassengerWithPromise } from "@/lib/types"
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
  PromiseSteps,
  RawMessage,
  StatusChip,
  type Column,
  type Status,
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

const HOW: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileText, title: "1 · Reads every passenger list", body: "Copies of the PNL and ADL the booking system already sends to the airport, as they arrive." },
  { icon: ShieldCheck, title: "2 · Checks every special meal", body: "Against the passenger's own food rules: is the meal still booked, and is it the right one?" },
  { icon: UserCheck, title: "3 · Raises an alert, a person fixes it", body: "With the exact booking lines and the deadline. Nothing in the booking changes on its own." },
]

function HowItWorks() {
  return (
    <ol className="grid gap-3 md:grid-cols-3" aria-label="How the ops console works">
      {HOW.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3 rounded-xl border bg-card px-4 py-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-sm text-muted-foreground">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Feed() {
  const messages = useMessages()
  const rows = [...(messages.data?.rows ?? [])].sort((a, b) => b.seq - a.seq).slice(0, 8)
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="feed-title">
      <h2 id="feed-title" className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="size-4 text-muted-foreground" aria-hidden="true" /> PNL / ADL feed
      </h2>
      <p className="text-xs text-muted-foreground">The passenger lists the watcher has read, newest first. Click one to see it raw.</p>
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

const PROMISE: Record<MealPromise["status"], { status: Status; label: string; rank: number }> = {
  broken: { status: "unsafe", label: "Broken", rank: 0 },
  at_risk: { status: "warn", label: "At risk", rank: 1 },
  fixed: { status: "safe", label: "Fixed", rank: 2 },
  ok: { status: "safe", label: "On track", rank: 3 },
}

type WithPromise = PassengerWithPromise & { promise: MealPromise }

function paxName(p: PassengerWithPromise): string {
  return p.display_name ?? `${p.surname}/${p.given} ${p.title}`
}

function PromiseBoard({ passengers, alerts, isLoading }: { passengers: PassengerWithPromise[]; alerts: Alert[]; isLoading: boolean }) {
  const navigate = useNavigate()
  const rows = passengers
    .filter((p): p is WithPromise => Boolean(p.promise))
    .sort((a, b) => PROMISE[a.promise.status].rank - PROMISE[b.promise.status].rank || a.seat.localeCompare(b.seat, "en", { numeric: true }))
  const openAlert = (p: WithPromise) => alerts.find((a) => a.passenger_id === p.id && a.status !== "resolved")
  const columns: Column<WithPromise>[] = [
    { key: "seat", header: "Seat", cell: (p) => <span className="font-semibold tabular">{p.seat}</span>, className: "w-14" },
    { key: "pax", header: "Passenger", cell: paxName, className: "w-44" },
    {
      key: "meal",
      header: "Meal",
      cell: (p) => (
        <span className="flex flex-col">
          <span className="code font-semibold">{p.promise.code}</span>
          {p.promise.kitchen_note && <span className="code text-[11px] text-muted-foreground">{p.promise.kitchen_note}</span>}
        </span>
      ),
      className: "w-40",
    },
    { key: "steps", header: "Diet → Booking → Caterer → Galley → Seat", cell: (p) => <PromiseSteps checkpoints={p.promise.checkpoints} compact className="min-w-[19rem]" /> },
    { key: "state", header: "Promise", cell: (p) => <StatusChip size="sm" {...PROMISE[p.promise.status]} />, className: "w-28" },
  ]
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4" aria-labelledby="promises-title">
      <h2 id="promises-title" className="text-base font-semibold">
        Meal promises · where every meal stands
      </h2>
      <p className="pb-3 text-sm text-muted-foreground">Everyone who told us what they can't eat, judges included, across the five hand-offs of their meal.</p>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => {
          const a = openAlert(p)
          if (a) navigate(`/ops/alerts/${a.id}`)
        }}
        isLoading={isLoading}
        empty={<EmptyState title="No meal promises yet" body="A promise starts when a passenger tells us their food rules on /p or a judge joins on /j." />}
      />
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
  // Info alerts (a judge's reserved meal, say) are notes, not problems waiting for a person.
  const open = rows.filter((a) => a.status !== "resolved" && a.severity !== "info").length

  const columns: Column<Alert>[] = [
    { key: "sev", header: "Severity", cell: (a) => <SeverityChip severity={a.severity} />, className: "w-28" },
    { key: "seat", header: "Seat", cell: (a) => <span className="font-semibold tabular">{passengerOf(a, passengers.data)?.seat ?? "—"}</span>, className: "w-16" },
    {
      key: "pax",
      header: "Passenger",
      cell: (a) => {
        const p = passengerOf(a, passengers.data)
        return p ? paxName(p) : "—"
      },
      className: "w-48",
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
    { key: "due", header: "Fix before", cell: (a) => (a.deadline_at && a.status !== "resolved" ? <Countdown until={a.deadline_at} /> : "—"), className: "w-36" },
    { key: "state", header: "Status", cell: (a) => <StateChip state={a.status} />, className: "w-32" },
    { key: "open", header: "", cell: () => <ChevronRight className="size-4 text-muted-foreground" aria-label="Open" />, className: "w-8" },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
      <PageHeader eyebrow="Delhi ground ops · overnight watch" title="Ops console" subtitle="Every special meal on JL740, watched across every hand-off. A person approves every fix." />
      <StandInBanner live={alerts.data?.live ?? true} />
      <HowItWorks />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label="Passengers" value={flight.data?.counts.passengers ?? "—"} hint="on JL740 tonight" />
        <KpiTile label="Special meals" value={flight.data?.counts.special_meals ?? "—"} hint="booked meal codes in the passenger list" />
        <KpiTile label="Meal promises" value={passengers.data ? promises : "—"} hint="passengers who told us what they can't eat" />
        <KpiTile
          label="Open alerts"
          value={alerts.data ? open : "—"}
          hint="problems waiting for a person"
          status={open > 0 ? { status: "warn", label: "Needs a person" } : undefined}
        />
        <KpiTile label="Lost meals caught in time" value={alerts.data ? caughtInTime(rows) : "—"} hint="fixed before the caterer's final list" />
      </div>
      <section className="min-w-0 rounded-xl border bg-card p-4" aria-labelledby="queue-title">
        <h2 id="queue-title" className="text-base font-semibold">
          Alerts · what needs a person
        </h2>
        <p className="pb-3 text-sm text-muted-foreground">Most urgent first. Click a row to see the evidence and fix it.</p>
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <PromiseBoard passengers={passengers.data ?? []} alerts={rows} isLoading={passengers.isPending} />
        <Feed />
      </div>
    </div>
  )
}
