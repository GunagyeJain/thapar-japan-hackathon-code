import type { Lang } from "@/lib/types"

const LOCALE: Record<Lang, string> = { en: "en-GB", hi: "hi-IN", ja: "ja-JP" }

/** "Fri 20 Nov" in the page language, from an ISO date. */
export function dayLabel(date: string, lang: Lang): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short" })
}
