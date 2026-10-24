// "/": JL740 at a glance, the sim clock in both zones, and a way into every surface.
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, RefreshCw } from "lucide-react"
import { Link } from "react-router"

import { NAV } from "@/app/nav"
import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import { useSimClock } from "@/lib/clock"
import { fmtTime } from "@/lib/format"
import type { FlightDetail } from "@/lib/types"
import { Button } from "@/ui/button"
import { CatererCountdown, DeadlineList } from "@/modules/m0-home/Deadlines"
import { FlightPass } from "@/modules/m0-home/FlightPass"

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="font-display text-3xl font-bold tracking-tight text-navy tabular">{value}</div>
      <div className="mt-1 text-sm text-grey">{label}</div>
    </div>
  )
}

function DualClock({ now }: { now: Date | null }) {
  return (
    <div className="flex items-baseline gap-4 tabular" aria-label="Sim clock">
      <span>
        <span className="font-display text-2xl font-semibold text-navy">{now ? fmtTime(now, "IST", { zone: false }) : "--:--"}</span>
        <span className="ml-1 text-xs text-grey">IST · Delhi</span>
      </span>
      <span>
        <span className="font-display text-2xl font-semibold text-navy">{now ? fmtTime(now, "JST", { zone: false }) : "--:--"}</span>
        <span className="ml-1 text-xs text-grey">JST · Tokyo</span>
      </span>
    </div>
  )
}

function SurfaceTiles() {
  const surfaces = NAV.filter((n) => n.to !== "/" && n.group !== "Team")
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {surfaces.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-blue hover:bg-ice/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="rounded-md bg-ice p-2 text-blue">
            <n.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-medium text-navy">
              {n.label}
              <ArrowUpRight className="size-3.5 text-grey opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="mt-0.5 block text-sm text-grey">{n.blurb}</span>
            <span className="mt-1.5 block font-mono text-xs text-grey/80">{n.to}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading JL740">
      <div className="h-48 animate-pulse rounded-xl bg-ice" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-ice" />
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
  const { now } = useSimClock()
  const flight = useQuery({
    queryKey: ["flight", FLIGHT_ID],
    queryFn: () => api.get<FlightDetail>(`/flights/${FLIGHT_ID}`),
    refetchInterval: POLL_MS,
  })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-grey">Delhi → Tokyo Narita · 25 Oct 2026</p>
          <h1 className="mt-1 text-[32px] leading-tight font-bold tracking-tight text-navy">
            {flight.data
              ? `JL740 · ${flight.data.counts.passengers} passengers · ${flight.data.counts.special_meals} special meals`
              : "JL740"}
          </h1>
        </div>
        <DualClock now={now} />
      </header>

      {flight.isError ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-unsafe/30 bg-unsafe-bg p-5 text-unsafe">
          <span>Couldn't load JL740: {flight.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => flight.refetch()}>
            <RefreshCw /> Retry
          </Button>
        </div>
      ) : !flight.data || !now ? (
        <HomeSkeleton />
      ) : (
        <>
          <FlightPass flight={flight.data} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={flight.data.counts.passengers} label="passengers booked" />
            <Stat value={flight.data.counts.special_meals} label="special meals on the list" />
            <Stat value={flight.data.counts.open_alerts} label="open alerts" />
            <CatererCountdown flight={flight.data} now={now} />
          </div>
          <section className="rounded-xl border bg-card px-5 py-3" aria-label="Hand-off deadlines">
            <h2 className="pt-1 pb-2 text-base font-semibold text-navy">Hand-offs</h2>
            <DeadlineList flight={flight.data} now={now} />
          </section>
        </>
      )}

      <section aria-label="Surfaces" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-navy">Surfaces</h2>
        <SurfaceTiles />
      </section>
    </div>
  )
}
