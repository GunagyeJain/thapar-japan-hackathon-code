import type { ModuleRoute } from "@/app/types"

import { JudgePage } from "./JudgePage"
import { PassengerPage } from "./PassengerPage"

export const routes: ModuleRoute[] = [
  { path: "/p", layout: "mobile", element: <PassengerPage /> },
  { path: "/j", layout: "mobile", element: <JudgePage /> },
]
