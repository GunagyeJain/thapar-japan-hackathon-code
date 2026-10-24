// /j: a judge scans the QR, says what they can't eat, gets a seat in row 5 and a safe meal on board.
// One seat per device: the join is remembered on the phone, so a refresh doesn't take a second seat.
// "Try a different diet" changes the answers on the same seat and frees the old meal.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { api, ApiError } from "@/lib/api"
import type { Lang, Passenger } from "@/lib/types"
import { MatchResult } from "@/modules/m6-matcher/MatchResult"
import type { LateRequestResponse } from "@/modules/m6-matcher/types"
import { Button, Input, LangSwitch, StatusChip } from "@/ui"

import { DietPicker } from "./DietPicker"
import { DietSummary } from "./DietSummary"
import { EMPTY_DIET, toRequest } from "./diet"
import { fill, pick, s } from "./i18n"
import { BoardingPass, ErrorBox, PromiseView, Step } from "./parts"
import { ConsentForm } from "./PassengerPage"
import type { ConsentIn, DietValue, JoinOut } from "./types"

const STORE_KEY = "thalibento.judge"
const START_CONSENT: ConsentIn = { this_trip: true, save_profile: false, share_with_caterer: true, cross_border_ack: false }

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

function dietOf(out: JoinOut): DietValue {
  const { presets, forbid, allow, allergens } = out.profile
  return { presets, forbid: forbid.filter((f) => !allergens.includes(f)), allow, allergens }
}

export function JudgePage() {
  const [joined, setJoined] = useState<JoinOut | null>(remembered)
  /** Set while a judge changes their answers: the seat they keep. */
  const [editing, setEditing] = useState<JoinOut | null>(null)
  const [lang, setLang] = useState<Lang>(joined?.profile.lang ?? "en")
  const [name, setName] = useState("")
  const [consent, setConsent] = useState<ConsentIn>(START_CONSENT)
  const [diet, setDiet] = useState<DietValue>(EMPTY_DIET)
  const queryClient = useQueryClient()

  const join = useMutation({
    mutationFn: () => {
      const { presets, forbid, allow, allergens } = toRequest(diet)
      return api.post<JoinOut>("/join", {
        display_name: name.trim() || pick(s.judge.namePlaceholder, "en"),
        lang,
        presets,
        forbid,
        allow,
        allergens,
        consent: { ...consent, cross_border_ack: true },
        passenger_id: editing?.passenger.id,
      })
    },
    onSuccess: (out) => {
      remember(out)
      void queryClient.invalidateQueries({ queryKey: ["notifications", out.passenger.id] })
      // The server released the old meal: never show a match from before this save.
      queryClient.removeQueries({ queryKey: ["late-request", out.passenger.id] })
      setEditing(null)
      setJoined(out)
    },
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [joined, editing])

  const startEdit = useCallback((out: JoinOut) => {
    setEditing(out)
    setName(out.passenger.display_name ?? "")
    setLang(out.profile.lang)
    setDiet(dietOf(out))
    setConsent({ ...START_CONSENT, ...out.profile.consent })
    setJoined(null)
  }, [])

  const forget = useCallback(() => {
    remember(null)
    setJoined(null)
    setEditing(null)
  }, [])

  if (joined) return <Joined out={joined} lang={lang} onGone={forget} onTryAgain={() => startEdit(joined)} />

  const full = join.error instanceof ApiError && join.error.status === 409
  const gone = join.error instanceof ApiError && join.error.status === 404
  const hasFood = toRequest(diet).forbid.length > 0
  const why = !hasFood ? pick(s.picker.needFood, lang) : !consent.this_trip ? pick(s.consent.needThisTrip, lang) : null

  return (
    <div className="flex flex-col">
      <BoardingPass passenger={editing?.passenger} code={editing?.promise.code} lang={lang} />
      <Step
        lang={lang}
        title={pick(editing ? s.judge.editTitle : s.judge.title, lang)}
        sub={editing ? fill(s.judge.tryAgainSub, lang, { seat: editing.passenger.seat }) : pick(s.judge.sub, lang)}
        action={
          <div className="flex w-full flex-col gap-2">
            {why && <p className="text-sm text-warn">{why}</p>}
            <div className="flex gap-2">
              {editing && (
                <Button variant="outline" size="lg" className="min-h-11" onClick={() => { setJoined(editing); setEditing(null) }}>
                  {pick(s.judge.cancel, lang)}
                </Button>
              )}
              <Button size="lg" className="min-h-11 flex-1" disabled={!!why || join.isPending} onClick={() => join.mutate()}>
                {join.isPending ? pick(s.judge.joining, lang) : pick(editing ? s.judge.saveNew : s.judge.join, lang)}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <LangSwitch value={lang} onChange={setLang} className="self-start" />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-navy">{pick(s.judge.name, lang)}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={pick(s.judge.namePlaceholder, lang)} maxLength={40} className="h-11 text-lg" />
          </label>
          <DietPicker value={diet} onChange={setDiet} lang={lang} />
          <section className="rounded-[10px] border border-line bg-card p-3">
            <h2 className="mb-2 text-sm font-medium text-grey">{pick(s.picker.yourAnswer, lang)}</h2>
            <DietSummary value={diet} lang={lang} />
          </section>
          <section>
            <h2 className="mb-2 font-display text-lg font-semibold text-navy">{pick(s.consent.title, lang)}</h2>
            <ConsentForm value={consent} onChange={setConsent} lang={lang} />
          </section>
          {join.isError && (
            <ErrorBox
              lang={lang}
              message={full ? pick(s.judge.full, lang) : join.error.message}
              onRetry={full ? undefined : gone ? forget : () => join.mutate()}
            />
          )}
        </div>
      </Step>
    </div>
  )
}

function Joined({ out, lang, onGone, onTryAgain }: { out: JoinOut; lang: Lang; onGone: () => void; onTryAgain: () => void }) {
  // A demo reset without judges removes this seat: show the join form again.
  const stillThere = useQuery({
    queryKey: ["judge-seat", out.passenger.id],
    queryFn: async () => {
      const rows = await api.get<Passenger[]>(`/flights/${out.passenger.flight_id}/passengers`)
      return rows.some((p) => p.id === out.passenger.id && p.is_judge)
    },
    staleTime: Infinity,
  })
  useEffect(() => {
    if (stillThere.data === false) onGone()
  }, [stillThere.data, onGone])

  // m6 reserves a meal for the judge's current answers (a new key after "Try a different diet").
  const late = useQuery({
    queryKey: ["late-request", out.passenger.id, out.profile.forbid.join(","), out.profile.allow.join(",")],
    queryFn: () =>
      api.post<LateRequestResponse>("/late-requests", {
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
      <Step
        lang={lang}
        title={pick(s.promise.title, lang)}
        sub={pick(s.promise.sub, lang)}
        action={
          <Button variant="outline" size="lg" className="min-h-11 flex-1" onClick={onTryAgain}>
            <RotateCcw /> {pick(s.judge.tryAgain, lang)}
          </Button>
        }
      >
        <PromiseView passenger={out.passenger} promise={out.promise} lang={lang}>
          <div className="rounded-[10px] border border-line bg-card p-3">
            {late.isPending ? (
              <p className="animate-pulse text-sm text-grey">{pick(s.judge.matching, lang)}</p>
            ) : late.isSuccess ? (
              <MatchResult result={late.data.match} lang={lang} compact />
            ) : (
              <StatusChip status="info" className="h-auto py-1 whitespace-normal" label={pick(s.judge.crewWillConfirm, lang)} />
            )}
          </div>
        </PromiseView>
      </Step>
    </div>
  )
}
