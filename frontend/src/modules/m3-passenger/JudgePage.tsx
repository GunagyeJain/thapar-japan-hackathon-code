// /j: a judge scans the QR, says what they don't eat, gets a seat in row 5 and a safe meal on board.
// One seat per device: the join is remembered on the phone, so a refresh doesn't take a second seat.
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { api, ApiError } from "@/lib/api"
import type { Lang, Text } from "@/lib/types"
import { Button, Input, LangSwitch, StatusChip } from "@/ui"

import { DietPicker } from "./DietPicker"
import { EMPTY_DIET, toRequest } from "./diet"
import { pick, s } from "./i18n"
import { BoardingPass, ErrorBox, PromiseView, Step } from "./parts"
import { ConsentForm } from "./PassengerPage"
import type { ConsentIn, DietValue, JoinOut } from "./types"

const STORE_KEY = "thalibento.judge"

function remembered(): JoinOut | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as JoinOut) : null
  } catch {
    return null
  }
}

function remember(out: JoinOut | null) {
  try {
    if (out) localStorage.setItem(STORE_KEY, JSON.stringify(out))
    else localStorage.removeItem(STORE_KEY)
  } catch {
    // private mode: the join still works, it just isn't remembered
  }
}

export function JudgePage() {
  const [joined, setJoined] = useState<JoinOut | null>(remembered)
  const [lang, setLang] = useState<Lang>(joined?.profile.lang ?? "en")
  const [name, setName] = useState("")
  const [consent, setConsent] = useState<ConsentIn>({ this_trip: true, save_profile: false, share_with_caterer: true, cross_border_ack: false })
  const [diet, setDiet] = useState<DietValue>(EMPTY_DIET)

  const join = useMutation({
    mutationFn: () => {
      const { presets, forbid, allow } = toRequest(diet)
      return api.post<JoinOut>("/join", {
        display_name: name.trim() || pick(s.judge.namePlaceholder, "en"),
        lang,
        presets,
        forbid,
        allow,
        consent: { ...consent, cross_border_ack: true },
      })
    },
    onSuccess: (out) => {
      remember(out)
      setJoined(out)
    },
  })

  if (joined) return <Joined out={joined} lang={lang} onReset={() => { remember(null); setJoined(null) }} />

  const full = join.error instanceof ApiError && join.error.status === 409
  const canJoin = consent.this_trip && toRequest(diet).forbid.length > 0 && !join.isPending

  return (
    <div className="flex flex-col">
      <BoardingPass lang={lang} />
      <Step
        lang={lang}
        title={pick(s.judge.title, lang)}
        sub={pick(s.judge.sub, lang)}
        action={
          <Button size="lg" className="min-h-11 flex-1" disabled={!canJoin} onClick={() => join.mutate()}>
            {join.isPending ? pick(s.judge.joining, lang) : pick(s.judge.join, lang)}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <LangSwitch value={lang} onChange={setLang} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-navy">{pick(s.judge.name, lang)}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={pick(s.judge.namePlaceholder, lang)} maxLength={40} className="h-11 text-lg" />
          </label>
          <section>
            <h2 className="mb-2 font-display text-lg font-semibold text-navy">{pick(s.picker.title, lang)}</h2>
            <DietPicker value={diet} onChange={setDiet} lang={lang} />
          </section>
          <section>
            <h2 className="mb-2 font-display text-lg font-semibold text-navy">{pick(s.consent.title, lang)}</h2>
            <ConsentForm value={consent} onChange={setConsent} lang={lang} />
          </section>
          {join.isError && <ErrorBox lang={lang} message={full ? pick(s.judge.full, lang) : join.error.message} onRetry={full ? undefined : () => join.mutate()} />}
        </div>
      </Step>
    </div>
  )
}

type LateOut = { late_request: { id: string }; match: { status: "matched" | "voucher"; explanation: Text } }

function Joined({ out, lang, onReset }: { out: JoinOut; lang: Lang; onReset: () => void }) {
  // m6 reserves a meal for the judge. Until its endpoint is live, crew confirm on board.
  const late = useQuery({
    queryKey: ["late-request", out.passenger.id],
    queryFn: () =>
      api.post<LateOut>("/late-requests", {
        flight_id: out.passenger.flight_id,
        passenger_id: out.passenger.id,
        forbid: out.profile.forbid,
        allow: out.profile.allow,
        source: "join",
      }),
    retry: false,
    staleTime: Infinity,
  })

  return (
    <div className="flex flex-col">
      <BoardingPass passenger={out.passenger} code={out.promise.code} lang={lang} />
      <Step lang={lang} title={pick(s.promise.title, lang)} sub={pick(s.promise.sub, lang)}>
        <PromiseView passenger={out.passenger} promise={out.promise} lang={lang}>
          <div className="rounded-[10px] border border-line bg-card p-3">
            {late.isPending ? (
              <p className="animate-pulse text-sm text-grey">{pick(s.judge.matching, lang)}</p>
            ) : late.isSuccess ? (
              <StatusChip
                status={late.data.match.status === "matched" ? "safe" : "warn"}
                className="h-auto py-1 whitespace-normal"
                label={pick(late.data.match.explanation, lang)}
              />
            ) : (
              <StatusChip status="info" className="h-auto py-1 whitespace-normal" label={pick(s.judge.crewWillConfirm, lang)} />
            )}
          </div>
        </PromiseView>
        <button type="button" onClick={onReset} className="mt-6 min-h-11 text-sm text-grey underline-offset-4 hover:underline">
          {pick(s.judge.notYou, lang)}
        </button>
      </Step>
    </div>
  )
}
