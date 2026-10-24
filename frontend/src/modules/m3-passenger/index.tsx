import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m3 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/p",
    layout: "mobile",
    element: (
      <ModulePlaceholder
        module="m3"
        route="/p"
        owner="Shefali"
        title="Your meal on JL740"
        purpose="Tell us once what you don't eat. We pick the right meal code and the kitchen note."
      />
    ),
  },
  {
    path: "/j",
    layout: "mobile",
    element: (
      <ModulePlaceholder
        module="m3"
        route="/j"
        owner="Shefali"
        title="Join JL740 as a judge"
        purpose="Pick what you don't eat and get a seat in row 5 with a safe meal."
      />
    ),
  },
]
