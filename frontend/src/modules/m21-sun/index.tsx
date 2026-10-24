import type { ModuleRoute } from "@/app/types"
import { SunPage } from "@/modules/m21-sun/SunPage"

export const routes: ModuleRoute[] = [{ path: "/ops/sun", layout: "desktop", element: <SunPage /> }]

export { SunTimer, type SunTimerProps } from "@/modules/m21-sun/SunTimer"
export { useSunSeats } from "@/modules/m21-sun/api"
export type { SunRule, SunSeat, SunSeats } from "@/modules/m21-sun/types"
