import type { ModuleRoute } from "@/app/types"
import { LateDesk } from "@/modules/m6-matcher/LateDesk"

export { MatchResult } from "@/modules/m6-matcher/MatchResult"

export const routes: ModuleRoute[] = [{ path: "/ops/late", layout: "desktop", element: <LateDesk /> }]
