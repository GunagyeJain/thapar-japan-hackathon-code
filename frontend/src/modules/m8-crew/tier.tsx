// Strictness tiers on the tablet: navy/blue/sky/ice shades + an icon + a word. Status colours stay for status.
import { Circle, Heart, Lock, Repeat, Stethoscope, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { COPILOT, type Bilingual } from "@/modules/m8-crew/i18n"
import { useSay } from "@/modules/m8-crew/lang"
import type { Tier } from "@/modules/m8-crew/copilot"

interface TierLook {
  icon: LucideIcon
  word: Bilingual
  why: Bilingual
  /** Chip and legend swatch. */
  tone: string
  /** English word the seat title starts with: the seat map colours seats by it (see TIER_MAP). */
  tag: string
}

export const TIER_LOOK: Record<Tier, TierLook> = {
  hard: { icon: Lock, word: COPILOT.tierHard, why: COPILOT.whyHard, tone: "border-blue bg-blue text-primary-foreground", tag: "Strict" },
  firm: { icon: Stethoscope, word: COPILOT.tierFirm, why: COPILOT.whyFirm, tone: "border-sky bg-sky text-navy", tag: "Medical" },
  soft: { icon: Heart, word: COPILOT.tierSoft, why: COPILOT.whySoft, tone: "border-sky bg-transparent text-sky", tag: "Preference" },
  none: { icon: Circle, word: COPILOT.tierNone, why: COPILOT.whyNone, tone: "border-transparent bg-muted text-muted-foreground", tag: "No rules" },
}

export const TIER_ORDER: Tier[] = ["hard", "firm", "soft", "none"]

/**
 * SeatMap colours seats by status only, so the copilot map recolours them by tier from the seat's title,
 * which starts with the tier's English word. Static classes, so Tailwind sees them.
 */
export const TIER_MAP = [
  "[&_button[title^='Strict']]:border-blue [&_button[title^='Strict']]:bg-blue [&_button[title^='Strict']]:text-primary-foreground",
  "[&_button[title^='Medical']]:border-sky [&_button[title^='Medical']]:bg-sky [&_button[title^='Medical']]:text-navy",
  "[&_button[title^='Preference']]:border-sky [&_button[title^='Preference']]:bg-transparent [&_button[title^='Preference']]:text-sky",
].join(" ")

export function TierChip({ tier, size = "md", className }: { tier: Tier; size?: "sm" | "md" | "lg"; className?: string }) {
  const say = useSay()
  const look = TIER_LOOK[tier]
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-md border font-medium whitespace-nowrap",
        size === "sm" && "h-6 gap-1 px-2 text-xs [&_svg]:size-3.5",
        size === "md" && "h-7 gap-1.5 px-2.5 text-sm [&_svg]:size-4",
        size === "lg" && "h-10 gap-2 px-3.5 text-base font-semibold [&_svg]:size-5",
        look.tone,
        className,
      )}
    >
      <look.icon aria-hidden="true" />
      {say(look.word)}
    </span>
  )
}

export function FlexChip({ size = "md" }: { size?: "sm" | "md" }) {
  const say = useSay()
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-md border border-dashed border-sky font-medium whitespace-nowrap text-sky",
        size === "sm" ? "h-6 gap-1 px-2 text-xs [&_svg]:size-3.5" : "h-7 gap-1.5 px-2.5 text-sm [&_svg]:size-4",
      )}
    >
      <Repeat aria-hidden="true" />
      {say(COPILOT.flex)}
    </span>
  )
}
