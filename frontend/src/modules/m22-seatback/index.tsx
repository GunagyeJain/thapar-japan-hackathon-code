import type { ModuleRoute } from "@/app/types"

import { SeatPage } from "./SeatPage"

export { useAskSeats, useSeatbackStatus } from "./api"
export { STATUS_LOOK } from "./status"
export type { SeatbackRow, SeatbackStatus, SeatStatus } from "./types"

export const routes: ModuleRoute[] = [{ path: "/seat", layout: "tablet", element: <SeatPage /> }]
