import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m9 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/caterer/recipes",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m9"
        route="/caterer/recipes"
        owner="Shefali"
        title="Recipe check"
        purpose="Find hidden ingredients in Japanese recipe sheets before a dish is called safe."
      />
    ),
  },
]
