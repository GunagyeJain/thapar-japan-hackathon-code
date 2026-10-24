// /jal/booking: one booking as My Booking shows it, with Special meal next to each passenger.
import { ArrowLeft, Briefcase, Plane, Ticket, Utensils } from "lucide-react"
import { Link, useSearchParams } from "react-router"

import { useFlight } from "@/lib/flight"
import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { PassengerWithPromise } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge, EmptyState, StatusChip } from "@/ui"

import { useBooking, useMeals } from "./api"
import { s } from "./i18n"
import { JalShell, pill, useJalLang } from "./SiteChrome"

export function BookingPage() {
  const [params] = useSearchParams()
  const pid = params.get("passenger")
  return (
    <JalShell active="manage">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">{pid ? <Booking pid={pid} /> : <Missing />}</div>
    </JalShell>
  )
}

function Missing() {
  const lang = useJalLang()
  return (
    <EmptyState
      title={t(s.notFound, lang)}
      action={
        <Link to="/jal?tab=manage" className={cn(pill(), "inline-flex items-center gap-2")}>
          <ArrowLeft className="size-4" /> {t(s.back, lang)}
        </Link>
      }
    />
  )
}

function Booking({ pid }: { pid: string }) {
  const lang = useJalLang()
  const booking = useBooking(pid)
  const meals = useMeals()
  const flight = useFlight().data
  if (booking.isError) return <Missing />
  if (!booking.data || !flight) return <div className="h-72 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
  const b = booking.data
  const people = [b.passenger, ...b.passengers.filter((p) => p.passenger_id !== b.passenger.passenger_id)]
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t(s.bookingRef, lang)}</p>
          <h1 className="code text-4xl font-bold">{b.pnr}</h1>
        </div>
        <StatusChip status="safe" size="lg" label={t(s.confirmed, lang)} />
      </header>

      <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-2xl border bg-card p-6">
        <div>
          <p className="font-display text-2xl font-bold">{flight.flight_no}</p>
          <p className="text-sm text-muted-foreground">{flightDate(flight.std)}</p>
        </div>
        <div className="flex items-center gap-4">
          <Place code={flight.origin} time={fmtTime(flight.std, "IST")} />
          <Plane className="size-5 text-muted-foreground" aria-hidden="true" />
          <Place code={flight.dest} time={fmtTime(flight.sta, "JST")} />
        </div>
        <p className="text-muted-foreground">{flight.aircraft} · Economy</p>
      </section>

      <section className="rounded-2xl border bg-card">
        <h2 className="border-b px-6 py-4 font-display text-lg font-semibold">{t(s.passengers, lang)}</h2>
        <ul>
          {people.map((p) => (
            <li key={p.passenger_id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-6 py-4 last:border-b-0">
              <span className="min-w-48 flex-1 text-lg font-semibold">{p.name}</span>
              <span className="text-sm">
                <span className="text-muted-foreground">{t(s.seat, lang)} </span>
                <span className="font-semibold tabular">{p.seat}</span>
              </span>
              <MealCell pax={meals.data?.get(p.passenger_id)} />
              <Link to={`/jal/meal?passenger=${p.passenger_id}`} className={cn(pill(), "inline-flex items-center gap-2")}>
                <Utensils className="size-4" aria-hidden="true" /> {t(s.specialMeal, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Ticket, text: s.seats },
          { icon: Briefcase, text: s.baggage },
          { icon: Plane, text: s.checkin },
        ].map(({ icon: Icon, text }) => (
          <div key={text.en} className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-muted-foreground">
            <Icon className="size-5" aria-hidden="true" /> {t(text, lang)}
          </div>
        ))}
      </section>
    </>
  )
}

/** "Sun, 25 Oct 2026" in Delhi time. */
export function flightDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
}

function Place({ code, time }: { code: string; time: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-display text-2xl font-bold">{code}</span>
      <span className="text-sm tabular">{time}</span>
    </span>
  )
}

function MealCell({ pax }: { pax: PassengerWithPromise | undefined }) {
  const lang = useJalLang()
  const code = pax?.promise?.code ?? pax?.ssr_meal
  const note = pax?.promise?.kitchen_note ?? pax?.ssr_note
  return (
    <span className="flex min-w-56 flex-1 flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t(s.meal, lang)}</span>
      {code ? (
        <>
          <Badge variant="secondary" className="code">
            {code}
          </Badge>
          {note && <span className="code text-xs">{note}</span>}
        </>
      ) : (
        <span>{t(s.standardMeal, lang)}</span>
      )}
    </span>
  )
}
