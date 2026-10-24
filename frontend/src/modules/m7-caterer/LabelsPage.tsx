// /caterer/labels: A4 sheets of 8 tray labels (2 × 4, 99 × 67 mm). Big diet mark, no seat (it changes after
// the truck leaves); the QR holds only the item id, which the crew tablet looks up live.
import { Printer, RefreshCw } from "lucide-react"
import { useSearchParams } from "react-router"
import { encode } from "uqr"

import { Button, EmptyState, PageHeader } from "@/ui"
import { useLabels } from "@/modules/m7-caterer/data"
import type { Label } from "@/modules/m7-caterer/types"

const PER_SHEET = 8

/** Big when it fits on one line, smaller for long marks, so the QR always has room. */
function markSize(mark: string): string {
  if (mark.length <= 18) return "text-[28pt]"
  if (mark.length <= 30) return "text-[20pt]"
  return "text-[15pt]"
}
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

// Print only the sheets, on bare A4.
const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  body * { visibility: hidden; }
  .label-sheets, .label-sheets * { visibility: visible; }
  .label-sheets { position: absolute; inset: 0; gap: 0; }
  .label-sheet { break-after: page; border: 0; box-shadow: none; }
}`

function Qr({ text }: { text: string }) {
  const { data, size } = encode(text, { border: 1 })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="size-[30mm] shrink-0" role="img" aria-label={`QR ${text}`}>
      {data.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="currentColor" /> : null)))}
    </svg>
  )
}

function TrayLabel({ label }: { label: Label }) {
  return (
    <article className="flex h-[67mm] w-[99mm] flex-col justify-between overflow-hidden border border-dashed border-line p-[5mm] text-navy">
      <div>
        <div className={`font-display leading-none font-bold tracking-tight ${markSize(label.mark.en)}`}>{label.mark.en}</div>
        {label.mark.ja && (
          <div lang="ja" className="mt-1 text-[11pt] font-medium">
            {label.mark.ja}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <dl className="min-w-0 text-[9pt] leading-snug">
          <dt className="sr-only">Passenger</dt>
          <dd className="truncate text-[11pt] font-semibold">{label.name}</dd>
          <dt className="sr-only">Booking</dt>
          <dd className="code">
            {label.pnr} · {label.flight_no} · {DATE.format(new Date(`${label.date}T00:00:00Z`))}
          </dd>
          <dt className="sr-only">Meal</dt>
          <dd>
            <span className="code font-semibold">{label.code}</span>
            {label.note && <span> · {label.note}</span>}
          </dd>
          <dt className="sr-only">Item</dt>
          <dd className="code mt-1 text-[12pt] font-semibold tracking-wider">{label.item_id}</dd>
        </dl>
        <Qr text={label.qr} />
      </div>
    </article>
  )
}

function sheetsOf(labels: Label[]): Label[][] {
  return Array.from({ length: Math.ceil(labels.length / PER_SHEET) }, (_, i) => labels.slice(i * PER_SHEET, (i + 1) * PER_SHEET))
}

export function LabelsPage() {
  const [params] = useSearchParams()
  const asked = Number(params.get("version"))
  const labels = useLabels(Number.isInteger(asked) && asked > 0 ? asked : null)
  const version = labels.data?.[0]?.version

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow="Skyline Flight Kitchens, Delhi · JL740"
        title={version ? `Tray labels · meal list v${version}` : "Tray labels"}
        subtitle="8 per A4 sheet. The QR holds only the meal item id; crew look up the seat on the tablet."
        actions={
          <Button disabled={!labels.data?.length} onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        }
      />
      {labels.isError ? (
        <EmptyState
          title="Couldn't load the labels"
          body={labels.error.message}
          action={
            <Button variant="outline" onClick={() => labels.refetch()}>
              <RefreshCw /> Retry
            </Button>
          }
        />
      ) : labels.isPending ? (
        <div className="h-[297mm] animate-pulse rounded-xl bg-ice" aria-busy="true" />
      ) : labels.data.length === 0 ? (
        <EmptyState title="No labels on this list" body="Labels appear for every special meal on the meal list." />
      ) : (
        <div className="label-sheets flex flex-col items-center gap-6">
          {sheetsOf(labels.data).map((sheet, i) => (
            <section
              key={sheet[0].item_id}
              aria-label={`Sheet ${i + 1}`}
              className="label-sheet grid h-[297mm] w-[210mm] shrink-0 grid-cols-[99mm_99mm] content-center justify-center border bg-white"
            >
              {sheet.map((label) => (
                <TrayLabel key={label.item_id} label={label} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
