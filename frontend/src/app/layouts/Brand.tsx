import { Link } from "react-router"

import { cn } from "@/lib/utils"

interface BrandProps {
  className?: string
  subtitle?: string
}

/** Wordmark: a small thali (three compartments) next to the name. */
export function Brand({ className, subtitle = "Meal promises · JAL" }: BrandProps) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="26" height="26" rx="7" fill="currentColor" opacity="0.14" />
        <circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 5v9l7.8 4.5M14 14l-7.8 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-bold tracking-tight">ThaliBento</span>
        <span className="block text-[11px] opacity-70">{subtitle}</span>
      </span>
    </Link>
  )
}
