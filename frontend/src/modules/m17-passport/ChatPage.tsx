// /chat: the passenger tells the airline what they eat, in their own words, typed or spoken, in any language.
// The airline answers with the food rules it read (the passport card), orders the meal once they confirm, and the
// Calendar Radar's questions arrive in the same thread (polled from the notifications outbox every 2 s).
// What the passenger types lives only in this page's state; the server keeps food rules, never the sentence.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router"

import { api, ApiError, POLL_MS } from "@/lib/api"
import { useSimClock } from "@/lib/clock"
import { useFlight } from "@/lib/flight"
import type { Lang, Notification, Passenger, Text } from "@/lib/types"
import { LangSwitch, toast } from "@/ui"

import { Bubble, ExamplesBubble, NoteBubble, PlanBubble, Warning } from "./Bubbles"
import { Composer } from "./Composer"
import { fill, pick, s } from "./i18n"
import { PassportCard, type CardStatus } from "./PassportCard"
import { answeredQuestions, chatNotes, freshNotes, parseBooking, shareLink } from "./thread"
import type { BookingOut, BookingPerson, RadarOption, SaveOut, Understood } from "./types"

type Item =
  | { kind: "welcome" | "ask-booking" | "examples"; id: string }
  | { kind: "found"; id: string; name: string; seat: string }
  | { kind: "me"; id: string; text: string; at: string | null }
  | { kind: "error"; id: string; text: Text }
  | { kind: "card"; id: string; card: Understood | null; status: CardStatus; failed: boolean }
  | { kind: "plan"; id: string; out: SaveOut }
  | { kind: "note"; id: string }

let counter = 0
const nextId = () => `local-${++counter}`
const capitalized = (word: string) => word.charAt(0) + word.slice(1).toLowerCase()

function startItems(hasBooking: boolean): Item[] {
  return [{ kind: "welcome", id: nextId() }, { kind: hasBooking ? "examples" : "ask-booking", id: nextId() }]
}

export function ChatPage() {
  const [params, setParams] = useSearchParams()
  const [lang, setLang] = useState<Lang>("en")
  const passengerId = params.get("passenger")
  const wanted = { pnr: params.get("pnr") ?? "", surname: params.get("surname") ?? "" }
  const [items, setItems] = useState<Item[]>(() => startItems(Boolean(passengerId || (wanted.pnr && wanted.surname))))
  const [draft, setDraft] = useState("")
  const [answered, setAnswered] = useState<Map<string, string>>(new Map())
  const queryClient = useQueryClient()
  const { now } = useSimClock()
  const { data: flight } = useFlight()
  const end = useRef<HTMLDivElement>(null)
  const lookedUp = useRef(false)

  const append = useCallback((...more: Item[]) => setItems((prev) => [...prev, ...more]), [])
  const update = useCallback(
    (id: string, patch: Partial<Extract<Item, { kind: "card" }>>) =>
      setItems((prev) => prev.map((i) => (i.id === id && i.kind === "card" ? { ...i, ...patch } : i))),
    [],
  )
  const stamp = () => (now ? now.toISOString() : null)

  const booking = useQuery({
    queryKey: ["m17", "booking", passengerId],
    queryFn: () => api.get<BookingOut>(`/passport/booking/${encodeURIComponent(passengerId ?? "")}`),
    enabled: passengerId !== null,
    retry: false,
  })
  const thread = useQuery({
    queryKey: ["m17", "thread", passengerId],
    queryFn: () => api.get<Notification[]>(`/notifications?to=${encodeURIComponent(passengerId ?? "")}`),
    enabled: passengerId !== null,
    refetchInterval: POLL_MS,
  })

  // Messages from the airline join the thread in the order they arrive.
  useEffect(() => {
    if (!thread.data) return
    setItems((prev) => {
      const shown = new Set(prev.filter((i) => i.kind === "note").map((i) => i.id))
      const fresh = freshNotes(shown, thread.data)
      return fresh.length ? [...prev, ...fresh.map((n): Item => ({ kind: "note", id: n.id }))] : prev
    })
  }, [thread.data])

  // Keep the newest message in view: a new bubble, or a card that has finished reading.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [items])

  const findBooking = useCallback(
    async (pnr: string, surname: string, typed: boolean) => {
      try {
        const pax = await api.get<Passenger>(`/passenger/lookup?pnr=${encodeURIComponent(pnr)}&surname=${encodeURIComponent(surname)}`)
        // Once found, the passenger id stays in the address: a rebooking changes the booking reference later.
        setParams({ passenger: pax.id }, { replace: true })
        if (typed) {
          const name = pax.display_name ?? `${capitalized(pax.given)} ${capitalized(pax.surname)}`
          append(
            { kind: "found", id: nextId(), name, seat: pax.seat },
            { kind: "examples", id: nextId() },
          )
        }
      } catch (err: unknown) {
        const text = err instanceof ApiError && err.status === 404 ? s.notFound : s.error
        append({ kind: "error", id: nextId(), text }, ...(typed ? [] : [{ kind: "ask-booking", id: nextId() } as Item]))
      }
    },
    [append, setParams],
  )

  // /chat?pnr=6XK2QP&surname=SHARMA finds the booking straight away.
  useEffect(() => {
    if (lookedUp.current || passengerId || !wanted.pnr || !wanted.surname) return
    lookedUp.current = true
    void findBooking(wanted.pnr, wanted.surname, false)
  }, [findBooking, passengerId, wanted.pnr, wanted.surname])

  const read = async (text: string) => {
    const id = nextId()
    append({ kind: "me", id: nextId(), text, at: stamp() }, { kind: "card", id, card: null, status: "open", failed: false })
    try {
      const card = await api.post<Understood>("/passport/understand", { text, lang })
      update(id, { card })
    } catch {
      update(id, { failed: true })
    }
  }

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    setDraft("")
    if (passengerId) {
      void read(text)
      return
    }
    append({ kind: "me", id: nextId(), text, at: stamp() })
    const found = parseBooking(text)
    if (!found) {
      append({ kind: "error", id: nextId(), text: s.bookingFormat })
      return
    }
    void findBooking(found.pnr, found.surname, true)
  }

  const confirm = async (id: string, card: Understood) => {
    if (!passengerId) return
    update(id, { status: "saving" })
    try {
      const out = await api.post<SaveOut>("/passport", { passenger_id: passengerId, lang, rules: card.rules, source: "chat" })
      update(id, { status: "saved" })
      append({ kind: "plan", id: nextId(), out })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["m17", "thread", passengerId] }),
        queryClient.invalidateQueries({ queryKey: ["m17", "booking", passengerId] }),
      ])
    } catch {
      update(id, { status: "open" })
      toast.error(pick(s.error, lang))
    }
  }

  const answer = async (questionId: string, option: RadarOption) => {
    setAnswered((prev) => new Map(prev).set(questionId, option.id))
    append({ kind: "me", id: nextId(), text: pick(option.label, lang), at: stamp() })
    try {
      await api.post("/radar/answer", { question_id: questionId, option_id: option.id })
      await queryClient.invalidateQueries({ queryKey: ["m17", "thread", passengerId] })
    } catch {
      setAnswered((prev) => {
        const next = new Map(prev)
        next.delete(questionId)
        return next
      })
      append({ kind: "error", id: nextId(), text: s.error })
    }
  }

  const share = async (person: BookingPerson) => {
    if (!booking.data) return
    const url = shareLink(window.location.origin, booking.data.pnr, person.surname)
    try {
      if (navigator.share) {
        await navigator.share({ title: pick(s.header, lang), url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success(pick(s.plan.copied, lang))
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return // the passenger closed the share sheet
      toast.error(url)
    }
  }

  const notes = useMemo(() => new Map(chatNotes(thread.data ?? []).map((n) => [n.id, n])), [thread.data])
  const replied = useMemo(() => answeredQuestions(thread.data ?? []), [thread.data])
  const me = booking.data?.passenger
  const flightNo = booking.data?.flight_no ?? flight?.flight_no ?? "JL740"
  const busy = items.some((i) => i.kind === "card" && !i.card && !i.failed)

  return (
    <div lang={lang} className="flex flex-col gap-3">
      <header className="sticky top-0 z-10 -mx-4 border-b border-line bg-mist px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight text-navy">
            {pick(s.header, lang)} · {flightNo}
          </h1>
          <LangSwitch value={lang} onChange={setLang} className="shrink-0" />
        </div>
        {me && (
          <p className="mt-0.5 truncate text-xs text-grey tabular">
            {me.name} · {me.seat} · <span className="code">{booking.data?.pnr}</span>
          </p>
        )}
      </header>

      <ol className="flex flex-col gap-3" aria-live="polite">
        {items.map((item) => {
          switch (item.kind) {
            case "welcome":
              return (
                <Bubble key={item.id} from="airline">
                  <p className="text-navy">{pick(s.welcome, lang)}</p>
                </Bubble>
              )
            case "ask-booking":
              return (
                <Bubble key={item.id} from="airline">
                  <p className="text-navy">{pick(s.askBooking, lang)}</p>
                </Bubble>
              )
            case "examples":
              return <ExamplesBubble key={item.id} lang={lang} disabled={!passengerId || busy} onPick={send} />
            case "found":
              return (
                <Bubble key={item.id} from="airline">
                  <p className="text-navy">{fill(s.found, lang, { name: item.name, seat: item.seat })}</p>
                </Bubble>
              )
            case "me":
              return (
                <Bubble key={item.id} from="me" at={item.at}>
                  <p>{item.text}</p>
                </Bubble>
              )
            case "error":
              return (
                <Bubble key={item.id} from="airline">
                  <Warning text={pick(item.text, lang)} />
                </Bubble>
              )
            case "card":
              return (
                <Bubble key={item.id} from="airline" wide>
                  {item.failed ? (
                    <Warning text={pick(s.error, lang)} />
                  ) : item.card ? (
                    <PassportCard
                      card={item.card}
                      lang={lang}
                      status={item.status}
                      onConfirm={() => item.card && void confirm(item.id, item.card)}
                      onEdit={(card) => update(item.id, { card })}
                    />
                  ) : (
                    <p className="animate-pulse text-sm text-grey">{pick(s.reading, lang)}</p>
                  )}
                </Bubble>
              )
            case "plan":
              return (
                <PlanBubble
                  key={item.id}
                  out={item.out}
                  lang={lang}
                  flightNo={flightNo}
                  flightDate={flight?.date ?? "2026-10-25"}
                  booking={booking.data}
                  onShare={(p) => void share(p)}
                />
              )
            case "note": {
              const note = notes.get(item.id)
              const questionId = String(note?.ref.question_id ?? "")
              return note ? (
                <NoteBubble
                  key={item.id}
                  note={note}
                  lang={lang}
                  answered={answered.get(questionId) ?? replied.get(questionId)}
                  onAnswer={(q, o) => void answer(q, o)}
                />
              ) : null
            }
          }
        })}
      </ol>
      <div ref={end} className="scroll-mb-28" />

      <Composer
        lang={lang}
        value={draft}
        onChange={setDraft}
        onSend={send}
        busy={busy}
        placeholder={pick(passengerId ? s.placeholder : s.placeholderBooking, lang)}
      />
    </div>
  )
}
