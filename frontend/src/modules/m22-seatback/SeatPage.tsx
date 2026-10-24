// /seat?seat=23C: the seatback display for one seat (16:9 in a navy bezel on a laptop, full screen on a phone).
// Without a seat it lists the seats that have a question, so the presenter can open one.
import { MonitorPlay } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useSearchParams } from "react-router"

import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Input } from "@/ui"

import { SEAT_RE, useSeatbackStatus } from "./api"
import { Frame, TopBar } from "./Frame"
import { SEAT } from "./i18n"
import { SeatScreen } from "./SeatScreen"
import { STATUS_LOOK } from "./status"

export function SeatPage() {
  const [params, setParams] = useSearchParams()
  const seat = (params.get("seat") ?? "").trim().toUpperCase()
  if (!SEAT_RE.test(seat)) return <SeatPicker onOpen={(s) => setParams({ seat: s })} />
  return <SeatScreen key={seat} seat={seat} />
}

function SeatPicker({ onOpen }: { onOpen: (seat: string) => void }) {
  const status = useSeatbackStatus()
  const [lang, setLang] = useState<Lang>("en")
  const [text, setText] = useState("")
  const seat = text.trim().toUpperCase()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (SEAT_RE.test(seat)) onOpen(seat)
  }
  const seats = status.data?.seats ?? []
  return (
    <Frame>
      <TopBar view={undefined} lang={lang} onLang={setLang} />
      <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-10">
        <div className="flex items-start gap-4">
          <MonitorPlay className="mt-1 size-8 shrink-0 text-sky" aria-hidden="true" />
          <div>
            <h1 className="font-display text-3xl font-bold">{t(SEAT.pickTitle, lang)}</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">{t(SEAT.pickBody, lang)}</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex max-w-sm gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t(SEAT.pickInput, lang)} aria-label={t(SEAT.pickInput, "en")} className="h-12 text-lg uppercase tabular" maxLength={3} />
          <Button type="submit" size="lg" className="h-12" disabled={!SEAT_RE.test(seat)}>
            {t(SEAT.open, lang)}
          </Button>
        </form>
        {seats.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
            {seats.map((s) => {
              const look = STATUS_LOOK[s.status]
              return (
                <li key={s.seat}>
                  <button type="button" onClick={() => onOpen(s.seat)} className="flex h-16 w-full flex-col items-start justify-center rounded-lg border bg-background px-3 text-left transition-colors duration-150 hover:border-sky">
                    <span className="font-display text-xl font-bold tabular">{s.seat}</span>
                    <span className={cn("inline-flex items-center gap-1 text-xs", look.tone)}>
                      <look.icon className="size-3.5" aria-hidden="true" /> {t(look.word, lang)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </Frame>
  )
}
