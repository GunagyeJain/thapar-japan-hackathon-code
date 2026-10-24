import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m1 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/rules",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m1"
        route="/rules"
        owner="Gunagye"
        title="Diet rules"
        purpose="Every diet as ingredient rules, and a live check that shows which rule fired."
      />
    ),
  },
]
