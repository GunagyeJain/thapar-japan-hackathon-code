// Crew text in the chosen language: Japanese first with English underneath, or one language only.
import { cn } from "@/lib/utils"
import type { Bilingual } from "@/modules/m8-crew/i18n"
import { useCrewLang } from "@/modules/m8-crew/lang"

interface BiProps {
  text: Bilingual
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  inline?: boolean
}

const SIZES = {
  sm: ["text-sm", "text-xs"],
  md: ["text-base", "text-xs"],
  lg: ["text-xl font-bold", "text-sm"],
  xl: ["text-4xl font-bold", "text-lg"],
}

export function Bi({ text, size = "md", className, inline = false }: BiProps) {
  const mode = useCrewLang()
  const [main, sub] = SIZES[size]
  if (mode !== "both") {
    const one = mode === "ja" ? text.ja : text.en
    return (
      <span lang={mode} className={cn(inline ? undefined : "flex flex-col leading-tight", !inline && main, className)}>
        {one}
      </span>
    )
  }
  if (inline) {
    return (
      <span className={className}>
        <span lang="ja">{text.ja}</span>
        <span className="ml-1.5 text-muted-foreground">{text.en}</span>
      </span>
    )
  }
  return (
    <span className={cn("flex flex-col leading-tight", className)}>
      <span lang="ja" className={main}>
        {text.ja}
      </span>
      <span className={cn("text-muted-foreground", sub)}>{text.en}</span>
    </span>
  )
}
