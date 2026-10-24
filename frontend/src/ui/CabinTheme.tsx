// Dark cabin mode for the crew tablet. Everything inside uses the cabin tokens.
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface CabinThemeProps {
  children: ReactNode
  className?: string
}

export function CabinTheme({ children, className }: CabinThemeProps) {
  return <div className={cn("cabin bg-background text-foreground", className)}>{children}</div>
}
