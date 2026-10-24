import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m7 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/caterer",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m7"
        route="/caterer"
        owner="Shefali"
        title="Caterer portal"
        purpose="Meal list versions with diffs and acknowledgement, plus printable labels."
      />
    ),
  },
]
