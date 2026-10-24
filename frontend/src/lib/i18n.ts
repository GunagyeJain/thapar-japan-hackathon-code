// Text shown to people is {en, hi?, ja?}; English is always present. Module strings live in each module's i18n.ts.
import type { Lang, Text } from "@/lib/types"

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "ja", label: "日本語" },
]

/** Pick the string for `lang`, falling back to English. Accepts a plain string too. */
export function t(text: Text | string | null | undefined, lang: Lang = "en"): string {
  if (text == null) return ""
  if (typeof text === "string") return text
  return text[lang] ?? text.en
}
