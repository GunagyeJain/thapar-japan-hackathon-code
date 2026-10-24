// JL740 as a boarding-pass strip: route, times in their own zones, aircraft, caterer.
import { Plane } from "lucide-react"

import { fmtTime } from "@/lib/format"
import type { FlightDetail } from "@/lib/types"

interface FlightPassProps {
  flight: FlightDetail
}

function Endpoint({ code, city, time, align }: { code: string; city: string; time: string; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <div className="font-display text-5xl font-bold tracking-tight text-navy">{code}</div>
      <div className="mt-1 text-sm text-grey">{city}</div>
      <div className="mt-2 font-display text-xl font-semibold text-navy tabular">{time}</div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-grey">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-navy tabular">{value}</dd>
    </div>
  )
}

export function FlightPass({ flight }: FlightPassProps) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card md:grid md:grid-cols-[1fr_auto_220px]">
      <div className="p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-display font-semibold text-navy">
            {flight.flight_no} · Japan Airlines
          </span>
          <span className="text-grey tabular">{fmtTime(flight.std, "IST", { date: true, zone: false })} 2026</span>
        </div>
        <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Endpoint code={flight.origin} city="Delhi" time={fmtTime(flight.std, "IST")} align="left" />
          <div className="flex items-center gap-2 text-sky" aria-hidden="true">
            <span className="h-px flex-1 border-t border-dashed border-line" />
            <Plane className="size-5" />
            <span className="h-px flex-1 border-t border-dashed border-line" />
          </div>
          <Endpoint code={flight.dest} city="Tokyo Narita" time={fmtTime(flight.sta, "JST")} align="right" />
        </div>
      </div>
      {/* perforation */}
      <div className="relative hidden w-px md:block" aria-hidden="true">
        <div className="absolute inset-y-4 border-l-2 border-dashed border-line" />
        <div className="absolute -top-3 -left-3 size-6 rounded-full border bg-mist" />
        <div className="absolute -bottom-3 -left-3 size-6 rounded-full border bg-mist" />
      </div>
      <dl className="grid grid-cols-2 gap-4 border-t border-dashed bg-ice/50 p-6 md:grid-cols-1 md:border-t-0">
        <Fact label="Aircraft" value={`${flight.aircraft} · ${flight.cabins.C.seats} C / ${flight.cabins.Y.seats} Y`} />
        <Fact label="Boarding" value={fmtTime(flight.boarding_at, "IST")} />
        <Fact label="Caterer" value={flight.caterer} />
        <Fact label="Sealed backups" value={`${flight.backup_count} in galley 2`} />
      </dl>
    </article>
  )
}
