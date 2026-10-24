// Crew display language: Japanese + English (default), Japanese only, or English only. Saved on the tablet.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { Bilingual } from "@/modules/m8-crew/i18n"

export type CrewLang = "both" | "ja" | "en"

const KEY = "thalibento.crew-lang"
const CHOICES: { id: CrewLang; label: string }[] = [
  { id: "both", label: "日本語 + EN" },
  { id: "ja", label: "日本語" },
  { id: "en", label: "English" },
]

const Ctx = createContext<CrewLang>("both")

export function CrewLangProvider({ value, children }: { value: CrewLang; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCrewLang(): CrewLang {
  return useContext(Ctx)
}

export function say(text: Bilingual, mode: CrewLang): string {
  if (mode === "ja") return text.ja
  if (mode === "en") return text.en
  return text.ja === text.en ? text.en : `${text.ja} · ${text.en}`
}

/** say() bound to the current language, for strings in buttons and chips. */
export function useSay(): (text: Bilingual) => string {
  const mode = useCrewLang()
  return useCallback((text: Bilingual) => say(text, mode), [mode])
}

function stored(): CrewLang {
  try {
    const v = localStorage.getItem(KEY)
    return v === "ja" || v === "en" || v === "both" ? v : "both"
  } catch {
    return "both"
  }
}

export function useStoredCrewLang(): [CrewLang, (lang: CrewLang) => void] {
  const [lang, setLang] = useState<CrewLang>(stored)
  const set = useCallback((next: CrewLang) => {
    setLang(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // private mode: the choice lasts until reload
    }
  }, [])
  return [lang, set]
}

export function CrewLangSwitch({ value, onChange, className }: { value: CrewLang; onChange: (lang: CrewLang) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="表示言語 · Language" className={cn("inline-flex rounded-lg bg-muted p-1", className)}>
      {CHOICES.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "h-11 min-w-20 rounded-md px-3 text-sm font-medium transition-colors duration-150",
            value === c.id ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

type DishName = { en: string; ja?: string } | undefined

export function dishName(name: DishName, mode: CrewLang, short = false): string {
  if (!name) return ""
  const ja = name.ja ?? name.en
  if (mode === "ja") return ja
  if (mode === "en") return name.en
  return short ? ja : `${ja} · ${name.en}`
}

/** A dish name in the chosen language; `short` keeps only Japanese when both are shown (English sits on the next line). */
export function useDish(): (name: DishName, short?: boolean) => string {
  const mode = useCrewLang()
  return useCallback((name: DishName, short = false) => dishName(name, mode, short), [mode])
}
