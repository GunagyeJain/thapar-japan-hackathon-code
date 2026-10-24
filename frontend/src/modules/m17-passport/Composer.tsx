// The input bar pinned to the bottom of the phone: speech language, mic (only where the browser can listen),
// the text box and send.
import { Mic, MicOff, SendHorizontal } from "lucide-react"
import { useState, type FormEvent } from "react"

import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@/ui"

import { pick, s, SPEECH_LANGS } from "./i18n"
import { useSpeech } from "./speech"

export interface ComposerProps {
  lang: Lang
  value: string
  onChange: (text: string) => void
  onSend: (text: string) => void
  placeholder: string
  busy: boolean
}

const DEFAULT_SPEECH: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", ja: "ja-JP" }

export function Composer({ lang, value, onChange, onSend, placeholder, busy }: ComposerProps) {
  const [speechLang, setSpeechLang] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const speech = useSpeech(onChange)
  const spoken = speechLang ?? DEFAULT_SPEECH[lang]
  const short = SPEECH_LANGS.find((l) => l.id === spoken)?.label ?? spoken

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (speech.listening) speech.stop()
    if (value.trim() && !busy) onSend(value)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-mist">
      <form onSubmit={submit} className="mx-auto flex max-w-md items-center gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {speech.supported && (
          <>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" className="h-11 min-w-11 px-2 text-xs text-grey" aria-label={pick(s.speechLang, lang)}>
                  {short}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1.5" side="top">
                <p className="px-2 py-1 text-xs text-grey">{pick(s.speechLang, lang)}</p>
                {SPEECH_LANGS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSpeechLang(l.id)
                      setPickerOpen(false)
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between rounded-md px-2 text-left text-sm transition-colors duration-150 hover:bg-ice",
                      l.id === spoken && "bg-ice font-medium text-navy",
                    )}
                  >
                    {l.label}
                    <span className="code text-xs text-grey">{l.id}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant={speech.listening ? "default" : "outline"}
              size="icon"
              className="size-11 shrink-0"
              aria-pressed={speech.listening}
              aria-label={pick(speech.listening ? s.stop : s.speak, lang)}
              onClick={() => (speech.listening ? speech.stop() : speech.start(spoken))}
            >
              {speech.listening ? <MicOff /> : <Mic />}
            </Button>
          </>
        )}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={speech.listening ? pick(s.listening, lang) : placeholder}
          maxLength={500}
          aria-label={placeholder}
          className="h-11 flex-1 text-base"
          autoComplete="off"
          enterKeyHint="send"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!value.trim() || busy} aria-label={pick(s.send, lang)}>
          <SendHorizontal />
        </Button>
      </form>
    </div>
  )
}
