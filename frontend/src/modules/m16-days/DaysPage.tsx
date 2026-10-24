// /p/days: Priya tells her phone which fasts she keeps. The phone finds which of her own flight dates are
// fast days and sends only those dates; the fast-day leg gets its own meal and kitchen note.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plane } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"

import { api } from "@/lib/api"
import { t } from "@/lib/i18n"
import { calendar, fastDays, type FastDay } from "@/lib/rules"
import type { Lang, Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ErrorBox, Step } from "@/modules/m3-passenger/parts"
import { Badge, Button, Checkbox, Input, LangSwitch, StatusChip, toast } from "@/ui"

import { dayLabel } from "./format"
import { fill, s } from "./i18n"
import type { Leg, TripsOut } from "./types"

const KEEPS_KEY = "tb.m16.keeps"

function readKeeps(): string[] {
  try {
    const raw = localStorage.getItem(KEEPS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeKeeps(keeps: string[]): void {
  try {
    localStorage.setItem(KEEPS_KEY, JSON.stringify(keeps))
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

/** The calendar entry for a date among the fasts this person keeps (shown on the phone only). */
function fastDayOn(keeps: string[], date: string): FastDay | null {
  for (const o of calendar().observances) {
    if (!keeps.includes(o.id)) continue
    const hit = o.days.find((d) => d.date === date)
    if (hit) return hit
  }
  return null
}

export function DaysPage() {
  const [params, setParams] = useSearchParams()
  const [lang, setLang] = useState<Lang>("en")
  const [pnr, setPnr] = useState(params.get("pnr") ?? "")
  const [surname, setSurname] = useState(params.get("surname") ?? "")
  const [keeps, setKeeps] = useState<string[]>(readKeeps)
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const queryClient = useQueryClient()

  // Once found, the passenger id stays in the address: a rebooking changes the booking reference (Act 2).
  const pinned = params.get("passenger")
  const wanted = { pnr: params.get("pnr") ?? "", surname: params.get("surname") ?? "" }
  const lookup = useQuery({
    queryKey: ["m16", "lookup", wanted.pnr, wanted.surname],
    queryFn: () => api.get<Passenger>(`/passenger/lookup?pnr=${encodeURIComponent(wanted.pnr)}&surname=${encodeURIComponent(wanted.surname)}`),
    enabled: !pinned && Boolean(wanted.pnr && wanted.surname),
    retry: false,
  })
  const passengerId = pinned ?? lookup.data?.id ?? null
  const trips = useQuery({
    queryKey: ["m16", "trips", passengerId],
    queryFn: () => api.get<TripsOut>(`/days/trips?passenger_id=${encodeURIComponent(passengerId ?? "")}`),
    enabled: passengerId !== null,
    retry: false,
  })

  useEffect(() => writeKeeps(keeps), [keeps])
  useEffect(() => {
    if (!pinned && lookup.data) setParams({ passenger: lookup.data.id }, { replace: true })
  }, [pinned, lookup.data, setParams])

  const legs = trips.data?.legs ?? []
  const suggested = useMemo(() => new Set(fastDays(keeps, legs.map((l) => l.date))), [keeps, legs])
  const ticked = (leg: Leg) => manual[leg.date] ?? (leg.fast_day || suggested.has(leg.date))
  const fastDates = legs.filter(ticked).map((l) => l.date)
  const dirty = legs.some((l) => ticked(l) !== l.fast_day)

  const save = useMutation({
    mutationFn: () => api.post<TripsOut>("/days/save", { passenger_id: passengerId, fast_dates: fastDates }),
    onSuccess: (out) => {
      queryClient.setQueryData(["m16", "trips", passengerId], out)
      setManual({})
      toast.success(t(s.saved, lang))
    },
  })

  const find = (e: FormEvent) => {
    e.preventDefault()
    setParams({ pnr: pnr.trim().toUpperCase(), surname: surname.trim().toUpperCase() })
  }
  const toggleKeep = (id: string) => setKeeps((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]))

  return (
    <div lang={lang} className="flex flex-col gap-2 pb-28">
      <LangSwitch value={lang} onChange={setLang} />
      {!passengerId ? (
        <Step lang={lang} title={t(s.title, lang)} sub={t(s.sub, lang)}>
          <form onSubmit={find} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-grey">
              {t(s.pnr, lang)}
              <Input value={pnr} onChange={(e) => setPnr(e.target.value)} className="code h-11 text-base uppercase" autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-grey">
              {t(s.surname, lang)}
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} className="h-11 text-base uppercase" autoComplete="off" />
            </label>
            {lookup.isError && <ErrorBox lang={lang} message={t(s.notFound, lang)} />}
            <Button type="submit" size="lg" className="min-h-11" disabled={!pnr.trim() || !surname.trim() || lookup.isFetching}>
              {t(s.find, lang)}
            </Button>
          </form>
        </Step>
      ) : (
        <Step
          lang={lang}
          title={t(s.title, lang)}
          sub={t(s.sub, lang)}
          action={
            trips.data?.has_profile ? (
              <Button size="lg" className="min-h-11 w-full" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                {t(s.save, lang)}
              </Button>
            ) : undefined
          }
        >
          {trips.isError && <ErrorBox lang={lang} onRetry={() => trips.refetch()} />}
          {trips.data && !trips.data.has_profile && (
            <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-4">
              <p>{t(s.noProfile, lang)}</p>
              <Button asChild size="lg" className="min-h-11">
                <Link to="/p">{t(s.noProfileAction, lang)}</Link>
              </Button>
            </div>
          )}
          {trips.data?.has_profile && (
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-2">
                <h2 className="font-display text-lg font-semibold text-navy">{t(s.keep, lang)}</h2>
                <div className="flex flex-wrap gap-2">
                  {calendar().observances.filter((o) => o.rules === "vrat").map((o) => (
                    <Button
                      key={o.id}
                      variant={keeps.includes(o.id) ? "default" : "outline"}
                      size="lg"
                      className="min-h-11"
                      aria-pressed={keeps.includes(o.id)}
                      onClick={() => toggleKeep(o.id)}
                    >
                      {t(o.labels, lang)}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-grey">{t(s.keepNote, lang)}</p>
              </section>
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-semibold text-navy">{t(s.legs, lang)}</h2>
                {legs.map((leg) => (
                  <LegCard
                    key={leg.date + leg.flight_no}
                    leg={leg}
                    lang={lang}
                    checked={ticked(leg)}
                    calendarDay={fastDayOn(keeps, leg.date)}
                    onChange={(v) => setManual((m) => ({ ...m, [leg.date]: v }))}
                  />
                ))}
                <p className="text-xs text-grey tabular">
                  {fill(t(s.sends, lang), { dates: fastDates.length ? fastDates.join(", ") : t(s.nothing, lang) })}
                </p>
                {save.isError && <ErrorBox lang={lang} onRetry={() => save.mutate()} />}
              </section>
            </div>
          )}
        </Step>
      )}
    </div>
  )
}

function LegCard({ leg, lang, checked, calendarDay, onChange }: {
  leg: Leg
  lang: Lang
  checked: boolean
  calendarDay: FastDay | null
  onChange: (value: boolean) => void
}) {
  const unsaved = checked !== leg.fast_day
  return (
    <article className={cn("overflow-hidden rounded-[10px] border bg-card", leg.fast_day ? "border-blue" : "border-line")}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="font-display text-xl font-bold tracking-tight text-navy">{leg.from}</div>
        <div className="flex flex-1 items-center gap-2 text-sky" aria-hidden="true">
          <span className="h-px flex-1 border-t border-dashed border-line" />
          <Plane className="size-4" />
          <span className="h-px flex-1 border-t border-dashed border-line" />
        </div>
        <div className="font-display text-xl font-bold tracking-tight text-navy">{leg.to}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-line bg-ice/50 px-4 py-2 text-sm">
        <span className="font-medium text-navy tabular">{leg.flight_no}</span>
        <span className="tabular">{dayLabel(leg.date, lang)}</span>
        <span className="text-grey">
          {t(s.cateredIn, lang)} {leg.catered_in}
        </span>
        {leg.fast_day && <StatusChip status="info" size="sm" label={t(s.fastDay, lang)} />}
        {unsaved && <StatusChip status="warn" size="sm" label={t(s.unsaved, lang)} />}
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {calendarDay && (
          <p className="text-sm">
            <span className="font-medium text-navy">{t(calendarDay.name, lang)}</span>
            {calendarDay.alt && <span className="block text-grey">{fill(t(s.altDay, lang), { alt: dayLabel(calendarDay.alt, lang) })}</span>}
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3">
          <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
          <span>{t(s.fasting, lang)}</span>
        </label>
        {leg.code && (
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-grey">{t(s.meal, lang)}</span>
              <Badge variant="secondary" className="code">{leg.code}</Badge>
            </div>
            {leg.kitchen_note && (
              <p>
                <span className="text-grey">{t(s.kitchen, lang)}: </span>
                <span className="code text-navy">{leg.kitchen_note}</span>
              </p>
            )}
            {leg.catered_in === "NRT" && leg.kitchen_note_ja && (
              <p lang="ja">
                <span className="text-grey">{t(s.kitchenJa, lang)}：</span>
                <span className="text-navy">{leg.kitchen_note_ja}</span>
              </p>
            )}
            {leg.fast_day && leg.usual && (
              <p className="text-grey">
                {t(s.usualDay, lang)}: <span className="code">{leg.usual.code}</span>
                {leg.usual.kitchen_note && <span className="code"> · {leg.usual.kitchen_note}</span>}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
