import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m14 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/groups",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m14"
        route="/groups"
        owner="Shefali"
        title="Group upload"
        purpose="Tour operators upload a group's diets in one file."
      />
    ),
  },
]
