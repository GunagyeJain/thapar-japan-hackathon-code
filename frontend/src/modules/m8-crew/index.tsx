import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m8 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/crew",
    layout: "tablet",
    element: (
      <ModulePlaceholder
        module="m8"
        route="/crew"
        owner="Gunagye"
        title="Crew tablet"
        purpose="Galley check and seat scan that work offline in the cabin."
        dark
      />
    ),
  },
]
