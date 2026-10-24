// Small pieces the ops pages share: severity/status chips, passenger lookup, the stand-in banner.
import { FlaskConical } from "lucide-react"

import type { Alert, PassengerWithPromise } from "@/lib/types"
import { StatusChip, type Status } from "@/ui"

const SEVERITY: Record<Alert["severity"], { status: Status; label: string }> = {
  critical: { status: "unsafe", label: "Critical" },
  warning: { status: "warn", label: "Warning" },
  info: { status: "info", label: "Info" },
}

const STATE: Record<Alert["status"], { status: Status; label: string }> = {
  open: { status: "warn", label: "Open" },
  acknowledged: { status: "info", label: "Acknowledged" },
  resolved: { status: "safe", label: "Resolved" },
}

export function SeverityChip({ severity }: { severity: Alert["severity"] }) {
  return <StatusChip size="sm" {...SEVERITY[severity]} />
}

export function StateChip({ state }: { state: Alert["status"] }) {
  return <StatusChip size="sm" {...STATE[state]} />
}

export function passengerOf(alert: Alert, passengers: PassengerWithPromise[] | undefined): PassengerWithPromise | undefined {
  return alert.passenger_id ? passengers?.find((p) => p.id === alert.passenger_id) : undefined
}

/** Open first, then by deadline (soonest first), then newest. */
export function byUrgency(a: Alert, b: Alert): number {
  const open = (x: Alert) => (x.status === "resolved" ? 1 : 0)
  const due = (x: Alert) => (x.deadline_at ? new Date(x.deadline_at).getTime() : Number.MAX_SAFE_INTEGER)
  return open(a) - open(b) || due(a) - due(b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export function StandInBanner({ live }: { live: boolean }) {
  if (live) return null
  return (
    <p className="flex items-center gap-2 rounded-lg bg-ice px-4 py-2 text-sm">
      <FlaskConical className="size-4 text-blue" aria-hidden="true" />
      Rehearsal data: the PNL/ADL watcher (m4) isn't connected yet, so these alerts are the stand-in set. They switch to live by
      themselves.
    </p>
  )
}
