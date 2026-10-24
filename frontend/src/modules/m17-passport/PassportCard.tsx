// The airline's answer to "what do you eat": the food rules we read, grouped by how strict they are, each with the
// word it came from; the days that change the meal; the flex opt-in; "That's right" / "Change".
import { AlertTriangle, Ban, CalendarDays, CheckCircle2, HeartPulse, Moon, Sunset, ThumbsDown, type LucideIcon } from "lucide-react"
import { useState } from "react"

import { label } from "@/lib/rules"
import type { Lang, Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DietPicker } from "@/modules/m3-passenger/DietPicker"
import type { DietValue } from "@/modules/m3-passenger/types"
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, StatusChip } from "@/ui"

import { fill, pick, s } from "./i18n"
import { CHIP_GROUPS, canFlex, chipsFor, groupChips, pickerFromRules, rulesFromPicker, type ChipGroup } from "./thread"
import type { Chip, LabelledTimeRule, Understood } from "./types"

export type CardStatus = "open" | "saving" | "saved"

const GROUPS: Record<ChipGroup, { icon: LucideIcon; title: Text }> = {
  never: { icon: Ban, title: s.card.never },
  medical: { icon: HeartPulse, title: s.card.medical },
  prefer: { icon: ThumbsDown, title: s.card.prefer },
  allergy: { icon: AlertTriangle, title: s.card.allergy },
  fine: { icon: CheckCircle2, title: s.card.fine },
}

const TIME_ICONS: Record<LabelledTimeRule["kind"], LucideIcon> = {
  dates: CalendarDays,
  weekday: CalendarDays,
  daylight: Sunset,
  dawn_to_sunset: Moon,
}

export interface PassportCardProps {
  card: Understood
  lang: Lang
  status: CardStatus
  onConfirm: () => void
  onEdit: (next: Understood) => void
}

export function PassportCard({ card, lang, status, onConfirm, onEdit }: PassportCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DietValue>(() => pickerFromRules(card.rules, card.presets))
  const groups = groupChips(card.chips)
  const { rules } = card
  const empty = card.chips.length === 0 && card.time_rules.length === 0
  const locked = status !== "open"

  const openEditor = () => {
    setDraft(pickerFromRules(card.rules, card.presets))
    setEditing(true)
  }
  const applyEdit = () => {
    const next = rulesFromPicker(draft, rules)
    onEdit({ ...card, rules: next, chips: chipsFor(next, card.chips), unclear: [], presets: draft.presets })
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display font-semibold text-navy">{pick(s.card.title, lang)}</p>

      {empty && !rules.flex && <p className="text-sm text-grey">{pick(s.card.nothing, lang)}</p>}
      {empty && rules.flex && <p className="text-sm text-navy">{pick(s.card.noRules, lang)}</p>}

      {CHIP_GROUPS.filter((g) => groups[g].length > 0).map((g) => (
        <ChipSection key={g} group={g} chips={groups[g]} lang={lang} />
      ))}

      {card.time_rules.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-grey uppercase">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {pick(s.card.days, lang)}
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {card.time_rules.map((rule) => (
              <TimeRuleRow key={rule.id} rule={rule} lang={lang} />
            ))}
          </ul>
        </section>
      )}

      {canFlex(rules) && (rules.forbid.length > 0 || rules.flex) && (
        <label className="flex min-h-11 items-start gap-3 rounded-md border border-line bg-ice/50 p-3">
          <Checkbox
            className="mt-0.5"
            checked={rules.flex}
            disabled={locked}
            onCheckedChange={(v) => onEdit({ ...card, rules: { ...rules, flex: v === true } })}
          />
          <span className="text-sm">
            <span className="font-medium text-navy">{pick(s.card.flexTitle, lang)}</span>
            <span className="mt-0.5 block text-grey">{pick(s.card.flexBody, lang)}</span>
          </span>
        </label>
      )}

      {card.unclear.length > 0 && (
        <p className="flex gap-1.5 text-sm text-warn">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {fill(s.card.unclear, lang, { words: card.unclear.join(", ") })}
        </p>
      )}

      {status === "saved" ? (
        <StatusChip status="safe" label={pick(s.card.saved, lang)} />
      ) : (
        <div className="flex gap-2">
          <Button size="lg" className="min-h-11 flex-1" disabled={locked || (empty && !rules.flex)} onClick={onConfirm}>
            {status === "saving" ? pick(s.card.saving, lang) : pick(s.card.right, lang)}
          </Button>
          <Button size="lg" variant="outline" className="min-h-11" disabled={locked} onClick={openEditor}>
            {pick(s.card.change, lang)}
          </Button>
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-line px-5 pt-5 pb-3 text-left">
            <DialogTitle className="text-navy">{pick(s.card.editTitle, lang)}</DialogTitle>
            <DialogDescription>{pick(s.card.editSub, lang)}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-5 py-4">
            <DietPicker value={draft} onChange={setDraft} lang={lang} />
          </div>
          <div className="border-t border-line px-5 py-3">
            <Button size="lg" className="min-h-11 w-full" onClick={applyEdit}>
              {pick(s.card.editDone, lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChipSection({ group, chips, lang }: { group: ChipGroup; chips: Chip[]; lang: Lang }) {
  const { icon: Icon, title } = GROUPS[group]
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-grey uppercase">
        <Icon aria-hidden="true" className="size-3.5" />
        {pick(title, lang)}
      </h3>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li key={`${chip.kind}-${chip.tag}`} className="rounded-md border border-line bg-card px-2.5 py-1">
            <span className="text-sm font-medium text-navy">{label(chip.tag, lang)}</span>
            <span className="block text-[11px] leading-tight text-grey">
              {chip.via || pick(s.card.youChose, lang)}
              {chip.source === "model" && ` · ${pick(s.card.model, lang)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TimeRuleRow({ rule, lang }: { rule: LabelledTimeRule; lang: Lang }) {
  const Icon = TIME_ICONS[rule.kind]
  return (
    <li className={cn("flex gap-2 rounded-md border border-line bg-card px-2.5 py-1.5")}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky" />
      <span className="text-sm">
        <span className="font-medium text-navy">{pick(rule.label, lang)}</span>
        {rule.confirm && <span className="text-grey"> · {pick(s.card.willAsk, lang)}</span>}
        {rule.via && <span className="block text-[11px] leading-tight text-grey">{rule.via}</span>}
      </span>
    </li>
  )
}
