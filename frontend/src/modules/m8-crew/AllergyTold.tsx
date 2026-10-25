// "Add allergy" on the copilot seat card: the crew tick what the passenger says they're allergic to, and every dish
// on board for that seat is checked offline. Kept on this tablet, per flight and demo run.
import { AlertTriangle, HelpCircle, ShieldAlert, XCircle } from "lucide-react"
import { useMemo, useState } from "react"

import type { CrewPackage } from "@/lib/offline/types"
import type { Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, StatusChip, type Status } from "@/ui"
import { allergenNames, allergenTags, allergyRows, type AllergyRow, type AllergyState, type ItemGroup } from "@/modules/m8-crew/allergy"
import { Bi } from "@/modules/m8-crew/Bi"
import { ALLERGY, type Bilingual } from "@/modules/m8-crew/i18n"
import { useCrewLang, useDish, useSay } from "@/modules/m8-crew/lang"

const STATE_LOOK: Record<AllergyState, { status: Status; icon: typeof XCircle }> = {
  contains: { status: "unsafe", icon: XCircle },
  not_listed: { status: "warn", icon: AlertTriangle },
  unknown: { status: "neutral", icon: HelpCircle },
}
const GROUPS: readonly ItemGroup[] = ["sealed", "spare", "main"]
const GROUP_WORD: Record<ItemGroup, Bilingual> = { sealed: ALLERGY.groupSealed, spare: ALLERGY.groupSpare, main: ALLERGY.groupMain }

type Told = Record<string, string[]>
const storeKey = (pkg: CrewPackage): string => `thalibento.crew.allergies.${pkg.flight.id}.${pkg.seed_epoch}`

function readTold(pkg: CrewPackage): Told {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storeKey(pkg)) ?? "{}")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Told) : {}
  } catch {
    return {} // unreadable or blocked storage: start empty
  }
}

function writeTold(pkg: CrewPackage, told: Told): void {
  try {
    localStorage.setItem(storeKey(pkg), JSON.stringify(told))
  } catch {
    // Blocked or full storage: the list still works until the page reloads.
  }
}

export interface AllergyToldProps {
  pkg: CrewPackage
  pax: Passenger
}

export function AllergyTold({ pkg, pax }: AllergyToldProps) {
  const say = useSay()
  const all = useMemo(() => allergenTags(), [])
  const [told, setTold] = useState<Told>(() => readTold(pkg))
  const [open, setOpen] = useState(false)
  const saved = told[pax.id]
  const mine = Array.isArray(saved) ? saved.filter((t) => all.includes(t)) : []
  const toggle = (tag: string) => {
    const next = { ...told, [pax.id]: mine.includes(tag) ? mine.filter((t) => t !== tag) : [...mine, tag] }
    writeTold(pkg, next)
    setTold(next)
  }
  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="outline" size="lg" className="h-12 text-base" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ShieldAlert aria-hidden="true" /> {say(ALLERGY.add)}
        </Button>
        {mine.length > 0 && <Bi text={ALLERGY.saved} size="sm" className="text-muted-foreground" />}
      </div>
      {open && <Picker all={all} mine={mine} onToggle={toggle} />}
      {mine.length > 0 && <Checked rows={allergyRows(pkg, pax, mine)} allergens={mine} />}
    </div>
  )
}

function Picker({ all, mine, onToggle }: { all: string[]; mine: string[]; onToggle: (tag: string) => void }) {
  const mode = useCrewLang()
  return (
    <div role="group" aria-label={ALLERGY.title.en} className="flex flex-wrap gap-1.5">
      {all.map((tag) => {
        const on = mine.includes(tag)
        const name = allergenNames([tag])
        return (
          <Button key={tag} size="sm" variant={on ? "secondary" : "outline"} aria-pressed={on} className={cn("h-10 px-3 text-sm", on && "ring-1 ring-unsafe")} onClick={() => onToggle(tag)}>
            {mode === "en" ? name.en : mode === "ja" ? name.ja : `${name.ja} · ${name.en}`}
          </Button>
        )
      })}
    </div>
  )
}

function Checked({ rows, allergens }: { rows: AllergyRow[]; allergens: string[] }) {
  const say = useSay()
  const names = allergenNames(allergens)
  const noneListed = !rows.some((r) => r.state === "not_listed")
  return (
    <section aria-label={say(ALLERGY.title)} className="flex flex-col gap-3">
      <Bi text={{ ja: `${ALLERGY.title.ja}：${names.ja}`, en: `${ALLERGY.title.en}: ${names.en}` }} size="sm" className="font-semibold text-muted-foreground" />
      {noneListed && <StatusChip status="unsafe" icon={ShieldAlert} label={say(ALLERGY.nothingListed(names))} className="h-auto self-start py-2 whitespace-normal" />}
      {GROUPS.map((group) => {
        const inGroup = rows.filter((r) => r.group === group)
        if (inGroup.length === 0) return null
        return (
          <div key={group} className="flex flex-col gap-1.5">
            <Bi text={GROUP_WORD[group]} size="sm" className="font-semibold" />
            <ul className="flex flex-col gap-1.5">
              {inGroup.map((r) => (
                <Row key={`${r.own}:${r.spec_id}`} row={r} names={names} />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function Row({ row, names }: { row: AllergyRow; names: Bilingual }) {
  const say = useSay()
  const dish = useDish()
  const look = STATE_LOOK[row.state]
  const verdict = row.state === "contains" ? ALLERGY.contains(allergenNames(row.found)) : row.state === "not_listed" ? ALLERGY.notListed(names) : ALLERGY.unknown
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="code rounded bg-muted px-1.5 py-0.5 text-sm font-semibold">{row.spec?.code ?? row.spec_id.replace(/^SPEC-/, "")}</span>
        <span className="min-w-0 flex-1 font-medium [word-break:keep-all] [overflow-wrap:anywhere]">{row.spec ? dish(row.spec.name) : say(ALLERGY.unknownDish)}</span>
        <span className="text-sm text-muted-foreground tabular">×{row.count}</span>
        {row.own && <span className="rounded-md bg-secondary px-2 py-0.5 text-sm">{say(ALLERGY.ownTray)}</span>}
      </div>
      <StatusChip size="sm" status={look.status} icon={look.icon} label={say(verdict)} className="h-auto self-start py-1 whitespace-normal" />
    </li>
  )
}
