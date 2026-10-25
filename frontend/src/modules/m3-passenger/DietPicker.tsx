// Three plain questions: "Do you follow a diet?" (optional shortcut), "What can't you eat?", "Any food allergies?"
// (Yes opens the full allergen list, No clears it). Every choice is the same kind of tile with a tick, so it's obvious what's selected.
// Also used by the late-request desk (m6) and group upload (m14), so it only edits `value`.
import { Check } from "lucide-react"
import { useState, type ReactNode } from "react"

import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"

import { dietPresets, foodGroups, isAllergenOn, isGroupOn, pickerGroups, toggleAllergen, toggleGroup, togglePreset } from "./diet"
import { breakable, jaWrap, pick, s } from "./i18n"
import type { DietValue } from "./types"

export interface DietPickerProps {
  value: DietValue
  onChange: (value: DietValue) => void
  lang: Lang
  /** Tighter spacing for desktop desks. */
  compact?: boolean
}

export function DietPicker({ value, onChange, lang, compact = false }: DietPickerProps) {
  // null until answered; a value that already has allergies counts as Yes.
  const [hasAllergies, setHasAllergies] = useState<boolean | null>(null)
  const allergens = pickerGroups("allergen")
  const listOpen = hasAllergies === true || (value.allergens ?? []).length > 0
  const sayNo = () => {
    setHasAllergies(false)
    onChange({ ...value, allergens: [] })
  }

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

      <Question id="dp-foods" title={pick(s.picker.foodsTitle, lang)} compact={compact}>
        {foodGroups().map((g) => (
          <Tile key={g.id} label={pick(g.labels, lang)} on={isGroupOn(value, g)} onToggle={() => onChange(toggleGroup(value, g))} lang={lang} compact={compact} />
        ))}
      </Question>

      <Question id="dp-allergens" title={pick(s.picker.allergensTitle, lang)} compact={compact} radio>
        <Tile radio label={pick(s.picker.yes, lang)} on={listOpen} onToggle={() => setHasAllergies(true)} lang={lang} compact={compact} />
        <Tile radio label={pick(s.picker.no, lang)} on={!listOpen && hasAllergies === false} onToggle={sayNo} lang={lang} compact={compact} />
      </Question>
      {listOpen && (
        <div role="group" aria-label={pick(s.picker.allergens, lang)} className={cn("grid gap-2", compact ? "-mt-2 grid-cols-3" : "-mt-4 grid-cols-2")}>
          {allergens.map((g) => (
            <Tile key={g.id} label={pick(g.labels, lang)} on={isAllergenOn(value, g)} onToggle={() => onChange(toggleAllergen(value, g))} lang={lang} compact={compact} />
          ))}
        </div>
      )}
    </div>
  )
}

interface QuestionProps {
  id: string
  title: string
  sub?: string
  compact: boolean
  /** One answer only (Yes / No). */
  radio?: boolean
  children: ReactNode
}

function Question({ id, title, sub, compact, radio = false, children }: QuestionProps) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className={cn("font-display font-semibold text-navy", compact ? "text-sm" : "text-lg", !sub && "mb-2.5")}>
        {title}
      </h3>
      {sub && <p className={cn("mb-2.5 text-grey", compact ? "text-xs" : "text-sm")}>{sub}</p>}
      <div role={radio ? "radiogroup" : undefined} aria-labelledby={radio ? id : undefined} className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2")}>
        {children}
      </div>
    </section>
  )
}

interface TileProps {
  label: string
  on: boolean
  onToggle: () => void
  lang: Lang
  compact: boolean
  radio?: boolean
}

function Tile({ label, on, onToggle, lang, compact, radio = false }: TileProps) {
  return (
    <button
      type="button"
      role={radio ? "radio" : "checkbox"}
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
          radio && "rounded-full",
          on ? "border-blue bg-blue text-primary-foreground" : "border-line bg-card",
        )}
      >
        {on && <Check className="size-3.5" />}
      </span>
      <span className={cn(lang === "ja" && jaWrap)}>{breakable(label, lang)}</span>
    </button>
  )
}
