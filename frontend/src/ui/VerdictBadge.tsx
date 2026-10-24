// SAFE / UNSAFE / NEEDS_HUMAN with the rules that fired, one tap away.
import { t } from "@/lib/i18n"
import type { Fired, Lang, Verdict } from "@/lib/types"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { StatusChip, type Status } from "@/ui/StatusChip"

const VERDICTS: Record<Verdict, { status: Status; label: Record<Lang, string> }> = {
  SAFE: { status: "safe", label: { en: "Safe", hi: "सुरक्षित", ja: "安全" } },
  UNSAFE: { status: "unsafe", label: { en: "Unsafe", hi: "असुरक्षित", ja: "不適合" } },
  NEEDS_HUMAN: { status: "warn", label: { en: "Needs a check", hi: "जाँच ज़रूरी", ja: "要確認" } },
}

export interface VerdictBadgeProps {
  verdict: Verdict
  fired?: Fired[]
  lang?: Lang
  size?: "sm" | "md" | "lg"
}

export function VerdictBadge({ verdict, fired = [], lang = "en", size = "md" }: VerdictBadgeProps) {
  const v = VERDICTS[verdict]
  const chip = <StatusChip status={v.status} label={v.label[lang]} size={size} />
  if (fired.length === 0) return chip

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={`${v.label.en}: ${fired.length} rule${fired.length > 1 ? "s" : ""} fired`}
      >
        <span className="inline-flex items-center gap-1.5">
          {chip}
          <span className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
            {fired.length} rule{fired.length > 1 ? "s" : ""}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent>
        <div className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Why</div>
        <ul className="flex flex-col gap-2.5">
          {fired.map((f) => (
            <li key={`${f.rule_id}-${f.tag}`} className="flex flex-col gap-0.5">
              <span className="font-medium">{t(f.message, lang)}</span>
              <span className="code text-xs text-muted-foreground">{f.via}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
