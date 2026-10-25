// /ops/changes, Change control: every late diet change on JL740, on its rung of the cutoff ladder, with the
// passenger's answer, what today's process would have done, and the metrics. Run Chaos Mode fires the v2 script.
import { useQueryClient } from "@tanstack/react-query"
import { RefreshCw, RotateCcw, Zap } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button, DataTable, EmptyState, PageHeader, toast, type Column } from "@/ui"

import { CHANGES_KEY, useChangeMetrics, useChanges, useItemPlaces, useResetChaos, useRunChaos } from "./api"
import { CutoffLadder } from "./CutoffLadder"
import { DecisionCard } from "./DecisionCard"
import { WINDOWS } from "./labels"
import { MetricsStrip } from "./MetricsStrip"
import { ChannelLabel, OutcomeChip, RungBadge, SampleChip } from "./parts"
import type { ChangeEvent, ChangesResponse, Feed } from "./types"
import { numbered } from "./words"

/** During a Chaos Mode run the new events land one at a time, so the room can follow each onto its rung. */
const REVEAL_MS = 700

type Row = ChangeEvent & { n: number }

const cell = "px-2"
const COLUMNS: Column<Row>[] = [
  { key: "n", header: "#", cell: (e) => <span className="text-muted-foreground">{e.n}</span>, className: `${cell} w-7` },
  {
    key: "at",
    header: "Time IST",
    cell: (e) => (
      <span className="flex flex-col leading-tight tabular">
        <span className="font-semibold">{fmtTime(e.at, "IST", { zone: false })}</span>
        <span className="text-xs text-muted-foreground">{fmtTime(e.at, "IST", { date: true, zone: false }).split(",")[0]}</span>
      </span>
    ),
    className: cell,
    sortValue: (e) => e.at,
  },
  { key: "channel", header: "Channel", cell: (e) => <ChannelLabel channel={e.channel} short />, className: cell },
  {
    key: "who",
    header: "Seat · passenger",
    cell: (e) => (
      <span className="flex max-w-[130px] flex-col leading-tight" title={`${e.seat ?? ""} ${e.name ?? ""}`}>
        <span className="font-semibold tabular">{e.seat ?? "—"}</span>
        <span className="truncate text-xs text-muted-foreground">{e.name ?? ""}</span>
      </span>
    ),
    className: cell,
    sortValue: (e) => e.seat ?? "",
  },
  { key: "rung", header: "Rung", cell: (e) => <RungBadge rung={e.decision.rung} />, className: cell },
  { key: "result", header: "Result", cell: (e) => <OutcomeChip event={e} side="ours" />, className: cell },
  {
    key: "today",
    header: "Without ThaliBento",
    cell: (e) => (
      <span title={t(e.today.outcome, "en")}>
        <OutcomeChip event={e} side="today" />
      </span>
    ),
    className: cell,
  },
]

function mergeEvents(old: ChangeEvent[], fresh: ChangeEvent[]): ChangeEvent[] {
  return [...old, ...fresh.filter((f) => !old.some((o) => o.id === f.id))]
}

/** Which events to show: all of them, or during a reveal the earlier ones plus the first `shown` new ones. */
function useReveal(all: Row[]) {
  const [reveal, setReveal] = useState<{ base: string[]; shown: number } | null>(null)
  const fresh = reveal ? all.filter((e) => !reveal.base.includes(e.id)) : []
  useEffect(() => {
    if (!reveal) return
    if (reveal.shown >= fresh.length) {
      setReveal(null)
      return
    }
    const id = window.setTimeout(() => setReveal((r) => (r ? { ...r, shown: r.shown + 1 } : r)), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [reveal, fresh.length])
  const visible = reveal ? all.filter((e) => reveal.base.includes(e.id) || fresh.slice(0, reveal.shown).includes(e)) : all
  return { visible, revealing: reveal !== null, start: (base: string[]) => setReveal({ base, shown: 1 }) }
}

export function ChangeControlPage() {
  const queryClient = useQueryClient()
  const changes = useChanges()
  const metrics = useChangeMetrics()
  const places = useItemPlaces()
  const run = useRunChaos()
  const reset = useResetChaos()
  const [picked, setPicked] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const all = numbered(changes.data?.data.events ?? [])
  const { visible, revealing, start } = useReveal(all)
  const selected = visible.find((e) => e.id === picked) ?? visible[visible.length - 1] ?? null
  const live = changes.data?.live
  const nowWindow = changes.data?.data.window

  const choose = (id: string, scroll: boolean) => {
    setPicked(id)
    if (scroll) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  const runChaos = () => {
    const base = all.map((e) => e.id)
    run.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.setQueryData<Feed<ChangesResponse>>(CHANGES_KEY, (old) =>
          old ? { ...old, data: { ...old.data, events: mergeEvents(old.data.events, res.data.events) } } : old,
        )
        const fresh = res.data.events.filter((e) => !base.includes(e.id)).length
        if (fresh === 0) {
          toast.info("Chaos Mode already ran. Reset to run it again.")
          return
        }
        setPicked(null)
        start(base)
        toast.success(`Chaos Mode: ${fresh} changes fired through the router${res.live ? "" : " (sample data)"}`)
      },
      onError: (e) => toast.error(`Chaos Mode didn't run: ${e.message}`),
    })
  }

  const resetChaos = () =>
    reset.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData<Feed<ChangesResponse>>(CHANGES_KEY, (old) => (old ? { ...old, data: { ...old.data, events: [] } } : old))
        setPicked(null)
        toast.success("Change log cleared. Run Chaos Mode to fire the seven events again.")
      },
      onError: (e) => toast.error(`Couldn't reset: ${e.message}`),
    })

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        eyebrow="JL740 · DEL → NRT · 25 Oct"
        title="Change control"
        subtitle={nowWindow ? `Now: ${WINDOWS[nowWindow].name}` : "Every late change, on its rung"}
        actions={
          <>
            <SampleChip live={live} />
            <Button variant="outline" onClick={resetChaos} disabled={reset.isPending || run.isPending || revealing}>
              <RotateCcw /> Reset
            </Button>
            <Button size="lg" onClick={runChaos} disabled={run.isPending || reset.isPending || revealing}>
              <Zap /> {run.isPending || revealing ? "Chaos Mode running…" : "Run Chaos Mode"}
            </Button>
          </>
        }
      />

      <CutoffLadder events={visible} selectedId={selected?.id ?? null} onSelect={(id) => choose(id, true)} />

      <MetricsStrip metrics={metrics.data?.data} error={metrics.error} onRetry={() => metrics.refetch()} />

      <div className="grid gap-5 min-[1700px]:grid-cols-[minmax(0,1fr)_440px]">
        <section className="flex min-w-0 flex-col gap-2" aria-labelledby="m18-log-title">
          <h2 id="m18-log-title" className="text-base font-semibold">
            Change log
          </h2>
          {changes.isError ? (
            <EmptyState
              title="Couldn't load the change log"
              body={changes.error.message}
              action={
                <Button variant="outline" onClick={() => changes.refetch()}>
                  <RefreshCw /> Retry
                </Button>
              }
            />
          ) : (
            <DataTable
              rows={visible}
              columns={COLUMNS}
              rowKey={(e) => e.id}
              onRowClick={(e) => choose(e.id, true)}
              selectedKey={selected?.id ?? null}
              rowClassName={() => "animate-arrive"}
              isLoading={changes.isPending}
              empty={
                <EmptyState
                  icon={Zap}
                  title="No changes yet"
                  body="Run Chaos Mode, or log one at the Change desk."
                />
              }
            />
          )}
        </section>

        <div ref={detailRef} className={cn("scroll-mt-20 rounded-xl border bg-card p-4 md:p-5", !selected && "flex")}>
          {selected ? (
            <DecisionCard key={selected.id} event={selected} place={selected.decision.item_id ? places.data?.get(selected.decision.item_id) : null} className="animate-arrive" />
          ) : (
            <EmptyState
              className="flex-1"
              title="Pick a change"
              body="Click a dot or a row."
            />
          )}
        </div>
      </div>
    </div>
  )
}
