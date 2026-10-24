// /ops/alerts/:id: what happened, the PNL/ADL evidence, the human steps, and the audit trail.
import { ArrowLeft, History } from "lucide-react"
import { Link, useParams } from "react-router"

import { fmtTime } from "@/lib/format"
import type { Alert, PassengerWithPromise } from "@/lib/types"
import { Button, Countdown, DiffView, EmptyState, PageHeader, RawMessage, StatusChip } from "@/ui"
import { ActionBar } from "@/modules/m5-ops/ActionBar"
import { useAlerts, useMessages, usePassengers } from "@/modules/m5-ops/data"
import { beforeAfter, highlightFor, messageIds, nameKey, text } from "@/modules/m5-ops/evidence"
import { passengerOf, SeverityChip, StandInBanner, StateChip } from "@/modules/m5-ops/parts"

const ACTION_TEXT: Record<string, string> = {
  acknowledge: "Acknowledged",
  request_again: "Meal requested again",
  notify_passenger: "Passenger notified",
  notify_kitchen: "Kitchen notified",
  resolve: "Resolved",
}

function Evidence({ alert, passenger }: { alert: Alert; passenger: PassengerWithPromise | undefined }) {
  const messages = useMessages()
  const ids = messageIds(alert)
  const all = messages.data?.rows ?? []
  const key = passenger ? nameKey(passenger) : null
  const shown = all.filter((m) => ids.includes(m.id) || (key && m.kind === "ADL" && m.seq > Math.max(0, ...all.filter((x) => ids.includes(x.id)).map((x) => x.seq)) && m.text.toUpperCase().includes(key)))
  const diff = key ? beforeAfter(shown, key) : null
  const lineBefore = text(alert.evidence.line_before)

  if (alert.type === "WRONG_CODE") {
    const contains = Array.isArray(alert.evidence.contains) ? alert.evidence.contains.join(", ") : null
    return (
      <p className="rounded-lg border bg-mist p-4 text-base">
        Booked <span className="code font-semibold">{String(alert.evidence.booked_code ?? "—")}</span>
        {contains && <> contains {contains}</>}, which this passenger's food rules exclude. Suggested:{" "}
        <span className="code font-semibold">{String(alert.evidence.suggested_code ?? "—")}</span>.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {diff ? (
        <DiffView before={diff.before} after={diff.after} beforeLabel="Booking in the PNL" afterLabel="Booking after the ADL" />
      ) : (
        lineBefore && <DiffView before={[lineBefore]} after={text(alert.evidence.line_after) ? [String(alert.evidence.line_after)] : []} beforeLabel="Before" afterLabel="After" />
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {shown.map((m) => (
          <RawMessage
            key={m.id}
            title={`${m.kind} #${m.seq} · received ${fmtTime(m.received_at, "IST", { date: true })}`}
            text={m.text}
            highlight={key ? highlightFor(m, key) : {}}
            className="text-base"
          />
        ))}
      </div>
    </div>
  )
}

function AuditTrail({ alert, passenger }: { alert: Alert; passenger: PassengerWithPromise | undefined }) {
  const c2 = passenger?.promise?.checkpoints.C2
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="audit-title">
      <h2 id="audit-title" className="flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" aria-hidden="true" /> Audit trail
      </h2>
      <ol className="flex flex-col gap-2 text-sm">
        <li>
          <span className="tabular text-muted-foreground">{fmtTime(alert.created_at, "IST", { date: true })}</span> · Alert raised by the watcher
        </li>
        {alert.actions.map((a, i) => (
          <li key={`${a.at}-${i}`}>
            <span className="tabular text-muted-foreground">{fmtTime(a.at, "IST", { date: true })}</span> · {ACTION_TEXT[a.action] ?? a.action} · {a.actor}
            {a.note && <span className="text-muted-foreground"> · {a.note}</span>}
          </li>
        ))}
      </ol>
      {c2 && (
        <div className="flex items-center gap-2 text-sm">
          <span>C2 booking check</span>
          <StatusChip
            size="sm"
            status={c2 === "fail" ? "unsafe" : c2 === "pending" ? "neutral" : "safe"}
            label={c2 === "fail" ? "Failed" : c2 === "fixed" ? "Fixed" : c2 === "ok" ? "OK" : "Pending"}
          />
        </div>
      )}
    </section>
  )
}

export function AlertDetail() {
  const { id } = useParams()
  const alerts = useAlerts()
  const passengers = usePassengers()
  const alert = alerts.data?.rows.find((a) => a.id === id)
  const passenger = alert ? passengerOf(alert, passengers.data) : undefined
  const back = (
    <Button variant="ghost" className="self-start" asChild>
      <Link to="/ops">
        <ArrowLeft /> All alerts
      </Link>
    </Button>
  )

  if (alerts.isPending) return <div className="mx-auto mt-8 h-96 max-w-6xl animate-pulse rounded-xl bg-ice" aria-busy="true" />
  if (!alert) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState title="This alert isn't on the board" body={alerts.isError ? alerts.error.message : "It may be from before the last demo reset."} action={back} />
      </div>
    )
  }
  const oldPnr = text(alert.evidence.old_pnr)
  const newPnr = text(alert.evidence.new_pnr)
  const who = passenger ? `${passenger.seat} · ${passenger.surname}/${passenger.given} ${passenger.title}` : "—"

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      {back}
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <SeverityChip severity={alert.severity} /> <span className="code">{alert.type}</span> <StateChip state={alert.status} />
          </span>
        }
        title={alert.title}
        subtitle={
          <span className="tabular">
            {who}
            {oldPnr && newPnr && (
              <>
                {" "}· booking <span className="code">{oldPnr}</span> → <span className="code">{newPnr}</span>
              </>
            )}
          </span>
        }
        actions={alert.deadline_at && alert.status !== "resolved" ? <Countdown until={alert.deadline_at} label="Caterer's final list in" size="lg" /> : undefined}
      />
      <StandInBanner live={alerts.data?.live ?? true} />
      <p className="text-lg">{alert.body}</p>
      <ActionBar alert={alert} passenger={passenger} live={alerts.data?.live ?? true} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-xl border bg-card p-4" aria-labelledby="evidence-title">
          <h2 id="evidence-title" className="pb-3 text-base font-semibold">
            Evidence
          </h2>
          <Evidence alert={alert} passenger={passenger} />
        </section>
        <AuditTrail alert={alert} passenger={passenger} />
      </div>
    </div>
  )
}
