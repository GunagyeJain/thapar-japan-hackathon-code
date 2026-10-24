import type { ModuleRoute } from "@/app/types"

import { BookingPage } from "./BookingPage"
import { HomePage } from "./HomePage"
import { MealPage } from "./MealPage"

export const routes: ModuleRoute[] = [
  { path: "/jal", layout: "web", element: <HomePage /> },
  { path: "/jal/booking", layout: "web", element: <BookingPage /> },
  { path: "/jal/meal", layout: "web", element: <MealPage /> },
]
