// Crew tablet and seat screens: the same light palette as the rest, landscape first, large touch targets.
// The crew page draws its own app bar (flight, connection, language), so this is just the frame.
import { Outlet } from "react-router"

export function TabletLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  )
}
