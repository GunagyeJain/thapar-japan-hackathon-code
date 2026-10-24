// "/": JL740 at a glance, the sim clock in both zones, and a way into every surface.
import { ArrowUpRight, RefreshCw } from "lucide-react"
import { Link } from "react-router"

import { NAV } from "@/app/nav"
import { useFlight } from "@/lib/flight"
import { Button, Countdown, DualClock, PageHeader } from "@/ui"
import { DeadlineList } from "@/modules/m0-home/Deadlines"
import { FlightPass } from "@/modules/m0-home/FlightPass"

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="font-display text-3xl font-bold tracking-tight text-navy tabular">{value}</div>
      <div className="mt-1 text-sm text-grey">{label}</div>
    </div>
  )
}

function SurfaceTiles() {
  const surfaces = NAV.filter((n) => n.to !== "/" && n.group !== "Team")
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {surfaces.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-150 hover:border-blue hover:bg-ice/40"
        >
          <span className="rounded-md bg-ice p-2 text-blue">
            <n.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-medium text-navy">
              {n.label}
              <ArrowUpRight className="size-3.5 text-grey opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="code block text-xs text-grey/80">{n.to}</span>
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
  const flight = useFlight()
  const f = flight.data

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow="Delhi → Tokyo Narita · 25 Oct 2026"
        title={f ? `JL740 · ${f.counts.passengers} passengers · ${f.counts.special_meals} special meals` : "JL740"}
        actions={<DualClock size="lg" />}
      />

      {flight.isError ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-unsafe/30 bg-unsafe-bg p-5 text-unsafe">
          <span>Couldn't load JL740: {flight.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => flight.refetch()}>
            <RefreshCw /> Retry
          </Button>
        </div>
      ) : !f ? (
        <HomeSkeleton />
      ) : (
        <>
          <FlightPass flight={f} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={f.counts.passengers} label="passengers booked" />
            <Stat value={f.counts.special_meals} label="special meals on the list" />
            <Stat value={f.counts.open_alerts} label="open alerts" />
            <div className="rounded-xl border bg-card p-5">
              <Countdown size="lg" label="Caterer's final list" until={f.caterer_final_list_at} />
            </div>
          </div>
          <section className="rounded-xl border bg-card px-5 py-3" aria-label="Hand-off deadlines">
            <h2 className="pt-1 pb-2 text-base font-semibold text-navy">Hand-offs</h2>
            <DeadlineList flight={f} />
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
