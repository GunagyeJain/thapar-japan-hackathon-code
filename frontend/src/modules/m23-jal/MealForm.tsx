// Today's JAL form: pick one special-meal code per passenger before the deadline. Shown as it works today, on the
// sim clock; it sends nothing (the concept's point is what one code can't carry).
import { Lock, Minus } from "lucide-react"
import { useState } from "react"

import { useSimClock } from "@/lib/clock"
import type { FlightDetail, PassengerWithPromise } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Countdown, StatusChip } from "@/ui"
import type { BookingPerson } from "@/modules/m17-passport/types"

import { mealLine } from "./data"
import { isOpen, mealChoices, mealDeadlines, type MealChoice, type MealDeadline } from "./deadlines"
import { fmtWhen, s, tr, type PageLang } from "./i18n"

const SOURCE_URL = "https://www.jal.co.jp/jp/en/inter/service/meal/special/menu/index.html"
const CHOICES = mealChoices()

interface MealFormProps {
  flight: FlightDetail
  people: BookingPerson[]
  meals: Map<string, PassengerWithPromise> | undefined
  lang: PageLang
}

function DeadlineRow({ deadline, now, lang }: { deadline: MealDeadline; now: Date | null; lang: PageLang }) {
  const open = isOpen(deadline.at, now)
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">{tr(deadline.id === "standard" ? s.deadlineStandard : s.deadlineLongLead, lang)}</p>
        <p className="text-xs text-grey">
          <span className="tabular">{fmtWhen(deadline.at, lang)}</span> · {tr(s.deadlineHours, lang, { h: deadline.hours, p: deadline.phoneHours })}
        </p>
      </div>
      {open ? (
        <Countdown until={deadline.at} label={tr(s.open, lang)} warnUnder="2h" />
      ) : (
        <StatusChip status="neutral" size="sm" icon={Lock} label={tr(s.closed, lang)} />
      )}
    </li>
  )
}

function ChoiceRow({ choice, name, checked, disabled, onPick, lang }: {
  choice: MealChoice
  name: string
  checked: boolean
  disabled: boolean
  onPick: () => void
  lang: PageLang
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-colors duration-150",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-navy/50",
        checked && "border-navy ring-1 ring-navy",
      )}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onPick} className="size-4 shrink-0 accent-primary" />
      <span className="code w-11 shrink-0 text-xs font-semibold text-navy">{choice.code ?? "—"}</span>
      <span className="min-w-0 flex-1 text-sm leading-snug" lang={lang}>
        {choice.name[lang] ?? choice.name.en}
      </span>
      {choice.deadline === "long_lead" && <span className="shrink-0 text-xs text-grey tabular">49 h</span>}
    </label>
  )
}

export function MealForm({ flight, people, meals, lang }: MealFormProps) {
  const { now } = useSimClock()
  const [who, setWho] = useState(people[0]?.passenger_id ?? "")
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [requested, setRequested] = useState(false)
  const deadlines = mealDeadlines(flight)
  const openNow = { standard: isOpen(deadlines[0].at, now), long_lead: isOpen(deadlines[1].at, now) }
  const booked = mealLine(meals?.get(who))?.code ?? null
  const choice = picked[who] ?? CHOICES.find((c) => c.code === booked)?.id ?? null
  const pick = (id: string) => {
    setPicked((prev) => ({ ...prev, [who]: id }))
    setRequested(false)
  }

  return (
    <section aria-labelledby="form-title" className="flex flex-col gap-5 rounded-xl border bg-card p-5 md:p-6">
      <div>
        <h2 id="form-title" className="text-xl font-bold text-navy">
          {tr(s.formTitle, lang)}
        </h2>
        <p className="mt-1 text-sm text-grey">{tr(s.formToday, lang)}</p>
      </div>

      {people.length > 1 && (
        <div role="group" aria-label={tr(s.formFor, lang)} className="flex flex-wrap gap-2">
          {people.map((p) => (
            <Button
              key={p.passenger_id}
              type="button"
              variant="outline"
              aria-pressed={who === p.passenger_id}
              onClick={() => setWho(p.passenger_id)}
              className={cn("rounded-full", who === p.passenger_id && "border-navy bg-navy text-white hover:bg-navy")}
            >
              {p.name} · <span className="tabular">{p.seat}</span>
            </Button>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-muted px-4">
        <h3 className="pt-3 text-xs font-medium tracking-wider text-grey uppercase">{tr(s.deadlines, lang)}</h3>
        <ul className="divide-y">
          {deadlines.map((d) => (
            <DeadlineRow key={d.id} deadline={d} now={now} lang={lang} />
          ))}
        </ul>
        <p className="pb-3 text-xs text-grey">
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-navy">
            {tr(s.source, lang)}
          </a>
        </p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">{tr(s.formTitle, lang)}</legend>
        {CHOICES.map((c) => (
          <ChoiceRow
            key={c.id}
            choice={c}
            name={`meal-${who}`}
            checked={choice === c.id}
            disabled={!openNow[c.deadline]}
            onPick={() => pick(c.id)}
            lang={lang}
          />
        ))}
      </fieldset>

      {openNow.standard ? (
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-fit rounded-full px-8" disabled={!choice} onClick={() => setRequested(true)}>
            {tr(s.request, lang)}
          </Button>
          {requested && (
            <p className="animate-arrive flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm text-navy sm:flex-row" role="status">
              <StatusChip status="info" size="sm" label={tr(s.concept, lang)} />
              <span>{tr(s.requestedNote, lang)}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm text-navy">
          <StatusChip status="neutral" size="sm" icon={Lock} label={tr(s.closed, lang)} />
          {tr(s.formClosed, lang, { time: fmtWhen(deadlines[0].at, lang) })}
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-navy">{tr(s.cantSay, lang)}</h3>
        <ul className="mt-1.5 grid gap-1 text-sm text-grey sm:grid-cols-2">
          {[s.cant1, s.cant2, s.cant3, s.cant4].map((item) => (
            <li key={item.en} className="flex items-center gap-2">
              <Minus className="size-3.5 shrink-0" aria-hidden="true" /> {tr(item, lang)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
