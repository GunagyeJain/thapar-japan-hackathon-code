import { Link } from "react-router"

import jalLogo from "@/app/layouts/jal-logo.svg"
import { cn } from "@/lib/utils"

interface BrandProps {
  className?: string
  subtitle?: string
  /** The ThaliBento × JAL lockup on the staff tools; passenger screens leave JAL's logo off. */
  partner?: boolean
}

/** Wordmark: a small thali (three compartments) next to the name, and JAL's logo on a white chip. */
export function Brand({ className, subtitle = "Meal promises", partner = true }: BrandProps) {
  return (
    <Link to="/" className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-2", className)}>
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="26" height="26" rx="7" fill="currentColor" opacity="0.14" />
        <circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 5v9l7.8 4.5M14 14l-7.8 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-bold tracking-tight">ThaliBento</span>
        <span className="block text-[11px] opacity-70">{subtitle}</span>
      </span>
      {partner && (
        <span className="inline-flex items-center rounded-md bg-paper px-2 py-1.5">
          <img src={jalLogo} alt="Japan Airlines" className="h-3.5 w-auto" />
        </span>
      )}
    </Link>
  )
}
