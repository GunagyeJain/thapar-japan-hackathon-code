// The concept page's frame: the "not a Japan Airlines website" banner, a header in JAL's layout feel with a plain
// text wordmark (no logo, no crane), and the footer that says whose concept this is.
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge, LangSwitch } from "@/ui"

import { s, tr, type PageLang } from "./i18n"

/** The title stays pinned on every width; on a phone the explanation scrolls away under it. */
export function ConceptBanner({ lang }: { lang: PageLang }) {
  return (
    <>
      <div role="note" className="sticky top-0 z-40 bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2.5 md:px-8">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-snug">
            <strong className="font-semibold">{tr(s.bannerTitle, lang)}</strong>
            <span className="hidden text-white/80 md:inline"> · {tr(s.bannerBody, lang)}</span>
          </p>
        </div>
      </div>
      <p className="bg-navy px-4 pb-3 text-sm leading-snug text-white/80 md:hidden">{tr(s.bannerBody, lang)}</p>
    </>
  )
}

const NAV_ITEMS = [s.navBook, s.navManage, s.navCheckin, s.navStatus] as const

export function SiteHeader({ lang, onLang }: { lang: PageLang; onLang: (lang: PageLang) => void }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] leading-none font-bold tracking-tight text-navy">JAL</span>
          <span className="hidden text-xs font-medium text-grey sm:inline">Japan Airlines</span>
          <Badge variant="outline" className="ml-1 self-center text-grey">
            {tr(s.concept, lang)}
          </Badge>
        </div>
        {/* What JAL's header would carry; only Manage booking exists in this concept. */}
        <ul className="hidden flex-1 items-center gap-6 text-sm text-grey lg:flex" aria-label={tr(s.navManage, lang)}>
          {NAV_ITEMS.map((item) => (
            <li
              key={item.en}
              aria-current={item === s.navManage ? "page" : undefined}
              className={cn("py-1.5", item === s.navManage && "border-b-2 border-primary font-semibold text-navy")}
            >
              {tr(item, lang)}
            </li>
          ))}
        </ul>
        <LangSwitch value={lang} onChange={(l) => onLang(l === "ja" ? "ja" : "en")} langs={["en", "ja"]} className="ml-auto" />
      </div>
    </header>
  )
}

export function SiteFooter({ lang }: { lang: PageLang }) {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs leading-relaxed text-grey md:px-8">
        <p>{tr(s.footer1, lang)}</p>
        <p>{tr(s.footer2, lang)}</p>
      </div>
    </footer>
  )
}
