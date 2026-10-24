// ThaliBento vs today's process on the same events: four KPI tiles, computed by the server from the change log.
import { RefreshCw } from "lucide-react"

import { Button, EmptyState, KpiTile } from "@/ui"

import { kpiViews } from "./metrics"
import type { MetricsResponse } from "./types"

export interface MetricsStripProps {
  metrics: MetricsResponse | undefined
  error: Error | null
  onRetry: () => void
}

export function MetricsStrip({ metrics, error, onRetry }: MetricsStripProps) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="m18-metrics-title">
      <h2 id="m18-metrics-title" className="text-base font-semibold">
        ThaliBento vs today
      </h2>
      {error && !metrics ? (
        <EmptyState
          title="Couldn't load the metrics"
          body={error.message}
          action={
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw /> Retry
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics
            ? kpiViews(metrics).map((k) => <KpiTile key={k.id} label={k.label} value={k.value} delta={k.delta} status={k.status} />)
            : Array.from({ length: 4 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-xl border bg-card" aria-hidden="true" />)}
        </div>
      )}
    </section>
  )
}
