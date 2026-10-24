// Status is always icon + word, never colour alone.
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type Status = "safe" | "warn" | "unsafe" | "info" | "neutral"

const STYLES: Record<Status, { icon: LucideIcon; className: string }> = {
  safe: { icon: CheckCircle2, className: "bg-safe-bg text-safe" },
  warn: { icon: AlertTriangle, className: "bg-warn-bg text-warn" },
  unsafe: { icon: XCircle, className: "bg-unsafe-bg text-unsafe" },
  info: { icon: Info, className: "bg-ice text-blue dark:bg-secondary dark:text-sky" },
  neutral: { icon: Circle, className: "bg-muted text-muted-foreground" },
}

export interface StatusChipProps {
  status: Status
  label: ReactNode
  size?: "sm" | "md" | "lg"
  icon?: LucideIcon
  className?: string
}

const SIZES = {
  sm: "h-6 gap-1 px-2 text-xs [&_svg]:size-3.5",
  md: "h-7 gap-1.5 px-2.5 text-sm [&_svg]:size-4",
  lg: "h-10 gap-2 px-3.5 text-base font-semibold [&_svg]:size-5",
}

export function StatusChip({ status, label, size = "md", icon, className }: StatusChipProps) {
  const style = STYLES[status]
  const Icon = icon ?? style.icon
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-md font-medium whitespace-nowrap transition-colors duration-150",
        SIZES[size],
        style.className,
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  )
}
