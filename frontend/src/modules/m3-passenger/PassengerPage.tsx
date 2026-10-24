// /p: Priya finds her booking, gives consent, says once what she doesn't eat, and gets
// AVML + "NO ONION NO GARLIC" with what the other codes would lose.
import { useMutation, useQuery } from "@tanstack/react-query"
import { XCircle } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"

import { api, ApiError } from "@/lib/api"
import { LANGS } from "@/lib/i18n"
import type { Lang, Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Checkbox, Input, LangSwitch } from "@/ui"

import { DietPicker } from "./DietPicker"
import { DietSummary } from "./DietSummary"
import { EMPTY_DIET, toRequest } from "./diet"
import { fill, pick, s } from "./i18n"
import { BoardingPass, CodeCard, ErrorBox, PromiseView, Step, tagList } from "./parts"
import type { BookingCheck, CodeOption, ConsentIn, DietValue, ProfileOut } from "./types"

type StepId = "find" | "lang" | "consent" | "diet" | "summary" | "result" | "promise"
const NUMBERED: StepId[] = ["find", "lang", "consent", "diet", "summary", "result"]

const NO_CONSENT: ConsentIn = { this_trip: true, save_profile: false, share_with_caterer: true, cross_border_ack: false }

export function PassengerPage() {
  const [step, setStep] = useState<StepId>("find")
  const [lang, setLang] = useState<Lang>("en")
  const [passenger, setPassenger] = useState<Passenger | null>(null)
  const [consent, setConsent] = useState<ConsentIn>(NO_CONSENT)
  const [diet, setDiet] = useState<DietValue>(EMPTY_DIET)
  const [saved, setSaved] = useState<ProfileOut | null>(null)

  const n = NUMBERED.indexOf(step) + 1
  const frame = { lang, n: n || undefined, total: NUMBERED.length }
  const back = (to: StepId) => (
    <Button variant="outline" size="lg" className="min-h-11" onClick={() => setStep(to)}>
      {pick(s.common.back, lang)}
    </Button>
  )

  return (
    <div className="flex flex-col">
      <BoardingPass passenger={passenger} code={saved?.promise.code} lang={lang} />

      {step === "find" && (
        <FindBooking
          lang={lang}
          setLang={setLang}
          frame={frame}
          onFound={(p) => {
            setPassenger(p)
            setStep("lang")
          }}
        />
      )}

      {step === "lang" && (
        <Step
          {...frame}
          title={pick(s.language.title, lang)}
          action={
            <>
              {back("find")}
              <Button size="lg" className="min-h-11 flex-1" onClick={() => setStep("consent")}>
                {pick(s.common.next, lang)}
              </Button>
            </>
          }
        >
          <div role="radiogroup" aria-label="Language" className="flex flex-col gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={lang === l.id}
                lang={l.id}
                onClick={() => setLang(l.id)}
                className={cn(
                  "min-h-12 rounded-md border px-4 text-left text-lg font-medium transition-colors duration-150",
                  lang === l.id ? "border-blue bg-ice text-navy ring-1 ring-blue" : "border-line bg-card text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === "consent" && (
        <Step
          {...frame}
          title={pick(s.consent.title, lang)}
          action={
            <>
              {back("lang")}
              <Button
                size="lg"
                className="min-h-11 flex-1"
                disabled={!consent.this_trip}
                onClick={() => {
                  setConsent({ ...consent, cross_border_ack: true })
                  setStep("diet")
                }}
              >
                {pick(s.consent.agree, lang)}
              </Button>
            </>
          }
        >
          <ConsentForm value={consent} onChange={setConsent} lang={lang} />
        </Step>
      )}

      {step === "diet" && (
        <Step
          {...frame}
          title={pick(s.picker.title, lang)}
          sub={pick(s.picker.sub, lang)}
          action={
            <>
              {back("consent")}
              <Button
                size="lg"
                className="min-h-11 flex-1"
                disabled={toRequest(diet).forbid.length === 0}
                onClick={() => setStep("summary")}
              >
                {pick(s.common.next, lang)}
              </Button>
            </>
          }
        >
          <DietPicker value={diet} onChange={setDiet} lang={lang} />
        </Step>
      )}

      {step === "summary" && (
        <Step
          {...frame}
          title={pick(s.summary.title, lang)}
          action={
            <>
              <Button variant="outline" size="lg" className="min-h-11" onClick={() => setStep("diet")}>
                {pick(s.summary.change, lang)}
              </Button>
              <Button size="lg" className="min-h-11 flex-1" onClick={() => setStep("result")}>
                {pick(s.summary.yes, lang)}
              </Button>
            </>
          }
        >
          <DietSummary value={diet} lang={lang} />
        </Step>
      )}

      {step === "result" && passenger && (
        <MealResult
          frame={frame}
          lang={lang}
          passenger={passenger}
          diet={diet}
          consent={consent}
          back={back("summary")}
          onSaved={(out) => {
            setSaved(out)
            setStep("promise")
          }}
        />
      )}

      {step === "promise" && passenger && saved && (
        <Step lang={lang} title={pick(s.promise.title, lang)} sub={pick(s.promise.sub, lang)}>
          <PromiseView passenger={passenger} promise={saved.promise} lang={lang} />
        </Step>
      )}
    </div>
  )
}

type Frame = { lang: Lang; n?: number; total: number }

function FindBooking({ lang, setLang, frame, onFound }: { lang: Lang; setLang: (l: Lang) => void; frame: Frame; onFound: (p: Passenger) => void }) {
  const [pnr, setPnr] = useState("")
  const [surname, setSurname] = useState("")
  const lookup = useMutation({
    mutationFn: () =>
      api.get<Passenger>(`/passenger/lookup?pnr=${encodeURIComponent(pnr)}&surname=${encodeURIComponent(surname)}`),
    onSuccess: onFound,
  })
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (pnr.trim() && surname.trim()) lookup.mutate()
  }
  const notFound = lookup.error instanceof ApiError && lookup.error.status === 404

  return (
    <Step
      {...frame}
      title={pick(s.lookup.title, lang)}
      action={
        <Button size="lg" className="min-h-11 flex-1" disabled={lookup.isPending || !pnr.trim() || !surname.trim()} onClick={() => submit()}>
          {lookup.isPending ? pick(s.lookup.searching, lang) : pick(s.lookup.submit, lang)}
        </Button>
      }
    >
      <LangSwitch value={lang} onChange={setLang} className="mb-4" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy">{pick(s.lookup.pnr, lang)}</span>
          <Input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={6}
            className="h-11 font-mono text-lg tracking-widest uppercase"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy">{pick(s.lookup.surname, lang)}</span>
          <Input value={surname} onChange={(e) => setSurname(e.target.value)} autoCapitalize="characters" autoComplete="family-name" className="h-11 text-lg" />
        </label>
        <p className="text-sm text-grey">{pick(s.lookup.hint, lang)}</p>
        {/* Enter on a phone keyboard submits too */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
      {lookup.isError && (
        <div className="mt-4">
          <ErrorBox lang={lang} message={notFound ? pick(s.lookup.notFound, lang) : undefined} onRetry={notFound ? undefined : () => submit()} />
        </div>
      )}
    </Step>
  )
}

export function ConsentForm({ value, onChange, lang }: { value: ConsentIn; onChange: (v: ConsentIn) => void; lang: Lang }) {
  const rows: { key: keyof ConsentIn; text: string }[] = [
    { key: "this_trip", text: pick(s.consent.thisTrip, lang) },
    { key: "save_profile", text: pick(s.consent.saveProfile, lang) },
    { key: "share_with_caterer", text: pick(s.consent.shareCaterer, lang) },
  ]
  return (
    <div className="flex flex-col gap-4">
      <ul className="rounded-[10px] border border-line bg-card px-3">
        {rows.map((r) => (
          <li key={r.key} className="border-b border-line last:border-b-0">
            <label className="flex min-h-12 cursor-pointer items-center gap-3">
              <Checkbox checked={value[r.key]} onCheckedChange={(c) => onChange({ ...value, [r.key]: c === true })} className="size-5" />
              <span>{r.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="rounded-[10px] bg-ice p-3 text-sm text-navy">{pick(s.consent.notice, lang)}</p>
      {!value.this_trip && <p className="text-sm text-warn">{pick(s.consent.needThisTrip, lang)}</p>}
    </div>
  )
}

function MealResult({
  frame,
  lang,
  passenger,
  diet,
  consent,
  back,
  onSaved,
}: {
  frame: Frame
  lang: Lang
  passenger: Passenger
  diet: DietValue
  consent: ConsentIn
  back: ReactNode
  onSaved: (out: ProfileOut) => void
}) {
  const req = toRequest(diet)
  const options = useQuery({
    queryKey: ["code-options", req.forbid, req.allow],
    queryFn: () => api.post<{ options: CodeOption[] }>("/rules/code-options", { forbid: req.forbid, allow: req.allow }),
  })
  const booking = useQuery({
    queryKey: ["check-booking", req.forbid, passenger.ssr_meal],
    queryFn: () => api.post<BookingCheck>("/rules/check-booking", { forbid: req.forbid, booked_code: passenger.ssr_meal }),
    enabled: !!passenger.ssr_meal,
  })
  const [picked, setPicked] = useState<string | null>(null)
  const list = options.data?.options ?? []
  const chosen = list.find((o) => o.code === picked) ?? list[0]
  const save = useMutation({
    mutationFn: () =>
      api.post<ProfileOut>("/profiles", {
        passenger_id: passenger.id,
        lang,
        ...req,
        consent,
        chosen_code: chosen.code,
      }),
    onSuccess: onSaved,
  })
  const name = `${passenger.surname}/${passenger.given}`
  const clash = booking.data && !booking.data.ok && booking.data.problem ? booking.data.problem : null

  return (
    <Step
      {...frame}
      title={pick(s.result.title, lang)}
      action={
        <>
          {back}
          <Button size="lg" className="min-h-11 flex-1" disabled={!chosen || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? pick(s.result.saving, lang) : chosen ? fill(s.result.confirm, lang, { code: chosen.code }) : pick(s.common.loading, lang)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {clash && chosen && (
          <div role="alert" className="rounded-[10px] border border-unsafe/40 bg-unsafe-bg p-4 text-unsafe">
            <div className="flex items-center gap-2 font-semibold">
              <XCircle className="size-5 shrink-0" aria-hidden="true" />
              {pick(s.result.clashTitle, lang)}
            </div>
            <p className="mt-1 text-sm">
              {fill(s.result.clash, lang, {
                booked: passenger.ssr_meal ?? "",
                list: clash.contains.length ? tagList(clash.contains, lang) : pick(clash.message, lang),
                suggested: chosen.code,
              })}
            </p>
          </div>
        )}

        {options.isPending && (
          <div className="flex flex-col gap-3" aria-label={pick(s.result.working, lang)}>
            <div className="h-48 animate-pulse rounded-[10px] bg-ice" />
            <div className="h-24 animate-pulse rounded-[10px] bg-ice" />
          </div>
        )}
        {options.isError && <ErrorBox lang={lang} message={options.error.message} onRetry={() => options.refetch()} />}

        {chosen && <CodeCard option={chosen} chosen lang={lang} name={name} pnr={passenger.pnr} />}
        {list.filter((o) => o !== chosen).slice(0, 1).map((o) => (
          <div key={o.code}>
            <h2 className="mb-2 text-sm font-medium text-grey">{pick(s.result.alternative, lang)}</h2>
            <CodeCard option={o} chosen={false} onChoose={() => setPicked(o.code)} lang={lang} name={name} />
          </div>
        ))}
        {save.isError && <ErrorBox lang={lang} message={save.error.message} onRetry={() => save.mutate()} />}
      </div>
    </Step>
  )
}
