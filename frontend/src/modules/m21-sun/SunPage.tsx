// /ops/sun: when passengers who eat by the sun may eat on JL740, worked out at the aircraft's position and
// altitude rather than on the Delhi clock; the published India → Japan departures; the seats with such a rule.
import { Package, RefreshCw, Sunrise } from "lucide-react"
import { useState } from "react"

import { FLIGHT_ID } from "@/lib/api"
import { useSimClock } from "@/lib/clock"
import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  KpiTile,
  LangSwitch,
  PageHeader,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui"

import { useSunFlight, useSunPresets, useSunSeats } from "./api"
import { city, fmtDeg, fmtLeft, ruleLabel } from "./format"
import { fill, s } from "./i18n"
import { SunChart } from "./SunChart"
import { SunTimer } from "./SunTimer"
import type { SunFlight, SunSummary } from "./types"

const DAY_MS = 86_400_000
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })

/** "05:42", in IST. */
function hm(iso: string): string {
  return fmtTime(iso, "IST", { zone: false })
}

/** Each ISO string carries its own airport's local date, so this is the "+1" on an overnight arrival. */
function daysLater(dep: string, arr: string): number {
  return Math.round((Date.parse(arr.slice(0, 10)) - Date.parse(dep.slice(0, 10))) / DAY_MS)
}

function Retry({ title, onRetry, lang }: { title: string; onRetry: () => void; lang: Lang }) {
  return (
    <EmptyState
      title={title}
      body={t(s.loadErrorBody, lang)}
      action={
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> {t(s.retry, lang)}
        </Button>
      }
    />
  )
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-ice ${className}`} aria-busy="true" />
}

function Kpis({ flight, lang }: { flight: SunFlight; lang: Lang }) {
  const rise = flight.sunrise
  const eat = flight.chauvihar
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t(s.kpiAircraft, lang)}
        value={rise ? hm(rise.at_aircraft) : "–"}
        delta={rise ? "IST" : undefined}
        hint={rise ? undefined : t(s.noSunrise, lang)}
      />
      <KpiTile
        label={fill(t(s.kpiOrigin, lang), { city: city(flight.origin, lang) })}
        value={rise?.at_origin ? hm(rise.at_origin) : "–"}
        delta="IST"
      />
      <KpiTile
        label={t(s.kpiEarlier, lang)}
        value={rise?.minutes_earlier ?? "–"}
        delta={rise?.minutes_earlier != null ? t(s.minUnit, lang) : undefined}
      />
      <KpiTile
        label={t(s.kpiRule, lang)}
        value={!eat.sunrise_box && eat.may_eat_from ? hm(eat.may_eat_from) : "–"}
        delta={!eat.sunrise_box && eat.may_eat_from ? "IST" : undefined}
        status={eat.sunrise_box ? { status: "info", label: t(s.sunriseBox, lang) } : undefined}
      />
    </div>
  )
}

function Swatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="28" height="10" aria-hidden="true" className="shrink-0">
      <line x1="0" x2="28" y1="5" y2="5" stroke={color} strokeWidth={2.5} strokeDasharray={dash} />
    </svg>
  )
}

function ChartCard({ flight, lang }: { flight: SunFlight; lang: Lang }) {
  const { now } = useSimClock()
  const origin = city(flight.origin, lang)
  const earlier = flight.sunrise?.minutes_earlier
  const delay = flight.delay_min ?? 0
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{fill(t(s.chartTitle, lang), { flight: flight.flight_no ?? flight.origin })}</CardTitle>
        {delay > 0 && <StatusChip status="warn" size="sm" label={fill(t(s.delayed, lang), { n: delay })} />}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {earlier != null && (
          <p className="font-display text-xl leading-snug font-semibold" lang={lang}>
            {fill(t(s.explain, lang), { n: earlier, city: origin })}
          </p>
        )}
        <SunChart flight={flight} lang={lang} now={now} />
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Swatch color="var(--blue)" />
            {t(s.legendAircraft, lang)}
          </span>
          <span className="flex items-center gap-2">
            <Swatch color="var(--sky)" dash="7 5" />
            {fill(t(s.legendOrigin, lang), { city: origin })}
          </span>
          <span className="flex items-center gap-2">
            <Swatch color="var(--grey)" dash="6 4" />
            {fill(t(s.legendLine, lang), { deg: fmtDeg(flight.threshold_cruise) })}
          </span>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">{t(s.methodTitle, lang)}</summary>
          <p className="mt-1">{t(s.method, lang)}</p>
        </details>
      </CardContent>
    </Card>
  )
}

function TwoZones({ iso }: { iso: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span>{fmtTime(iso, "IST")}</span>
      <span className="text-xs text-muted-foreground">{fmtTime(iso, "JST")}</span>
    </span>
  )
}

function PresetRow({ f, current, lang }: { f: SunSummary; current: boolean; lang: Lang }) {
  const rise = f.sunrise
  const eat = f.chauvihar
  const plus = daysLater(f.dep, f.arr)
  return (
    <TableRow className="h-14" data-state={current ? "selected" : undefined}>
      <TableCell>
        <span className="font-semibold">{f.flight_no}</span> <span className="text-muted-foreground">{f.origin} → {f.dest}</span>
      </TableCell>
      <TableCell>
        {fmtTime(f.dep, "IST")}{" "}
        <span className="text-muted-foreground">
          → {fmtTime(f.arr, "JST")}
          {plus > 0 && <sup className="ml-0.5">+{plus}</sup>}
        </span>
      </TableCell>
      <TableCell>{rise ? <TwoZones iso={rise.at_aircraft} /> : <span className="text-muted-foreground">{t(s.noSunrise, lang)}</span>}</TableCell>
      <TableCell>{rise?.at_origin ? fmtTime(rise.at_origin, "IST") : "–"}</TableCell>
      <TableCell className="text-right">{rise?.minutes_earlier != null ? fmtLeft(rise.minutes_earlier * 60_000, lang) : "–"}</TableCell>
      <TableCell>
        {eat.sunrise_box ? (
          <StatusChip status="info" icon={Package} size="sm" label={t(s.sunriseBox, lang)} />
        ) : eat.may_eat_from ? (
          <span className="font-semibold">{fmtTime(eat.may_eat_from, "IST")}</span>
        ) : (
          "–"
        )}
      </TableCell>
    </TableRow>
  )
}

function PresetsCard({ currentFlightNo, lang }: { currentFlightNo: string | null; lang: Lang }) {
  const presets = useSunPresets()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(s.presetsTitle, lang)}</CardTitle>
      </CardHeader>
      <CardContent>
        {presets.isError ? (
          <Retry title={t(s.loadError, lang)} onRetry={() => presets.refetch()} lang={lang} />
        ) : !presets.data ? (
          <Skeleton className="h-44" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t(s.colFlight, lang)}</TableHead>
                <TableHead>{t(s.colDeparts, lang)}</TableHead>
                <TableHead>{t(s.colAircraft, lang)}</TableHead>
                <TableHead>{t(s.colOrigin, lang)}</TableHead>
                <TableHead className="text-right">{t(s.colEarlier, lang)}</TableHead>
                <TableHead>{t(s.colEat, lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.data.flights.map((f) => (
                <PresetRow key={f.flight_no} f={f} current={f.flight_no === currentFlightNo} lang={lang} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function SeatsCard({ flightNo, lang }: { flightNo: string; lang: Lang }) {
  const seats = useSunSeats(FLIGHT_ID)
  const rows = seats.data?.seats ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>{fill(t(s.seatsTitle, lang), { flight: flightNo })}</CardTitle>
      </CardHeader>
      <CardContent>
        {seats.isError ? (
          <Retry title={t(s.loadError, lang)} onRetry={() => seats.refetch()} lang={lang} />
        ) : seats.isLoading ? (
          <Skeleton className="h-24" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Sunrise} title={fill(t(s.seatsEmptyTitle, lang), { flight: flightNo })} body={t(s.seatsEmptyBody, lang)} />
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((row) => (
              <li key={row.passenger_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="w-12 font-display text-lg font-semibold tabular">{row.seat}</span>
                <span className="flex min-w-0 flex-1 flex-col" lang={lang}>
                  <span className="text-sm font-medium">{ruleLabel(row.rule, lang)}</span>
                  {row.may_eat_until && (
                    <span className="text-xs text-muted-foreground">{fill(t(s.until, lang), { time: fmtTime(row.may_eat_until, "IST") })}</span>
                  )}
                </span>
                <SunTimer mayEatFrom={row.may_eat_from} sunriseBox={row.sunrise_box} lang={lang} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function SunPage() {
  const [lang, setLang] = useState<Lang>("en")
  const flight = useSunFlight(FLIGHT_ID)
  const f = flight.data
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow={f ? `${f.flight_no ?? ""} · ${f.origin} → ${f.dest} · ${DAY.format(new Date(f.dep))}` : undefined}
        title={<span lang={lang}>{t(s.title, lang)}</span>}
        subtitle={<span lang={lang}>{t(s.subtitle, lang)}</span>}
        actions={<LangSwitch value={lang} onChange={setLang} />}
      />
      {flight.isError ? (
        <Retry title={t(s.loadError, lang)} onRetry={() => flight.refetch()} lang={lang} />
      ) : !f ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
          <Skeleton className="h-[460px]" />
        </>
      ) : (
        <>
          <Kpis flight={f} lang={lang} />
          <ChartCard flight={f} lang={lang} />
        </>
      )}
      <PresetsCard currentFlightNo={f?.flight_no ?? null} lang={lang} />
      <SeatsCard flightNo={f?.flight_no ?? "JL740"} lang={lang} />
    </div>
  )
}
