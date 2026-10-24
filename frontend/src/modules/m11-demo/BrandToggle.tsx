// Palette switch for the presenter: JAL (default) or ThaliBento. Same key and rules as the boot script in
// index.html; the choice is remembered on this laptop and every open tab follows it (storage event).
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/ui"

export type Brand = "jal" | "thalibento"

export const BRAND_KEY = "tb.brand"
const THEME_COLOR: Record<Brand, string> = { jal: "#1a1a1a", thalibento: "#0A2A66" }
const BRANDS: { id: Brand; label: string }[] = [
  { id: "jal", label: "JAL" },
  { id: "thalibento", label: "ThaliBento" },
]

function asBrand(value: string | null | undefined): Brand {
  return value === "thalibento" ? "thalibento" : "jal"
}

export function currentBrand(): Brand {
  return asBrand(document.documentElement.dataset.brand)
}

export function applyBrand(brand: Brand) {
  document.documentElement.dataset.brand = brand
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[brand])
  try {
    localStorage.setItem(BRAND_KEY, brand)
  } catch {
    // storage blocked: this tab still switches
  }
}

export function BrandToggle({ className }: { className?: string }) {
  const [brand, setBrand] = useState<Brand>(currentBrand)

  useEffect(() => {
    const follow = (e: StorageEvent) => {
      if (e.key === BRAND_KEY) setBrand(asBrand(e.newValue))
    }
    window.addEventListener("storage", follow)
    return () => window.removeEventListener("storage", follow)
  }, [])

  const choose = (next: Brand) => {
    applyBrand(next)
    setBrand(next)
  }

  return (
    <div role="group" aria-label="Palette" className={cn("inline-flex items-center rounded-lg bg-muted p-[3px]", className)}>
      <span className="px-2 text-xs font-medium text-muted-foreground">Palette</span>
      {BRANDS.map((b) => (
        <Button
          key={b.id}
          type="button"
          variant="ghost"
          aria-pressed={brand === b.id}
          onClick={() => choose(b.id)}
          className={cn(
            "h-9 min-w-11 px-3 text-muted-foreground hover:bg-transparent hover:text-foreground",
            brand === b.id && "bg-card text-foreground ring-1 ring-border hover:bg-card",
          )}
        >
          {b.label}
        </Button>
      ))}
    </div>
  )
}
