// The JAL-style frame: a text wordmark with a Demo tag (no logo here: this page has a booking form), the main nav,
// the language switch, and a one-line footer. Our own code and the tokens; nothing copied from jal.co.jp.
import { Search } from "lucide-react"
import { createContext, useContext, useState, type ReactNode } from "react"
import { Link } from "react-router"

import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LangSwitch } from "@/ui"

import { s } from "./i18n"

const LangContext = createContext<Lang>("en")
export const useJalLang = (): Lang => useContext(LangContext)

const NAV = [
  { text: s.navBook, to: "/jal", id: "book" },
  { text: s.navManage, to: "/jal?tab=manage", id: "manage" },
  { text: s.navExperience },
  { text: s.navTravel },
  { text: s.navMiles },
  { text: s.navHelp },
] as const

const LANG_KEY = "jal.lang"

function storedLang(): Lang {
  try {
    const v = sessionStorage.getItem(LANG_KEY)
    return v === "hi" || v === "ja" ? v : "en"
  } catch {
    return "en" // storage blocked: English
  }
}

export function JalShell({ active, children }: { active: "book" | "manage"; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang)
  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      sessionStorage.setItem(LANG_KEY, next)
    } catch {
      // storage blocked: the choice lasts until the next page
    }
  }
  return (
    <LangContext.Provider value={lang}>
      <div data-brand="jal" className="jal-site flex min-h-screen flex-col bg-background text-foreground">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pt-4 md:px-8">
            <Link to="/jal" className="flex items-center gap-2.5">
              <span className="font-display text-[22px] leading-none font-bold tracking-tight md:text-[26px]">JAPAN AIRLINES</span>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase">{t(s.demo, lang)}</span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <Search className="hidden size-5 text-muted-foreground sm:block" aria-hidden="true" />
              <LangSwitch value={lang} onChange={setLang} />
            </div>
          </div>
          <nav aria-label="Main" className="mx-auto max-w-6xl overflow-x-auto px-4 md:px-8">
            <ul className="flex gap-6 text-sm font-semibold whitespace-nowrap">
              {NAV.map((item) => {
                const on = "id" in item && item.id === active
                const cls = cn("block border-b-2 py-3", on ? "border-primary" : "border-transparent")
                return (
                  <li key={item.text.en}>
                    {"to" in item ? (
                      <Link to={item.to} className={cn(cls, "hover:border-line")}>
                        {t(item.text, lang)}
                      </Link>
                    ) : (
                      <span className={cn(cls, "text-muted-foreground")}>{t(item.text, lang)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-muted">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground md:px-8">{t(s.footer, lang)}</p>
        </footer>
      </div>
    </LangContext.Provider>
  )
}

/** JAL's rounded pill: red for the main action, white with a border for the rest. */
export function pill(main = true): string {
  return cn(
    "h-12 rounded-full px-7 text-base font-semibold",
    main ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border bg-card text-foreground hover:bg-muted",
  )
}
