// The serve list: who gets which tray, in service order, grouped by galley; a check once it's served or eaten.
import { CheckCircle2, Sunrise } from "lucide-react"
import { useMemo } from "react"

import { fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { StatusChip } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { serveRows, type CopilotPackage, type ServeRow } from "@/modules/m8-crew/copilot"
import { TAP_LOOK } from "@/modules/m8-crew/CopilotCard"
import { COPILOT, rungLabel } from "@/modules/m8-crew/i18n"
import { useDish, useSay } from "@/modules/m8-crew/lang"
import { TierChip } from "@/modules/m8-crew/tier"

interface ServeListProps {
  pkg: CopilotPackage
  selected: string | null
  onSeat: (seat: string) => void
}

export function ServeList({ pkg, selected, onSeat }: ServeListProps) {
  const groups = useMemo(() => serveRows(pkg), [pkg])
  if (groups.size === 0) {
    return (
      <section className="rounded-xl border border-dashed bg-card/60 p-5">
        <Bi text={COPILOT.emptyList} size="md" />
      </section>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([galley, rows]) => (
        <section key={galley} className="rounded-xl border bg-card" aria-label={`Galley ${galley.slice(1)}`}>
          <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <Bi text={COPILOT.galleyDone(galley, rows.filter((r) => r.done).length, rows.length)} size="sm" inline className="font-semibold tabular" />
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-background" aria-hidden="true">
              <span className="block h-full rounded-full bg-safe transition-[width] duration-200" style={{ width: `${(rows.filter((r) => r.done).length / rows.length) * 100}%` }} />
            </span>
          </header>
          <ul>
            {rows.map((row) => (
              <li key={row.seat.seat} className="border-b last:border-b-0">
                <Row row={row} on={row.seat.seat === selected} onSeat={onSeat} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Row({ row, on, onSeat }: { row: ServeRow; on: boolean; onSeat: (seat: string) => void }) {
  const say = useSay()
  const dish = useDish()
  const { seat, item, tap, tray } = row
  return (
    <button
      type="button"
      onClick={() => onSeat(seat.seat)}
      aria-current={on || undefined}
      className={cn(
        "flex min-h-16 w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left transition-colors duration-150",
        on ? "bg-secondary" : "hover:bg-secondary/50",
        row.done && "opacity-75",
      )}
    >
      <span className="flex w-20 items-center gap-1.5 font-display text-2xl font-bold tabular">
        {seat.seat}
        {row.done && <CheckCircle2 className="size-5 shrink-0 text-safe" aria-label={say(COPILOT.served)} />}
      </span>
      <TierChip tier={seat.tier} size="sm" />
      <span className="min-w-0 flex-1">
        {tray ? (
          <>
            <span className="block truncate font-medium">{dish({ en: tray.spec_name.en, ja: tray.spec_name.ja }, true)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {tray.item_id && <span className="code">{tray.item_id}</span>}
              {item && ` · ${item.position}`} · {say(rungLabel(tray.rung))}
            </span>
          </>
        ) : seat.needs_tray ? (
          <StatusChip size="sm" status="warn" label={say(COPILOT.noTray)} className="h-auto min-h-6 shrink py-0.5 whitespace-normal" />
        ) : (
          <span className="text-sm text-muted-foreground">{say(COPILOT.anyMain)}</span>
        )}
      </span>
      {seat.may_eat_from && (
        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-sky tabular">
          <Sunrise className="size-3.5" aria-hidden="true" />
          {fmtTime(seat.may_eat_from, "IST")}
        </span>
      )}
      {seat.sunrise_box && <StatusChip size="sm" status="info" icon={Sunrise} label={say(COPILOT.sunriseBox)} />}
      <RowStatus row={row} />
      {tap && tap.type !== "eaten" && (
        <StatusChip size="sm" status={TAP_LOOK[tap.type].status} icon={TAP_LOOK[tap.type].icon} label={say(TAP_LOOK[tap.type].word)} />
      )}
    </button>
  )
}

function RowStatus({ row }: { row: ServeRow }) {
  const say = useSay()
  if (row.tap?.type === "eaten") return <StatusChip size="sm" status="safe" label={say(COPILOT.eaten)} />
  if (row.item?.status === "served") return <StatusChip size="sm" status="safe" label={say(COPILOT.served)} />
  if (row.item?.status === "missing") return <StatusChip size="sm" status="unsafe" label={say(COPILOT.missing)} />
  return null
}
