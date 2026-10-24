// /jal: a concept of JAL's "Manage booking → Special meal" with ThaliBento plugged in. Always in the JAL palette
// (data-brand on its own root), clearly marked as a concept, and with no login, payment or personal-data fields:
// the booking is a sample passenger (?passenger=, default Priya, 23C).
import { ChevronRight, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"

import { useFlight } from "@/lib/flight"
import { Button, EmptyState } from "@/ui"

import { BookingCard } from "./BookingCard"
import { SAMPLE_PASSENGER, useBooking, useBookingMeals } from "./data"
import { fmtDay, s, tr, type PageLang } from "./i18n"
import { MealForm } from "./MealForm"
import { ConceptBanner, SiteFooter, SiteHeader } from "./SiteChrome"
import { ThaliPanel } from "./ThaliPanel"

const PAGE_TITLE = "Special meal · Manage booking (concept) · ThaliBento"

function usePageTitle(title: string) {
  useEffect(() => {
    const before = document.title
    document.title = title
    return () => {
      document.title = before
    }
  }, [title])
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="h-48 animate-pulse rounded-xl bg-ice" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="h-[520px] animate-pulse rounded-xl bg-ice" />
        <div className="h-[520px] animate-pulse rounded-xl bg-ice" />
      </div>
    </div>
  )
}

export function JalPage() {
  const [params] = useSearchParams()
  const passengerId = params.get("passenger") ?? SAMPLE_PASSENGER
  const [lang, setLang] = useState<PageLang>("en")
  const flight = useFlight()
  const booking = useBooking(passengerId)
  const people = booking.data ? [booking.data.passenger, ...booking.data.passengers] : []
  const meals = useBookingMeals(people.map((p) => p.passenger_id))
  usePageTitle(PAGE_TITLE)

  let body
  if (booking.isError || flight.isError) {
    body = (
      <EmptyState
        title={tr(s.noBooking, lang)}
        body={(booking.error ?? flight.error)?.message}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => (booking.isError ? booking.refetch() : flight.refetch())}>
              <RefreshCw /> {tr(s.retry, lang)}
            </Button>
            {passengerId !== SAMPLE_PASSENGER && (
              <Button asChild className="rounded-full">
                <Link to="/jal">{tr(s.backToSample, lang)}</Link>
              </Button>
            )}
          </div>
        }
      />
    )
  } else if (!booking.data || !flight.data) {
    body = <Skeleton />
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <BookingCard booking={booking.data} flight={flight.data} meals={meals.data} lang={lang} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
          <MealForm key={passengerId} flight={flight.data} people={people} meals={meals.data} lang={lang} />
          <ThaliPanel flight={flight.data} passengerId={passengerId} name={booking.data.passenger.name} lang={lang} />
        </div>
      </div>
    )
  }

  return (
    <div data-brand="jal" lang={lang} className="flex min-h-screen flex-col bg-background text-foreground">
      <ConceptBanner lang={lang} />
      <SiteHeader lang={lang} onLang={setLang} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 text-[15px] md:px-8 md:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-grey">
          <ol className="flex items-center gap-1.5">
            <li>{tr(s.navManage, lang)}</li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="font-medium text-navy">
              {tr(s.crumbMeal, lang)}
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy md:text-4xl">{tr(s.title, lang)}</h1>
        {flight.data && (
          <p className="mt-1 mb-6 text-grey">
            {tr(s.subtitle, lang, { flight: flight.data.flight_no, date: fmtDay(flight.data.std, lang) })}
          </p>
        )}
        {body}
      </main>
      <SiteFooter lang={lang} />
    </div>
  )
}
