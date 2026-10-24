// The booking as Manage booking shows it: reference, the JL740 leg as a boarding-pass strip, and each passenger
// with their seat and the meal on the booking (the ThaliBento promise once there is one).
import { Plane } from "lucide-react"

import { fmtTime } from "@/lib/format"
import type { FlightDetail, PassengerWithPromise } from "@/lib/types"
import { cn } from "@/lib/utils"
import { StatusChip } from "@/ui"
import type { BookingOut, BookingPerson } from "@/modules/m17-passport/types"

import { mealLine } from "./data"
import { fmtDay, s, tr, type PageLang } from "./i18n"

interface BookingCardProps {
  booking: BookingOut
  flight: FlightDetail
  meals: Map<string, PassengerWithPromise> | undefined
  lang: PageLang
}

function Endpoint({ code, city, time, align }: { code: string; city: string; time: string; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <div className="font-display text-3xl font-bold tracking-tight text-navy md:text-4xl">{code}</div>
      <div className="text-sm text-grey">{city}</div>
      <div className="mt-1 font-display text-lg font-semibold text-navy tabular">{time}</div>
    </div>
  )
}

function PersonRow({ person, row, lang }: { person: BookingPerson; row: PassengerWithPromise | undefined; lang: PageLang }) {
  const meal = mealLine(row)
  return (
    <li className="grid gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.4fr)_auto] sm:items-center">
      <span className="font-medium text-navy">{person.name}</span>
      <span className="text-sm text-grey">
        {tr(s.seat, lang)} <span className="font-semibold text-navy tabular">{person.seat}</span>
      </span>
      <span className="min-w-0 text-sm">
        {meal ? (
          <>
            <span className="code font-semibold text-navy">{meal.code}</span>
            {meal.note && <span className="code text-grey"> · {meal.note}</span>}
            {meal.fromThaliBento && <span className="block text-xs text-grey">{tr(s.viaThali, lang)}</span>}
          </>
        ) : (
          <span className="text-grey">{tr(s.noMeal, lang)}</span>
        )}
      </span>
      <StatusChip
        size="sm"
        status={person.has_passport ? "safe" : "neutral"}
        label={`${tr(s.passport, lang)}: ${tr(person.has_passport ? s.passportYes : s.passportNo, lang)}`}
      />
    </li>
  )
}

export function BookingCard({ booking, flight, meals, lang }: BookingCardProps) {
  const people = [booking.passenger, ...booking.passengers]
  const cabin = meals?.get(booking.passenger.passenger_id)?.cabin
  return (
    <section aria-labelledby="booking-ref" className="overflow-hidden rounded-xl border bg-card">
      <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center md:gap-10 md:p-6">
        <div>
          <p id="booking-ref" className="text-xs font-medium tracking-wider text-grey uppercase">
            {tr(s.ref, lang)}
          </p>
          <p className="code mt-1 text-3xl font-bold text-navy">{booking.pnr}</p>
          <p className="mt-1 text-sm text-grey">
            {flight.flight_no} · {fmtDay(flight.std, lang)}
            {cabin && ` · ${tr(cabin === "C" ? s.business : s.economy, lang)}`}
          </p>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Endpoint code={flight.origin} city={tr(s.depart, lang)} time={fmtTime(flight.std, "IST")} align="left" />
          <div className="flex items-center gap-2 text-sky" aria-hidden="true">
            <span className="h-px flex-1 border-t border-dashed border-line" />
            <Plane className="size-5" />
            <span className="h-px flex-1 border-t border-dashed border-line" />
          </div>
          <Endpoint code={flight.dest} city={tr(s.arrive, lang)} time={fmtTime(flight.sta, "JST")} align="right" />
        </div>
      </div>
      <div className="border-t bg-muted/60 px-5 md:px-6">
        <h2 className="pt-3 text-xs font-medium tracking-wider text-grey uppercase">{tr(s.passengers, lang)}</h2>
        <ul className={cn("divide-y", people.length > 1 && "pb-1")}>
          {people.map((p) => (
            <PersonRow key={p.passenger_id} person={p} row={meals?.get(p.passenger_id)} lang={lang} />
          ))}
        </ul>
      </div>
    </section>
  )
}
