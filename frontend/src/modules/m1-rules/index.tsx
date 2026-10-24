import type { ModuleRoute } from "@/app/types"
import { RulesPage } from "@/modules/m1-rules/RulesPage"

export const routes: ModuleRoute[] = [{ path: "/rules", layout: "desktop", element: <RulesPage /> }]
