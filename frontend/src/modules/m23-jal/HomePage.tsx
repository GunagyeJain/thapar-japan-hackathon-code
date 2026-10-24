// /jal: the JAL-style home with the booking box. My Booking finds a booking by reference + last name; Flight tickets
// runs a dummy search that books the sample passenger; Flight status reads JL740 live.
import { ArrowRight, Plane } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router"

import { ApiError } from "@/lib/api"
import { useFlight } from "@/lib/flight"
import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Input, StatusChip } from "@/ui"

import { lookupBooking, SAMPLE } from "./api"
import { s } from "./i18n"
import { JalShell, pill, useJalLang } from "./SiteChrome"

type Tab = "flights" | "manage" | "status"
const TABS: { id: Tab; text: Text }[] = [
  { id: "flights", text: s.tabFlights },
  { id: "manage", text: s.tabManage },
  { id: "status", text: s.tabStatus },
]

export function HomePage() {
  const [params] = useSearchParams()
  const first = params.get("tab")
  return (
    <JalShell active={first === "manage" ? "manage" : "book"}>
      <Hero />
      <div className="mx-auto -mt-16 max-w-6xl px-4 pb-16 md:px-8">
        <BookingBox first={first === "flights" || first === "status" ? first : "manage"} />
      </div>
    </JalShell>
  )
}

function Hero() {
  const lang = useJalLang()
  return (
    <section className="bg-muted">
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-24 md:px-8 md:pt-16">
        <h1 className="font-display text-4xl font-bold md:text-5xl">{t(s.heroTitle, lang)}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t(s.heroSub, lang)}</p>
      </div>
    </section>
  )
}

function BookingBox({ first }: { first: Tab }) {
  const lang = useJalLang()
  const [tab, setTab] = useState<Tab>(first)
  return (
    <section className="rounded-2xl border bg-card shadow-overlay">
      <div role="tablist" aria-label={t(s.navBook, lang)} className="flex gap-6 overflow-x-auto border-b px-6">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cn("border-b-2 py-4 text-base font-semibold whitespace-nowrap", tab === x.id ? "border-primary" : "border-transparent text-muted-foreground")}
          >
            {t(x.text, lang)}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === "manage" && <ManageForm />}
        {tab === "flights" && <FlightSearch />}
        {tab === "status" && <FlightStatus />}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}

function ManageForm() {
  const lang = useJalLang()
  const navigate = useNavigate()
  const [pnr, setPnr] = useState("")
  const [surname, setSurname] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Text | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      const pax = await lookupBooking(pnr, surname)
      navigate(`/jal/booking?passenger=${pax.id}`)
    } catch (err) {
      setProblem(err instanceof ApiError && err.status === 404 ? s.notFound : { en: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <Field label={t(s.bookingRef, lang)}>
          <Input value={pnr} onChange={(e) => setPnr(e.target.value)} className="code h-12 text-lg uppercase md:text-lg" maxLength={6} autoComplete="off" />
        </Field>
        <Field label={t(s.lastName, lang)}>
          <Input value={surname} onChange={(e) => setSurname(e.target.value)} className="h-12 text-lg uppercase md:text-lg" autoComplete="off" />
        </Field>
        <Button type="submit" className={pill()} disabled={busy || pnr.trim().length !== 6 || !surname.trim()}>
          {t(s.findBooking, lang)} <ArrowRight />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPnr(SAMPLE.pnr)
            setSurname(SAMPLE.surname)
          }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t(s.tryDemo, lang)}: <span className="code font-semibold text-foreground">{SAMPLE.pnr}</span> · {SAMPLE.surname}
        </button>
        {problem && <StatusChip status="warn" label={t(problem, lang)} />}
      </div>
    </form>
  )
}

function FlightSearch() {
  const lang = useJalLang()
  const navigate = useNavigate()
  const flight = useFlight().data
  const [shown, setShown] = useState(false)
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
        <Field label={t(s.from, lang)}>
          <Input readOnly value="Delhi (DEL)" className="h-12 text-base" />
        </Field>
        <Field label={t(s.to, lang)}>
          <Input readOnly value="Tokyo Narita (NRT)" className="h-12 text-base" />
        </Field>
        <Field label={t(s.depart, lang)}>
          <Input readOnly value="25 Oct 2026" className="h-12 text-base tabular" />
        </Field>
        <Field label=" ">
          <Input readOnly value={t(s.travellers, lang)} className="h-12 text-base" />
        </Field>
        <Button type="button" className={pill()} onClick={() => setShown(true)}>
          {t(s.search, lang)}
        </Button>
      </div>
      {shown && flight && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border p-4 animate-arrive">
          <span className="font-display text-xl font-bold">{flight.flight_no}</span>
          <span className="flex items-center gap-3 text-lg tabular">
            {fmtTime(flight.std, "IST")} <Plane className="size-4 text-muted-foreground" aria-hidden="true" /> {fmtTime(flight.sta, "JST")}
          </span>
          <span className="text-muted-foreground">{flight.aircraft}</span>
          <Button
            type="button"
            className={cn(pill(), "ml-auto")}
            onClick={() => navigate(`/jal/booking?passenger=${SAMPLE.passengerId}&new=1`)}
            title={t(s.sample, lang)}
          >
            {t(s.select, lang)}
          </Button>
        </div>
      )}
    </div>
  )
}

function FlightStatus() {
  const lang = useJalLang()
  const flight = useFlight().data
  if (!flight) return <div className="h-16 animate-pulse rounded-xl bg-muted" aria-busy="true" />
  const late = flight.delay_min > 0
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <span className="font-display text-xl font-bold">{flight.flight_no}</span>
      <span className="text-lg tabular">
        DEL {fmtTime(flight.std, "IST")} → NRT {fmtTime(flight.sta, "JST")}
      </span>
      <StatusChip status={late ? "warn" : "safe"} label={late ? t(s.delayed(flight.delay_min), lang) : t(s.onTime, lang)} />
    </div>
  )
}
