// One meal list: what changed since the last one, acknowledge, and every line grouped by code.
import { CheckCircle2, Printer } from "lucide-react"
import { Link } from "react-router"

import { fmtTime } from "@/lib/format"
import { Button, DataTable, DiffView, StatusChip, type Column } from "@/ui"
import { lineText, useAcknowledge } from "@/modules/m7-caterer/data"
import type { Line, MealListVersion } from "@/modules/m7-caterer/types"

const FIELD_NAME: Record<string, string> = { pnr: "booking ref", code: "meal code", note: "note", name: "name", item_id: "meal item" }

const COLUMNS: Column<Line>[] = [
  { key: "code", header: "Code", cell: (l) => <span className="code font-semibold">{l.code}</span>, sortValue: (l) => l.code, className: "w-20" },
  { key: "name", header: "Passenger", cell: (l) => l.name, sortValue: (l) => l.name },
  { key: "pnr", header: "Booking ref", cell: (l) => <span className="code">{l.pnr}</span>, className: "w-28" },
  { key: "note", header: "Kitchen note", cell: (l) => l.note ?? "—" },
  { key: "item", header: "Meal item", cell: (l) => <span className="code">{l.item_id ?? "—"}</span>, className: "w-32" },
]

function Changes({ version, previous }: { version: MealListVersion; previous: MealListVersion | undefined }) {
  const changed = version.diff.changed ?? []
  const sentences = [
    ...changed.map((c) => `${c.name}: ${c.fields.map((f) => `${FIELD_NAME[f.field] ?? f.field} ${f.before ?? "—"} → ${f.after ?? "—"}`).join(", ")}`),
    ...version.diff.added.map((l) => `${l.name}: added (${l.code}${l.note ? ` · ${l.note}` : ""})`),
    ...version.diff.removed.map((l) => `${l.name}: removed (${l.code})`),
  ]
  if (!previous) return <p className="text-sm text-muted-foreground">First list for this flight: {version.lines.length} special meals.</p>
  return (
    <div className="flex flex-col gap-3">
      {sentences.length === 0 && <p className="text-sm text-muted-foreground">No changes since v{previous.version}.</p>}
      <DiffView
        before={previous.lines.map(lineText)}
        after={version.lines.map(lineText)}
        beforeLabel={`v${previous.version}`}
        afterLabel={`v${version.version}`}
        changesOnly
      />
    </div>
  )
}

function CodeCounts({ lines }: { lines: Line[] }) {
  const counts = lines.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.code]: (acc[l.code] ?? 0) + 1 }), {})
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Meals per code">
      {Object.entries(counts).map(([code, n]) => (
        <li key={code} className="rounded-md border px-2.5 py-1 text-sm tabular">
          <span className="code font-semibold">{code}</span> <span className="text-muted-foreground">×</span> {n}
        </li>
      ))}
    </ul>
  )
}

export function VersionDetail({ version, previous }: { version: MealListVersion; previous: MealListVersion | undefined }) {
  const ack = useAcknowledge()
  const changedIds = new Set([...(version.diff.changed ?? []).map((c) => c.passenger_id), ...version.diff.added.map((l) => l.passenger_id)])
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Meal list v{version.version}</h2>
          <p className="text-sm text-muted-foreground tabular">
            Received {fmtTime(version.created_at, "IST", { date: true })} · {version.lines.length} special meals ·{" "}
            <span className="code" title={version.sha256}>
              sha256 {version.short_hash}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/caterer/labels?version=${version.version}`}>
              <Printer /> Labels
            </Link>
          </Button>
          {version.ack_at ? (
            <StatusChip status="safe" label={`Acknowledged ${fmtTime(version.ack_at, "IST")} · ${version.ack_by ?? ""}`} />
          ) : (
            <Button disabled={ack.isPending} onClick={() => ack.mutate(version.id)}>
              <CheckCircle2 /> Acknowledge
            </Button>
          )}
        </div>
      </div>
      <section aria-label="Changes" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Changes since v{previous?.version ?? "—"}</h3>
        <Changes version={version} previous={previous} />
      </section>
      <section aria-label="Meals" className="flex flex-col gap-3">
        <CodeCounts lines={version.lines} />
        <DataTable
          rows={version.lines}
          columns={COLUMNS}
          rowKey={(l) => l.passenger_id}
          rowClassName={(l) => (changedIds.has(l.passenger_id) ? "bg-ice/60" : undefined)}
          maxHeight={480}
        />
      </section>
    </div>
  )
}
