// Galley check: every expected special by galley; tap or scan to mark found; a missing tray gets a backup.
import { ArrowRightLeft, CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"

import type { CrewEvent, CrewPackage } from "@/lib/offline/types"
import { cn } from "@/lib/utils"
import { Button, Input, StatusChip } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { COPY } from "@/modules/m8-crew/i18n"
import { useCrewLang, useDish, useSay } from "@/modules/m8-crew/lang"
import { galleyRows, isDone, lookup, normaliseCode, pickBackup, type GalleyRow, type Lookup } from "@/modules/m8-crew/logic"

interface GalleyCheckProps {
  pkg: CrewPackage
  now: () => string
  record: (event: Omit<CrewEvent, "client_id">) => Promise<void>
}

function RowStatus({ row }: { row: GalleyRow }) {
  const say = useSay()
  if (row.replacement) return <StatusChip status="safe" size="sm" icon={ArrowRightLeft} label={`Backup ${row.replacement.id}`} />
  if (row.item.status === "loaded" || row.item.status === "served")
    return <StatusChip status="safe" size="sm" label={say(COPY.statusFound)} />
  if (row.item.status === "missing") return <StatusChip status="unsafe" size="sm" label={say(COPY.statusMissing)} />
  return <StatusChip status="neutral" size="sm" icon={CircleDashed} label={say(COPY.statusOpen)} />
}

function BackupSuggestion({ pkg, L, row, now, record }: { pkg: CrewPackage; L: Lookup; row: GalleyRow } & Omit<GalleyCheckProps, "pkg">) {
  const say = useSay()
  const dish = useDish()
  const pid = row.item.assigned_passenger_id
  if (!pid || row.replacement) return null
  const backup = pickBackup(pkg, L, pid, row.item.galley)
  const seat = row.passenger?.seat ?? "?"
  if (!backup) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-unsafe-bg p-3 text-unsafe">
        <XCircle className="size-5" aria-hidden="true" />
        <Bi text={COPY.noBackup} />
      </div>
    )
  }
  const what = backup.kind === "backup" ? COPY.backupVeg : COPY.spareMeal
  const spec = L.specs.get(backup.spec_id)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg border border-warn/40 bg-warn-bg p-3 animate-arrive">
      <div className="min-w-0 flex-1">
        <Bi text={COPY.suggest(seat, backup.galley, what)} size="lg" className="text-warn" />
        <p className="mt-1 text-sm text-muted-foreground">
          {dish(spec?.name)} · <span className="code">{backup.id}</span> · {backup.position}
        </p>
      </div>
      <Button
        size="lg"
        className="h-12 px-5"
        onClick={() => void record({ type: "swap_backup", item_id: backup.id, passenger_id: pid, at: now() })}
      >
        <ArrowRightLeft /> {say(COPY.useBackup)}
      </Button>
    </div>
  )
}

export function GalleyCheck({ pkg, now, record }: GalleyCheckProps) {
  const say = useSay()
  const dish = useDish()
  const mode = useCrewLang()
  const L = useMemo(() => lookup(pkg), [pkg])
  const galleys = useMemo(() => galleyRows(pkg, L), [pkg, L])
  const [code, setCode] = useState("")
  const [miss, setMiss] = useState<string | null>(null)
  const [galley, setGalley] = useState<string>(() => [...galleys.keys()][0] ?? "G1")

  const all = [...galleys.values()].flat()
  const shown = galleys.get(galley) ?? []
  const found = shown.filter(isDone).length

  const onScan = (e: FormEvent) => {
    e.preventDefault()
    const id = normaliseCode(code)
    const row = all.find((r) => r.item.id === id)
    if (!row) {
      setMiss(id)
      return
    }
    setMiss(null)
    setCode("")
    void record({ type: "galley_found", item_id: id, at: now() })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Galley" className="flex flex-col gap-2">
          {[...galleys.entries()].map(([g, rows]) => {
            const ok = rows.filter(isDone).length
            const on = g === galley
            return (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setGalley(g)}
                className={cn(
                  "flex min-h-16 flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-colors duration-150",
                  on ? "border-blue bg-secondary ring-1 ring-blue" : "border-border bg-card hover:border-sky",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <Bi text={COPY.galley(g)} size="sm" inline className="font-semibold" />
                  <span className="text-sm font-semibold tabular">
                    {ok}/{rows.length}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden="true">
                  <span className="block h-full rounded-full bg-safe transition-[width] duration-200" style={{ width: `${rows.length ? (ok / rows.length) * 100 : 0}%` }} />
                </span>
              </button>
            )
          })}
        </div>
        <form onSubmit={onScan} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <Bi text={COPY.scanLabel} size="sm" className="font-semibold" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={say(COPY.codePlaceholder)}
            className="code h-12 text-lg uppercase md:text-lg"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <Button type="submit" size="lg" className="h-12" disabled={!code.trim()}>
            <CheckCircle2 /> {say(COPY.markFound)}
          </Button>
          {miss && <StatusChip status="warn" className="h-auto py-1 whitespace-normal" label={`${miss}: ${say(COPY.unknownCode)}`} />}
        </form>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <Bi text={COPY.found(found, shown.length)} size="xl" className="tabular" />
      <section className="rounded-xl border bg-card">
            <ul>
              {shown.map((row) => (
                <li key={row.item.id} className={cn("border-b px-4 py-3 last:border-b-0", row.item.status === "missing" && !row.replacement && "bg-unsafe-bg/40")}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="w-14 font-display text-2xl font-bold tabular">{row.passenger?.seat}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="code rounded bg-muted px-1.5 py-0.5 text-sm font-semibold">{row.spec?.code ?? "—"}</span>
                        <span className="truncate">{dish(row.spec?.name, true)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {row.passenger && `${row.passenger.surname}/${row.passenger.given}`}{mode === "both" && ` · ${row.spec?.name.en ?? ""}`} · <span className="code">{row.item.id}</span> · {row.item.position}
                      </span>
                    </span>
                    {row.item.status !== "planned" && <RowStatus row={row} />}
                    {row.item.status === "planned" && (
                      <span className="flex gap-2">
                        <Button size="lg" className="h-12 min-w-24" onClick={() => void record({ type: "galley_found", item_id: row.item.id, at: now() })}>
                          <CheckCircle2 /> {say(COPY.markFound)}
                        </Button>
                        <Button size="lg" variant="outline" className="h-12 min-w-24" onClick={() => void record({ type: "galley_missing", item_id: row.item.id, at: now() })}>
                          <XCircle /> {say(COPY.markMissing)}
                        </Button>
                      </span>
                    )}
                  </div>
                  {row.item.status === "missing" && <BackupSuggestion pkg={pkg} L={L} row={row} now={now} record={record} />}
                </li>
              ))}
            </ul>
          </section>
        <AlsoOnBoard pkg={pkg} L={L} galley={galley} />
      </div>
    </div>
  )
}

/** Spares, backups and late-request meals in this galley: listed apart so the count above stays the expected list. */
function AlsoOnBoard({ pkg, L, galley }: { pkg: CrewPackage; L: Lookup; galley: string }) {
  const dish = useDish()
  const extra = pkg.items.filter((i) => i.galley === galley && (i.kind === "spare" || i.kind === "backup"))
  if (extra.length === 0) return null
  return (
    <section className="rounded-xl border bg-card px-4 py-3">
      <Bi text={COPY.alsoOnBoard} size="md" />
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {extra.map((i) => {
          const spec = L.specs.get(i.spec_id)
          const pax = i.assigned_passenger_id ? L.passengers.get(i.assigned_passenger_id) : undefined
          return (
            <li key={i.id} className="flex items-center gap-2 py-1">
              <span className="w-14 text-muted-foreground">{i.position}</span>
              <span className="min-w-0 flex-1 truncate">{dish(spec?.name)}</span>
              <span className="code text-xs text-muted-foreground">{i.id}</span>
              {pax ? <StatusChip size="sm" status="info" label={pax.seat} /> : <StatusChip size="sm" status="neutral" label={i.status === "missing" ? "missing" : "free"} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
