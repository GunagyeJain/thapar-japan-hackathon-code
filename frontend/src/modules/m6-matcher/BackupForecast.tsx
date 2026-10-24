// How many sealed backups to load per day, and why. Used on /ops/late and by m7 (caterer).
import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"

import { api } from "@/lib/api"
import { t } from "@/lib/i18n"
import type { Lang, Text } from "@/lib/types"
import { Button } from "@/ui"

interface ForecastRow {
  date: string
  expected_late: number
  late_cover: number
  recommended: number
  festival?: Text
}

interface Forecast {
  flight_no: string
  service_level: number
  method: Text
  galley_reserve: number
  rows: ForecastRow[]
}

export interface BackupForecastProps {
  flightNo?: string
  days?: number
  lang?: Lang
}

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })

/** Expected late requests per day; the number on top is how many backups to load. */
function Bars({ rows }: { rows: ForecastRow[] }) {
  const top = Math.max(...rows.map((r) => r.expected_late))
  return (
    <div className="flex h-36 items-stretch gap-1" aria-hidden="true">
      {rows.map((r) => (
        <div key={r.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold tabular">{r.recommended}</span>
          <div
            className={r.festival ? "w-full rounded-t-sm bg-blue" : "w-full rounded-t-sm bg-sky/60"}
            style={{ height: `${(r.expected_late / top) * 75}%` }}
          />
          <span className="text-[10px] text-muted-foreground tabular">{r.date.slice(8)}</span>
        </div>
      ))}
    </div>
  )
}

export function BackupForecast({ flightNo = "JL740", days = 14, lang = "en" }: BackupForecastProps) {
  const query = useQuery({
    queryKey: ["m6", "forecast", flightNo, days],
    queryFn: () => api.get<Forecast>(`/backups/forecast?flight_no=${encodeURIComponent(flightNo)}&days=${days}`),
  })

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-labelledby="backup-forecast">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="backup-forecast" className="text-base font-semibold">
          Sealed backups to load · {flightNo}
        </h2>
        {query.data && (
          <span className="text-sm text-muted-foreground tabular">
            {Math.round(query.data.service_level * 100)}% cover + {query.data.galley_reserve} galley
          </span>
        )}
      </div>
      {query.isError ? (
        <div className="flex items-center gap-3 text-sm text-unsafe">
          Couldn't load the forecast: {query.error.message}
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw /> Retry
          </Button>
        </div>
      ) : !query.data ? (
        <div className="h-48 animate-pulse rounded-lg bg-ice" aria-busy="true" />
      ) : (
        <>
          <Bars rows={query.data.rows} />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-sky/60" /> expected late requests
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-blue" /> festival or group day
            </span>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Day by day</summary>
          <table className="mt-2 w-full text-sm tabular">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Date</th>
                <th className="py-1.5 text-right font-medium">Expected late</th>
                <th className="py-1.5 text-right font-medium">Load</th>
                <th className="py-1.5 pl-4 font-medium">Why it moves</th>
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((r) => (
                <tr key={r.date} className="h-9 border-b last:border-0">
                  <td>{DAY.format(new Date(`${r.date}T00:00:00Z`))}</td>
                  <td className="text-right">{r.expected_late.toFixed(2)}</td>
                  <td className="text-right font-semibold">{r.recommended}</td>
                  <td className="pl-4 text-muted-foreground">{r.festival ? t(r.festival, lang) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
            <p className="mt-2 text-xs text-muted-foreground">{t(query.data.method, lang)}</p>
          </details>
        </>
      )}
    </section>
  )
}
