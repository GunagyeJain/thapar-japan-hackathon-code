// Japanese first, English underneath.
import { cn } from "@/lib/utils"
import type { Bilingual } from "@/modules/m8-crew/i18n"

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
  const [ja, en] = SIZES[size]
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
      <span lang="ja" className={ja}>
        {text.ja}
      </span>
      <span className={cn("text-muted-foreground", en)}>{text.en}</span>
    </span>
  )
}
