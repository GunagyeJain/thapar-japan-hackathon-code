import type { CSSProperties } from "react"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster, toast }
