// Crew tablet shell: dark cabin mode by default, landscape first, large touch targets.
// The crew page draws its own app bar (flight, connection, language), so this is just the cabin frame.
import { Outlet } from "react-router"

export function TabletLayout() {
  return (
    <div className="cabin min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  )
}
