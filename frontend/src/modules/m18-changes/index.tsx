import type { ModuleRoute } from "@/app/types"
import { ChangeControlPage } from "@/modules/m18-changes/ChangeControlPage"
import { ChangeDeskPage } from "@/modules/m18-changes/ChangeDeskPage"

export { CutoffLadder, type CutoffLadderProps } from "@/modules/m18-changes/CutoffLadder"

export const routes: ModuleRoute[] = [
  { path: "/ops/changes", layout: "desktop", element: <ChangeControlPage /> },
  { path: "/ops/desk", layout: "desktop", element: <ChangeDeskPage /> },
]
