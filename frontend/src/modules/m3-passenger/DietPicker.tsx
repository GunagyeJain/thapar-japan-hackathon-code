// Three plain questions: "Do you follow a diet?" (optional shortcut), "What can't you eat?", "Any food allergies?".
// Every choice is the same kind of tile with a tick, so it's obvious what's selected.
// Also used by the late-request desk (m6) and group upload (m14), so it only edits `value`.
import { Check } from "lucide-react"
import { useState, type ReactNode } from "react"

import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"

import { dietPresets, foodGroups, isAllergenOn, isGroupOn, pickerGroups, toggleAllergen, toggleGroup, togglePreset } from "./diet"
import { breakable, fill, jaWrap, pick, s } from "./i18n"
import type { DietValue } from "./types"

export interface DietPickerProps {
  value: DietValue
  onChange: (value: DietValue) => void
  lang: Lang
  /** Tighter spacing for desktop desks. */
  compact?: boolean
}

export function DietPicker({ value, onChange, lang, compact = false }: DietPickerProps) {
  const [allAllergens, setAllAllergens] = useState(false)
  const allergens = pickerGroups("allergen")
  const shownAllergens = allAllergens ? allergens : allergens.filter((g) => g.jp_class === "mandatory" || isAllergenOn(value, g))

  return (
    <div lang={lang} className={cn("flex flex-col", compact ? "gap-4" : "gap-7")}>
      <Question id="dp-diet" title={pick(s.picker.dietTitle, lang)} sub={pick(s.picker.dietSub, lang)} compact={compact}>
        {dietPresets().map((p) => (
          <Tile
            key={p.id}
            label={pick(p.labels, lang)}
            on={value.presets.includes(p.id)}
            onToggle={() => onChange(togglePreset(value, p))}
            lang={lang}
            compact={compact}
          />
        ))}
      </Question>

      <Question id="dp-foods" title={pick(s.picker.foodsTitle, lang)} sub={pick(s.picker.foodsSub, lang)} compact={compact}>
        {foodGroups().map((g) => (
          <Tile key={g.id} label={pick(g.labels, lang)} on={isGroupOn(value, g)} onToggle={() => onChange(toggleGroup(value, g))} lang={lang} compact={compact} />
        ))}
      </Question>

      <Question id="dp-allergens" title={pick(s.picker.allergensTitle, lang)} sub={pick(s.picker.allergensSub, lang)} compact={compact}>
        {shownAllergens.map((g) => (
          <Tile key={g.id} label={pick(g.labels, lang)} on={isAllergenOn(value, g)} onToggle={() => onChange(toggleAllergen(value, g))} lang={lang} compact={compact} />
        ))}
      </Question>
      <button
        type="button"
        onClick={() => setAllAllergens((v) => !v)}
        className="-mt-4 min-h-11 self-start text-sm font-medium text-blue underline-offset-4 hover:underline"
      >
        {allAllergens ? pick(s.picker.fewerAllergens, lang) : fill(s.picker.allAllergens, lang, { n: allergens.length })}
      </button>
    </div>
  )
}

function Question({ id, title, sub, compact, children }: { id: string; title: string; sub: string; compact: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className={cn("font-display font-semibold text-navy", compact ? "text-sm" : "text-lg")}>
        {title}
      </h3>
      <p className={cn("mb-2.5 text-grey", compact ? "text-xs" : "text-sm")}>{sub}</p>
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2")}>{children}</div>
    </section>
  )
}

function Tile({ label, on, onToggle, lang, compact }: { label: string; on: boolean; onToggle: () => void; lang: Lang; compact: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3 text-left leading-tight transition-colors duration-150",
        compact ? "min-h-9 py-1 text-sm" : "min-h-12 py-2 text-base",
        on ? "border-blue bg-ice font-medium text-navy" : "border-line bg-card text-foreground hover:border-sky",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150",
          on ? "border-blue bg-blue text-primary-foreground" : "border-line bg-card",
        )}
      >
        {on && <Check className="size-3.5" />}
      </span>
      <span className={cn(lang === "ja" && jaWrap)}>{breakable(label, lang)}</span>
    </button>
  )
}
