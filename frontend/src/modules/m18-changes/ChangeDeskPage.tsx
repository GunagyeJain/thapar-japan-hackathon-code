// /ops/desk, Change desk: check-in, lounge, gate and crew take a diet change from a passenger. The router answers
// with the best fix still possible at this minute, the message the passenger gets, and what today would have done.
import { Send } from "lucide-react"
import { useState } from "react"

import { FLIGHT_ID } from "@/lib/api"
import { fmtTime } from "@/lib/format"
import type { Lang, Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, Input, LangSwitch, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@/ui"
import { DietPicker } from "@/modules/m3-passenger/DietPicker"
import { EMPTY_DIET } from "@/modules/m3-passenger/diet"
import type { DietValue } from "@/modules/m3-passenger/types"

import { useCabin, useChanges, useItemPlaces, useSubmitChange } from "./api"
import { CutoffLadder } from "./CutoffLadder"
import { DecisionCard } from "./DecisionCard"
import { rulesFromDiet } from "./desk"
import { PassengerCard, PassengerFinder, Segmented, Step, type SegmentOption } from "./DeskParts"
import { CHANNELS, KINDS, WINDOWS } from "./labels"
import { OutcomeChip, RungBadge, SampleChip } from "./parts"
import type { ChangeEvent, ChangeKind, Channel, Rules } from "./types"

type DeskChannel = Extract<Channel, "checkin" | "lounge" | "gate" | "crew">
type Mode = "passport" | "picker"

const CHANNEL_OPTIONS: SegmentOption<DeskChannel>[] = (["checkin", "lounge", "gate", "crew"] as const).map((c) => ({
  value: c,
  label: CHANNELS[c].label,
  icon: CHANNELS[c].icon,
}))
const KIND_OPTIONS: SegmentOption<ChangeKind>[] = (["new_need", "mind_change", "family_member", "lost_request"] as const).map((k) => ({
  value: k,
  label: KINDS[k],
}))
const RECENT = 5
const MAX_NOTE = 200


function Recent({ decisions, shownId, onPick }: { decisions: ChangeEvent[]; shownId: string | null; onPick: (id: string) => void }) {
  if (!decisions.length) return null
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="desk-recent">
      <h2 id="desk-recent" className="text-sm font-semibold">
        Last {Math.min(RECENT, decisions.length)} at this desk
      </h2>
      <ul className="flex flex-col divide-y">
        {decisions.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onPick(d.id)}
              aria-current={d.id === shownId ? "true" : undefined}
              className={cn(
                "flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-ice/60",
                d.id === shownId && "bg-ice",
              )}
            >
              <span className="w-12 text-muted-foreground tabular">{fmtTime(d.at, "IST", { zone: false })}</span>
              <span className="min-w-28 flex-1 truncate">
                <span className="font-semibold tabular">{d.seat ?? "—"}</span> {d.name}
              </span>
              <RungBadge rung={d.decision.rung} />
              <OutcomeChip event={d} side="ours" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ChangeDeskPage() {
  const [channel, setChannel] = useState<DeskChannel>("gate")
  const [lang, setLang] = useState<Lang>("en")
  const [passenger, setPassenger] = useState<Passenger | null>(null)
  const [mode, setMode] = useState<Mode>("picker")
  const [diet, setDiet] = useState<DietValue>(EMPTY_DIET)
  const [kind, setKind] = useState<ChangeKind>("new_need")
  const [note, setNote] = useState("")
  const [decisions, setDecisions] = useState<ChangeEvent[]>([])
  const [shownId, setShownId] = useState<string | null>(null)

  const changes = useChanges()
  const cabin = useCabin()
  const places = useItemPlaces()
  const submit = useSubmitChange()

  const passport = passenger ? cabin.data?.data.passengers.find((p) => p.passenger_id === passenger.id) : undefined
  const hasPassport = Boolean(passport?.known && passport.rules)
  const rules: Rules | undefined = mode === "picker" ? rulesFromDiet(diet) : undefined
  const hasRules = mode === "passport" ? hasPassport : (rules?.forbid.length ?? 0) > 0
  const ready = passenger !== null && hasRules && !submit.isPending
  const events = changes.data?.data.events ?? []
  // A desk decision, or any change picked on the ladder.
  const shown = [...decisions, ...events].find((d) => d.id === shownId) ?? decisions[0] ?? null
  const nowWindow = changes.data?.data.window

  const choose = (p: Passenger) => {
    setPassenger(p)
    const known = cabin.data?.data.passengers.find((x) => x.passenger_id === p.id)
    setMode(known?.known && known.rules ? "passport" : "picker")
  }

  const send = () => {
    if (!passenger) return
    submit.mutate(
      {
        flight_id: FLIGHT_ID,
        passenger_id: passenger.id,
        channel,
        kind,
        lang,
        ...(mode !== "passport" && rules ? { rules } : {}),
        ...(note.trim() ? { note: note.trim().slice(0, MAX_NOTE) } : {}),
      },
      {
        onSuccess: (res) => {
          const d = res.data
          setDecisions((prev) => [d, ...prev.filter((x) => x.id !== d.id)].slice(0, RECENT))
          setShownId(d.id)
          toast.success(`${d.seat ?? passenger.seat}: ${d.decision.ok ? "fixed" : "nothing safe left"}. Passenger told.`)
        },
        onError: (e) => toast.error(`Couldn't submit the change: ${e.message}`),
      },
    )
  }

  const missing = !passenger ? "Find the passenger first." : !hasRules ? "Tap at least one food rule, or read what they said." : null

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        eyebrow="Check-in · lounge · gate · crew"
        title="Change desk"
        subtitle={nowWindow ? `Now: ${WINDOWS[nowWindow].name}` : "Any counter, the best fix still possible"}
        actions={<SampleChip live={changes.data?.live} />}
      />

      <CutoffLadder compact events={events} selectedId={shown?.id ?? null} onSelect={setShownId} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-6 rounded-xl border bg-card p-5" aria-label="New change">
          <Step n={1} title="Where are you?">
            <Segmented value={channel} options={CHANNEL_OPTIONS} onChange={setChannel} ariaLabel="Channel" />
          </Step>

          <Step n={2} title="Find the passenger">
            <PassengerFinder onSelect={choose} />
            {passenger && <PassengerCard passenger={passenger} passport={passport} loading={cabin.isPending} />}
          </Step>

          <Step n={3} title="What do they need?" aside={<LangSwitch value={lang} onChange={setLang} />}>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="h-10">
                {hasPassport && <TabsTrigger value="passport">Their passport</TabsTrigger>}
                <TabsTrigger value="picker">Tap the rules</TabsTrigger>
              </TabsList>
              {hasPassport && (
                <TabsContent value="passport" className="pt-2 text-sm text-muted-foreground">
                  Uses the rules in their passport.
                </TabsContent>
              )}
              <TabsContent value="picker" className="pt-2">
                <DietPicker compact value={diet} lang={lang} onChange={setDiet} />
              </TabsContent>
            </Tabs>
          </Step>

          <Step n={4} title="Send it to the router">
            <Segmented value={kind} options={KIND_OPTIONS} onChange={setKind} ariaLabel="Kind of change" size="sm" />
            <Input aria-label="Note (optional)" placeholder="Note for the crew (optional)" maxLength={MAX_NOTE} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" disabled={!ready} onClick={send}>
                <Send /> {submit.isPending ? "Deciding…" : "Submit change"}
              </Button>
              {missing && <span className="text-sm text-muted-foreground">{missing}</span>}
            </div>
          </Step>
        </section>

        <div className="flex flex-col gap-4">
          <section className={cn("rounded-xl border bg-card p-5", !shown && "flex")} aria-live="polite" aria-label="Decision">
            {shown ? (
              <DecisionCard key={shown.id} event={shown} place={shown.decision.item_id ? places.data?.get(shown.decision.item_id) : null} className="animate-arrive" />
            ) : (
              <EmptyState
                className="flex-1"
                icon={Send}
                title="The fix appears here"
              />
            )}
          </section>
          <Recent decisions={decisions} shownId={shown?.id ?? null} onPick={setShownId} />
        </div>
      </div>
    </div>
  )
}
