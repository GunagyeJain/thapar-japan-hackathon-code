// Compact preset picker for the desk. Stand-in until m3's DietPicker ships; same {presets, forbid, allow} value.
import { combinePresets, loadRules } from "@/lib/rules"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { Checkbox } from "@/ui"

export interface DietValue {
  presets: string[]
  forbid: string[]
  allow: string[]
}

export const NO_DIET: DietValue = { presets: [], forbid: [], allow: [] }

interface DietChoiceProps {
  value: DietValue
  onChange: (value: DietValue) => void
  lang?: Lang
}

export function DietChoice({ value, onChange, lang = "en" }: DietChoiceProps) {
  const presets = [...loadRules().presets.values()]
  const toggle = (id: string, on: boolean) => {
    const picked = on ? [...value.presets, id] : value.presets.filter((p) => p !== id)
    onChange({ presets: picked, ...combinePresets(picked) })
  }
  return (
    <fieldset className="grid grid-cols-2 gap-x-4 gap-y-2">
      <legend className="pb-2 text-sm font-medium text-muted-foreground">Food rules</legend>
      {presets.map((p) => (
        <label key={p.id} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={value.presets.includes(p.id)} onCheckedChange={(on) => toggle(p.id, on === true)} />
          {t(p.labels, lang)}
        </label>
      ))}
    </fieldset>
  )
}
