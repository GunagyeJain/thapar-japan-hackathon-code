// /insights: Act 6. One promise's C1 → C5 journey, the breakpoint, and how early it was caught.
import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "react-router"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import { fmtPaxName, fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { AlertAction, CheckpointEvent, Lang, MealPromise, Passenger, PassengerWithPromise } from "@/lib/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CHECKPOINT_LABELS,
  DataTable,
  EmptyState,
  KpiTile,
  LangSwitch,
  PageHeader,
  StatusChip,
  Timeline,
  type Column,
} from "@/ui"
import { copy, lesson, promiseStatus, sources } from "@/modules/m10-insights/i18n"

interface TimelineEvent extends CheckpointEvent {
  message: { id: string; kind: string; seq: number; received_at: string } | null
}

interface Breakpoint {
  checkpoint: CheckpointEvent["checkpoint"]
  at: string
  detail: string
  source: string
  alert_type: string | null
  deadline_at: string | null
  fixed_at: string | null
  fixed_detail: string | null
  fixed_by: string | null
  fix_action: string | null
}

interface PromiseTimeline {
  promise: MealPromise
  passenger: Passenger
  events: TimelineEvent[]
  actions: (AlertAction & { alert_id: string; alert_type: string })[]
  breakpoint: Breakpoint | null
}

const DEFAULT_SEAT = "23C" // Priya, the promise the story follows
/** Whole minutes between two sim times ("1 h 38 m", "7 min"): the sim clock stamps events a few ms past the minute. */
function minutesBetween(a: string, b: string): string {
  const total = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000)
  const h = Math.floor(total / 60)
  if (h >= 10) return `${h} h` // minutes add nothing at this scale, and the KPI tile stays one line
  return h > 0 ? `${h} h ${String(total % 60).padStart(2, "0")} m` : `${total} min`
}

/** "ADL 2 · 23:02 IST" for feed events, a readable name for the rest. */
function withSourceLabels(events: TimelineEvent[]): CheckpointEvent[] {
  return events.map((e) => ({
    ...e,
    source: e.message ? `${e.message.kind} ${e.message.seq} · ${fmtTime(e.message.received_at, "IST")}` : (sources[e.source] ?? e.source),
  }))
}

function BreakpointCallout({ bp, lang }: { bp: Breakpoint; lang: Lang }) {
  return (
    <Card className="border-unsafe/40">
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status="unsafe" label={t(copy.breakpoint, lang)} />
          <span className="font-medium">
            {bp.checkpoint} {t(CHECKPOINT_LABELS[bp.checkpoint], lang)}
          </span>
          <span className="tabular text-sm text-muted-foreground">{fmtTime(bp.at, "IST", { date: true })}</span>
        </div>
        <p className="text-sm">
          {bp.detail}
          {bp.alert_type && <span className="code ml-2 text-xs text-muted-foreground">{bp.alert_type}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {bp.fixed_at ? (
            <>
              <StatusChip status="safe" label={t(copy.fixed, lang)} />
              <span className="tabular text-sm">
                {fmtTime(bp.fixed_at, "IST")}
                {bp.fixed_by && ` · ${bp.fixed_by}`}
                {bp.fix_action === "request_again" && " (request again)"}
              </span>
            </>
          ) : (
            <StatusChip status="warn" label={t(copy.notFixed, lang)} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Journey({ promiseId, lang }: { promiseId: string; lang: Lang }) {
  const q = useQuery({
    queryKey: ["m10", "timeline", promiseId],
    queryFn: () => api.get<PromiseTimeline>(`/promises/${promiseId}/timeline`),
    refetchInterval: POLL_MS,
  })
  if (q.isError) {
    return (
      <EmptyState
        title={t(copy.loadError, lang)}
        body={q.error.message}
        action={
          <Button variant="outline" onClick={() => q.refetch()}>
            <RefreshCw /> {t(copy.retry, lang)}
          </Button>
        }
      />
    )
  }
  if (!q.data) return <div className="h-96 animate-pulse rounded-xl border bg-muted" aria-label="Loading" />

  const { passenger: p, promise, events, breakpoint: bp } = q.data
  const passed = Object.values(promise.checkpoints).filter((s) => s === "ok" || s === "fixed").length
  const caught = bp?.deadline_at ? minutesBetween(bp.at, bp.deadline_at) : null
  const fix = bp?.fixed_at ? minutesBetween(bp.at, bp.fixed_at) : null
  const status = promiseStatus[promise.status] ?? promiseStatus.ok

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
          <span className="font-display text-2xl font-bold tabular">{p.seat}</span>
          <span className="font-medium">{fmtPaxName(p)}</span>
          <span className="code text-sm text-muted-foreground">{p.pnr}</span>
          <Badge variant="secondary" className="code">
            {promise.code}
          </Badge>
          {promise.kitchen_note && <span className="code text-sm">{promise.kitchen_note}</span>}
          <StatusChip status={status.status} label={t(status.label, lang)} className="ml-auto" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label={t(copy.passed, lang)} value={`${passed}/5`} />
        {bp ? (
          <>
            <KpiTile label={t(copy.caught, lang)} value={<span className="whitespace-nowrap">{caught ?? "–"}</span>} />
            <KpiTile label={t(copy.fixTime, lang)} value={<span className="whitespace-nowrap">{fix ?? "–"}</span>} />
          </>
        ) : (
          <KpiTile label={t(copy.breakpoints, lang)} value="0" status={{ status: "safe", label: t(copy.fixed, lang) }} />
        )}
      </div>

      {bp && <BreakpointCallout bp={bp} lang={lang} />}

      <Card className="bg-ice">
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-navy">{t(copy.learns, lang)}</p>
          <p className="mt-1 text-[16px] leading-relaxed" lang={lang}>
            {bp
              ? t(lesson(`${bp.checkpoint} ${t(CHECKPOINT_LABELS[bp.checkpoint], lang)}`, fmtTime(bp.at, "IST"), caught, fix, bp.fixed_by), lang)
              : t(copy.held, lang)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(copy.journey, lang)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={withSourceLabels(events)} breakpoint={bp} lang={lang} />
        </CardContent>
      </Card>
    </div>
  )
}

export function InsightsPage() {
  const [lang, setLang] = useState<Lang>("en")
  const [params, setParams] = useSearchParams()
  const pax = useQuery({
    queryKey: ["m10", "passengers"],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
    refetchInterval: POLL_MS,
  })
  const rows = (pax.data ?? []).filter((p) => p.promise)
  const selected = rows.find((p) => p.seat === (params.get("seat") ?? DEFAULT_SEAT)) ?? rows[0]

  const columns: Column<PassengerWithPromise>[] = [
    { key: "seat", header: t(copy.seat, lang), cell: (p) => <span className="tabular font-medium">{p.seat}</span>, sortValue: (p) => p.seat },
    { key: "name", header: t(copy.passenger, lang), cell: (p) => fmtPaxName(p), sortValue: (p) => p.surname },
    { key: "code", header: t(copy.code, lang), cell: (p) => <span className="code">{p.promise?.code}</span> },
    {
      key: "status",
      header: t(copy.status, lang),
      cell: (p) => {
        const s = promiseStatus[p.promise?.status ?? "ok"] ?? promiseStatus.ok
        return <StatusChip status={s.status} label={t(s.label, lang)} size="sm" />
      },
    },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow={t(copy.eyebrow, lang)}
        title={t(copy.title, lang)}
        subtitle={t(copy.subtitle, lang)}
        actions={<LangSwitch value={lang} onChange={setLang} />}
      />
      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t(copy.promises, lang)}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(p) => p.id}
              selectedKey={selected?.id ?? null}
              onRowClick={(p) => setParams({ seat: p.seat })}
              isLoading={pax.isLoading}
              empty={<EmptyState title={t(copy.noPromises, lang)} body={t(copy.noPromisesBody, lang)} />}
            />
          </CardContent>
        </Card>
        {selected?.promise ? (
          <Journey promiseId={selected.promise.id} lang={lang} />
        ) : (
          !pax.isLoading && <EmptyState title={t(copy.noPromises, lang)} body={t(copy.noPromisesBody, lang)} />
        )}
      </div>
    </div>
  )
}
