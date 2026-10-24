// EN / हिन्दी / 日本語 segmented control.
import { LANGS } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface LangSwitchProps {
  value: Lang
  onChange: (lang: Lang) => void
  langs?: Lang[]
  className?: string
}

export function LangSwitch({ value, onChange, langs = ["en", "hi", "ja"], className }: LangSwitchProps) {
  return (
    <div role="radiogroup" aria-label="Language" className={cn("inline-flex rounded-lg bg-muted p-[3px]", className)}>
      {LANGS.filter((l) => langs.includes(l.id)).map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          lang={l.id}
          onClick={() => onChange(l.id)}
          className={cn(
            "h-9 min-w-11 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150",
            value === l.id ? "bg-card text-foreground ring-1 ring-border" : "hover:text-foreground",
          )}
        >
          {l.id === "en" ? "EN" : l.label}
        </button>
      ))}
    </div>
  )
}
