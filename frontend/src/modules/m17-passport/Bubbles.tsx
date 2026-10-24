// Message bubbles for /chat: the airline on the left, the passenger on the right. Presentational only.
import { AlertTriangle, Share2 } from "lucide-react"
import type { ReactNode } from "react"

import { fmtTime } from "@/lib/format"
import type { Lang, Notification, Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { TrayLabel } from "@/modules/m3-passenger/parts"
import { Button, StatusChip } from "@/ui"

import { dayLabel, fill, pick, s } from "./i18n"
import { radarQuestion } from "./thread"
import type { BookingOut, BookingPerson, RadarOption, SaveOut } from "./types"

export function Bubble({ from, at, children, wide }: { from: "airline" | "me"; at?: string | null; children: ReactNode; wide?: boolean }) {
  return (
    <li className={cn("flex animate-in fade-in-0 duration-200", from === "me" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-[10px] border px-3 py-2",
          wide ? "w-full max-w-[92%]" : "max-w-[85%]",
          from === "me" ? "rounded-br-sm border-blue/25 bg-ice text-navy" : "rounded-bl-sm border-line bg-card",
        )}
      >
        {children}
        {at && <p className="mt-1 text-right text-[11px] text-grey tabular">{fmtTime(at, "IST")}</p>}
      </div>
    </li>
  )
}

export function Warning({ text }: { text: string }) {
  return (
    <p role="alert" className="flex gap-1.5 text-sm text-warn">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  )
}

export function ExamplesBubble({ lang, disabled, onPick }: { lang: Lang; disabled: boolean; onPick: (text: string) => void }) {
  return (
    <Bubble from="airline" wide>
      <p className="text-sm text-grey">{pick(s.tryThese, lang)}</p>
      <div className="mt-2 flex flex-col gap-2">
        {s.examples.map((ex) => (
          <Button
            key={ex.text}
            variant="outline"
            disabled={disabled}
            onClick={() => onPick(ex.text)}
            className="h-auto min-h-11 justify-between gap-3 py-2 text-left whitespace-normal"
          >
            <span className="text-base text-navy">{ex.text}</span>
            <span className="shrink-0 text-[11px] text-grey">{pick(ex.tag, lang)}</span>
          </Button>
        ))}
      </div>
    </Bubble>
  )
}

interface NoteBubbleProps {
  note: Notification
  lang: Lang
  answered: string | undefined
  onAnswer: (questionId: string, option: RadarOption) => void
}

/** A message the airline sent on the WhatsApp channel: a Radar question with its two answers, or a plain message. */
export function NoteBubble({ note, lang, answered, onAnswer }: NoteBubbleProps) {
  const question = radarQuestion(note)
  const ref = note.ref as { kind?: string; text?: Text }
  if (question) {
    const text = question.question ? pick(question.question, lang) : note.body
    return (
      <Bubble from="airline" at={note.at} wide>
        <p className="text-[11px] font-medium tracking-wider text-grey uppercase">{note.title}</p>
        <p className="mt-0.5 text-navy">{text}</p>
        <div className="mt-2.5 flex flex-col gap-2">
          {question.options.map((option, i) => (
            <Button
              key={option.id}
              size="lg"
              variant={answered === option.id ? "default" : "outline"}
              disabled={answered !== undefined}
              aria-pressed={answered === option.id}
              onClick={() => onAnswer(question.question_id, option)}
              className="h-auto min-h-11 justify-start py-2 text-left whitespace-normal disabled:opacity-100"
            >
              <span className="tabular">{i + 1}</span> {pick(option.label, lang)}
            </Button>
          ))}
        </div>
        {answered !== undefined && <StatusChip className="mt-2" size="sm" status="info" label={pick(s.radar.answered, lang)} />}
      </Bubble>
    )
  }
  const body = ref.kind === "radar_answer" && ref.text ? pick(ref.text, lang) : note.body
  return (
    <Bubble from="airline" at={note.at}>
      <p className="text-[11px] font-medium tracking-wider text-grey uppercase">{note.title}</p>
      <p className="mt-0.5 text-navy">{body}</p>
    </Bubble>
  )
}

interface PlanBubbleProps {
  out: SaveOut
  lang: Lang
  flightNo: string
  flightDate: string
  booking: BookingOut | undefined
  onShare: (person: BookingPerson) => void
}

/** What the passport means for this flight: the special meal ordered, the main held, or nothing needed. */
export function PlanBubble({ out, lang, flightNo, flightDate, booking, onShare }: PlanBubbleProps) {
  const { plan, promise } = out
  const vars = { flight: flightNo, date: dayLabel(flightDate, lang) }
  const meal = plan.code ? `${plan.code}${plan.kitchen_note ? ` + ${plan.kitchen_note}` : ""}` : ""
  const others = booking?.passengers ?? []
  const me = booking?.passenger
  return (
    <Bubble from="airline" wide>
      {plan.code ? (
        <p className="text-navy">{fill(s.plan.code, lang, { ...vars, code: meal })}</p>
      ) : plan.main_pick_name ? (
        <p className="text-navy">{fill(s.plan.main, lang, { ...vars, dish: pick(plan.main_pick_name, lang) })}</p>
      ) : (
        <p className="text-navy">{fill(s.plan.none, lang, vars)}</p>
      )}
      {plan.code && promise && (
        <div className="mt-2.5">
          <p className="mb-1 text-xs font-medium text-grey">{pick(s.plan.trayLabel, lang)}</p>
          <TrayLabel
            mark={pick(promise.label_mark, lang)}
            code={promise.code}
            note={promise.kitchen_note}
            name={me ? me.name : ""}
            pnr={booking?.pnr}
            lang={lang}
          />
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-3 border-t border-dashed border-line pt-2.5">
          <p className="text-sm text-navy">{pick(others.some((p) => !p.has_passport) ? s.plan.others : s.plan.allTold, lang)}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {others.map((p) => (
              <li key={p.passenger_id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                  <span className="font-medium text-navy">{p.name}</span> <span className="text-grey tabular">{p.seat}</span>
                </span>
                {p.has_passport ? (
                  <StatusChip size="sm" status="safe" label={pick(s.plan.told, lang)} />
                ) : (
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => onShare(p)}>
                    <Share2 /> {pick(s.plan.sendLink, lang)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Bubble>
  )
}
