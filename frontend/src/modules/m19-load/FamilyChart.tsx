// Demand per diet family: told us (blue) inside the forecast (sky), the p90 tick, and what's on board for them (grey).
import { t } from "@/lib/i18n"
import { StatusChip } from "@/ui"

import { s } from "./i18n"
import { axisMax, barPct } from "./logic"
import type { Family } from "./types"

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-blue" /> {t(s.told)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-sky/50" /> {t(s.forecast)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-navy" /> p90 (plan for)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-grey/60" /> {t(s.onBoard)}
      </span>
    </div>
  )
}

function Row({ f, max }: { f: Family; max: number }) {
  const breakdown = `${f.loaded_from.special} special · ${f.loaded_from.main} main · ${f.loaded_from.spare} spare or pouch`
  return (
    <li className="grid grid-cols-[160px_1fr_150px_118px] items-center gap-4 py-2">
      <div className="min-w-0 truncate text-sm font-medium">{t(f.label)}</div>
      <div className="flex flex-col gap-1" aria-hidden="true">
        <div className="relative h-3 rounded-sm bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-sm bg-sky/50" style={{ width: `${barPct(f.forecast, max)}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-sm bg-blue" style={{ width: `${barPct(f.known, max)}%` }} />
          <div className="absolute -inset-y-1 w-0.5 bg-navy" style={{ left: `${barPct(f.p90, max)}%` }} />
        </div>
        <div className="relative h-2 rounded-sm bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-sm bg-grey/60" style={{ width: `${barPct(f.loaded, max)}%` }} />
        </div>
      </div>
      <div className="text-xs leading-5 tabular" title={`${f.known} told · ${f.forecast.toFixed(1)} forecast · ${breakdown}`}>
        <span className="font-semibold">p90 {f.p90}</span>
        <span className="text-muted-foreground"> · {f.loaded} on board</span>
      </div>
      <div className="justify-self-end">
        {f.risk ? (
          <StatusChip status="warn" size="sm" label={t(s.runOut)} />
        ) : (
          <StatusChip status="safe" size="sm" label={t(s.covered)} />
        )}
      </div>
    </li>
  )
}

export function FamilyChart({ families }: { families: Family[] }) {
  const max = axisMax(families)
  return (
    <div className="flex flex-col gap-3">
      <Legend />
      <ul className="divide-y" aria-label="Diet families: told us, forecast, p90 and meals on board">
        {families.map((f) => (
          <Row key={f.family} f={f} max={max} />
        ))}
      </ul>
    </div>
  )
}
