// /jal/meal: Special meal inside My Booking. A tick-box form (what you don't eat, allergies, special days), one
// Save, the meal the kitchen gets, and the Calendar Radar's one-tap question when a fast day falls on the flight.
import { ArrowLeft, Check, CheckCircle2, MoonStar } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"

import { msUntil, useSimClock } from "@/lib/clock"
import { useFlight } from "@/lib/flight"
import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import { loadRules } from "@/lib/rules"
import type { Lang, Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, StatusChip } from "@/ui"
import { answeredQuestions, radarQuestion } from "@/modules/m17-passport/thread"
import { DietPicker } from "@/modules/m3-passenger/DietPicker"
import { EMPTY_DIET, toRequest } from "@/modules/m3-passenger/diet"
import type { DietValue } from "@/modules/m3-passenger/types"

import { useBooking, useMeals, useNotes, usePassport, useRadarAnswer, useSavePassport } from "./api"
import { s } from "./i18n"
import { JalShell, pill, useJalLang } from "./SiteChrome"
import { dietOf, formRules, SPECIAL_DAYS, specialDaysOf } from "./specialDays"

export function MealPage() {
  const [params] = useSearchParams()
  const pid = params.get("passenger")
  return (
    <JalShell active="manage">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">{pid ? <Meal pid={pid} /> : <EmptyState title="—" />}</div>
    </JalShell>
  )
}

function Meal({ pid }: { pid: string }) {
  const lang = useJalLang()
  const booking = useBooking(pid)
  const passport = usePassport(pid)
  const person = booking.data?.passenger
  if (passport.isLoading || booking.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
  return (
    <div className="flex flex-col gap-6">
      <Link to={`/jal/booking?passenger=${pid}`} className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> {t(s.back, lang)}
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold">{t(s.specialMeal, lang)}</h1>
        {person && (
          <p className="mt-1 text-lg text-muted-foreground">
            {person.name} · {t(s.seat, lang)} <span className="tabular">{person.seat}</span>
          </p>
        )}
      </header>
      {/* Mounted once the saved passport (if any) has loaded, so the form opens with it ticked. */}
      <MealForm pid={pid} lang={lang} initial={passport.data?.rules ?? null} />
    </div>
  )
}

function MealForm({ pid, lang, initial }: { pid: string; lang: Lang; initial: Parameters<typeof dietOf>[0] & Parameters<typeof specialDaysOf>[0] }) {
  const [diet, setDiet] = useState<DietValue>(() => (initial ? dietOf(initial) : EMPTY_DIET))
  const [days, setDays] = useState<string[]>(() => specialDaysOf(initial))
  const save = useSavePassport(pid)
  const toggleDay = (id: string) => setDays((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))

  const submit = () => {
    const req = toRequest(diet)
    save.mutate({ lang, rules: formRules({ forbid: req.forbid, allow: req.allow, allergens: req.allergens }, days) })
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex flex-col gap-7 rounded-2xl border bg-card p-6">
        <DietPicker value={diet} onChange={setDiet} lang={lang} />
        <section aria-labelledby="jal-days">
          <h3 id="jal-days" className="mb-2.5 font-display text-lg font-semibold">
            {t(s.specialDays, lang)}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SPECIAL_DAYS.map((d) => (
              <Tile key={d.id} label={t(d.label, lang)} on={days.includes(d.id)} onToggle={() => toggleDay(d.id)} />
            ))}
          </div>
        </section>
      </section>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        <MealCard pid={pid} lang={lang} saving={save.isPending} saved={save.isSuccess} failed={save.isError} onSave={submit} />
        <RadarCard pid={pid} lang={lang} />
      </aside>
    </div>
  )
}

/** Same tile as the diet picker's, for the special days. */
function Tile({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "flex min-h-12 items-center gap-2.5 rounded-md border px-3 py-2 text-left text-base leading-tight transition-colors duration-150",
        on ? "border-blue bg-ice font-medium text-navy" : "border-line bg-card hover:border-sky",
      )}
    >
      <span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center rounded-[4px] border", on ? "border-blue bg-blue text-primary-foreground" : "border-line bg-card")}>
        {on && <Check className="size-3.5" />}
      </span>
      {label}
    </button>
  )
}

interface MealCardProps {
  pid: string
  lang: Lang
  saving: boolean
  saved: boolean
  failed: boolean
  onSave: () => void
}

/** What the kitchen gets now, the one button, and until when it can change. */
function MealCard({ pid, lang, saving, saved, failed, onSave }: MealCardProps) {
  const meals = useMeals()
  const flight = useFlight().data
  const { now } = useSimClock()
  const pax = meals.data?.get(pid)
  // The ThaliBento promise once saved; before that, whatever was booked with the ticket.
  const promise = pax?.promise ?? (pax?.ssr_meal ? { code: pax.ssr_meal, kitchen_note: pax.ssr_note } : undefined)
  const codeName = useMemo(() => {
    const code = loadRules().codes.find((c) => c.code === promise?.code)
    return code ? t(code.name, lang) : null
  }, [promise?.code, lang])
  const open = flight && now ? msUntil(flight.special_meal_cutoff, now) > 0 : true
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6" aria-live="polite">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase">{t(s.yourMeal, lang)}</h2>
      {promise ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-baseline gap-3">
            <span className="code text-3xl font-bold">{promise.code}</span>
            {codeName && <span className="text-sm text-muted-foreground">{codeName}</span>}
          </p>
          {promise.kitchen_note && (
            <p className="text-sm">
              <span className="text-muted-foreground">{t(s.kitchenNote, lang)}: </span>
              <span className="code font-semibold">{promise.kitchen_note}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-lg font-semibold">{t(s.standardMeal, lang)}</p>
      )}
      <Button type="button" className={cn(pill(), "w-full")} disabled={saving} onClick={onSave}>
        {saving ? t(s.saving, lang) : t(s.save, lang)}
      </Button>
      {saved && !saving && <StatusChip status="safe" label={t(s.saved, lang)} className="self-start" />}
      {failed && <StatusChip status="warn" label={t(s.failed, lang)} className="self-start" />}
      {flight && (
        <p className="text-xs text-muted-foreground">
          {open ? t(s.until(fmtTime(flight.special_meal_cutoff, "IST", { date: true })), lang) : t(s.afterCutoff, lang)}
        </p>
      )}
    </section>
  )
}

/** The Calendar Radar's open question for this passenger, answered with one tap. */
function RadarCard({ pid, lang }: { pid: string; lang: Lang }) {
  const notes = useNotes(pid)
  const answer = useRadarAnswer(pid)
  const list = notes.data ?? []
  const answered = answeredQuestions(list)
  const latest = list.map(radarQuestion).find((q) => q !== null) ?? null
  if (!latest) return null
  const picked = answered.get(latest.question_id)
  const reply = list.find((n) => (n.ref as { kind?: string; question_id?: string }).kind === "radar_answer" && (n.ref as { question_id?: string }).question_id === latest.question_id)
  const replyText = (reply?.ref as { text?: Text } | undefined)?.text
  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-blue bg-card p-6 animate-arrive" aria-live="polite">
      <p className="flex items-start gap-2.5 text-lg font-semibold">
        <MoonStar className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>{latest.question ? t(latest.question, lang) : ""}</span>
      </p>
      {picked ? (
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-safe" aria-hidden="true" />
          {replyText ? t(replyText, lang) : t(s.saved, lang)}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {latest.options.map((o) => (
            <Button
              key={o.id}
              type="button"
              className={pill(o.id === "yes")}
              disabled={answer.isPending}
              onClick={() => answer.mutate({ question_id: latest.question_id, option_id: o.id })}
            >
              {t(o.label, lang)}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}
