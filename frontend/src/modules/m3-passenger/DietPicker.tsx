// "What don't you eat?": one-tap presets, then the boxes they tick, then allergies.
// Also used by the late-request desk (m6) and group upload (m14), so it only edits `value`.
import { Check } from "lucide-react"
import { useState } from "react"

import type { PickerGroup } from "@/lib/rules"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/ui"

import { isAllergenOn, isGroupOn, pickerGroups, presets, toggleAllergen, toggleGroup, togglePreset } from "./diet"
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
  const shownAllergens = allAllergens
    ? allergens
    : allergens.filter((g) => g.jp_class === "mandatory" || isAllergenOn(value, g))

  return (
    <div lang={lang} className={cn("flex flex-col", compact ? "gap-4" : "gap-6")}>
      <section aria-labelledby="dp-presets">
        <h3 id="dp-presets" className="mb-2 text-sm font-medium text-grey">
          {pick(s.picker.presets, lang)}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {presets().map((p) => {
            const on = value.presets.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(togglePreset(value, p))}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-left leading-tight font-medium transition-colors duration-150",
                  compact ? "min-h-9 text-sm" : "min-h-11 text-base",
                  on ? "border-blue bg-ice text-navy" : "border-line bg-card text-foreground hover:border-sky",
                )}
              >
                {on && <Check aria-hidden="true" className="size-4 shrink-0 text-blue" />}
                <span className={cn(lang === "ja" && jaWrap)}>{breakable(pick(p.labels, lang), lang)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <GroupList
        id="dp-groups"
        title={pick(s.picker.groups, lang)}
        groups={pickerGroups("diet")}
        isOn={(g) => isGroupOn(value, g)}
        onToggle={(g) => onChange(toggleGroup(value, g))}
        lang={lang}
        compact={compact}
      />

      <div>
        <GroupList
          id="dp-allergens"
          title={pick(s.picker.allergens, lang)}
          groups={shownAllergens}
          isOn={(g) => isAllergenOn(value, g)}
          onToggle={(g) => onChange(toggleAllergen(value, g))}
          lang={lang}
          compact={compact}
        />
        <button
          type="button"
          onClick={() => setAllAllergens((v) => !v)}
          className="mt-2 min-h-11 text-sm font-medium text-blue underline-offset-4 hover:underline"
        >
          {allAllergens ? pick(s.picker.fewerAllergens, lang) : fill(s.picker.allAllergens, lang, { n: allergens.length })}
        </button>
      </div>
    </div>
  )
}

interface GroupListProps {
  id: string
  title: string
  groups: PickerGroup[]
  isOn: (g: PickerGroup) => boolean
  onToggle: (g: PickerGroup) => void
  lang: Lang
  compact: boolean
}

function GroupList({ id, title, groups, isOn, onToggle, lang, compact }: GroupListProps) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 text-sm font-medium text-grey">
        {title}
      </h3>
      <ul className={cn("grid gap-x-3 rounded-[10px] border border-line bg-card px-3", compact ? "grid-cols-3" : "grid-cols-2")}>
        {groups.map((g) => {
          const boxId = `${id}-${g.id}`
          return (
            <li key={g.id}>
              <label htmlFor={boxId} className={cn("flex cursor-pointer items-center gap-3", compact ? "min-h-9 text-sm" : "min-h-11")}>
                <Checkbox id={boxId} checked={isOn(g)} onCheckedChange={() => onToggle(g)} className="size-5" />
                <span className={cn("leading-tight", lang === "ja" && jaWrap)}>{breakable(pick(g.labels, lang), lang)}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
