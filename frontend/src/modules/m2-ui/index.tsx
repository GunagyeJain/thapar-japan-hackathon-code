import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m2 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/ui",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m2"
        route="/ui"
        owner="Gunagye"
        title="UI kit"
        purpose="Every shared component and token, in one place."
      />
    ),
  },
]
