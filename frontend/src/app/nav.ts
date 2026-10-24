// Nav menu. Shared zone: one line per entry, add yours, don't reorder.
import {
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock4,
  ConciergeBell,
  FlaskConical,
  LayoutGrid,
  LineChart,
  MessageCircle,
  Palette,
  PlayCircle,
  QrCode,
  Scale,
  Route,
  ShieldCheck,
  Smartphone,
  Sunrise,
  Tablet,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { Surface } from "@/app/types"

export type NavGroup = "Overview" | "Operations" | "Passenger" | "Crew" | "Team"

export interface NavEntry {
  to: string
  label: string
  module: string
  group: NavGroup
  surface: Surface
  icon: LucideIcon
  blurb: string
}

export const NAV: NavEntry[] = [
  { to: "/", label: "Home", module: "m0", group: "Overview", surface: "desktop", icon: LayoutGrid, blurb: "JL740 at a glance" },
  { to: "/ops", label: "Ops console", module: "m5", group: "Operations", surface: "desktop", icon: ClipboardList, blurb: "Lost-meal alerts, PNL/ADL evidence, fixes" },
  { to: "/ops/late", label: "Late requests", module: "m6", group: "Operations", surface: "desktop", icon: Clock4, blurb: "Find a safe meal on board for a last-minute request" },
  { to: "/ops/days", label: "Fast days", module: "m16", group: "Operations", surface: "desktop", icon: CalendarDays, blurb: "Legs where a passenger's fast day changes the meal" },
  { to: "/ops/changes", label: "Change control", module: "m18", group: "Operations", surface: "desktop", icon: Route, blurb: "Every late diet change on its rung of the cutoff ladder" },
  { to: "/ops/desk", label: "Change desk", module: "m18", group: "Operations", surface: "desktop", icon: ConciergeBell, blurb: "Check-in, lounge, gate and crew take a diet change" },
  { to: "/ops/sun", label: "Sun at the aircraft", module: "m21", group: "Operations", surface: "desktop", icon: Sunrise, blurb: "When passengers who eat by the sun may eat, at the aircraft" },
  { to: "/ops/load", label: "Smart load", module: "m19", group: "Operations", surface: "desktop", icon: Scale, blurb: "Demand per diet family, the reserve that never goes bad" },
  { to: "/caterer", label: "Caterer", module: "m7", group: "Operations", surface: "desktop", icon: ChefHat, blurb: "Meal list versions, acknowledgement, labels" },
  { to: "/caterer/recipes", label: "Recipe check", module: "m9", group: "Operations", surface: "desktop", icon: FlaskConical, blurb: "Hidden ingredients in Japanese recipe sheets" },
  { to: "/insights", label: "Insights", module: "m10", group: "Operations", surface: "desktop", icon: LineChart, blurb: "C1–C5 timeline of every promise" },
  { to: "/rules", label: "Diet rules", module: "m1", group: "Operations", surface: "desktop", icon: ShieldCheck, blurb: "The rules every verdict comes from" },
  { to: "/p", label: "Passenger", module: "m3", group: "Passenger", surface: "mobile", icon: Smartphone, blurb: "State your diet once, get the right code" },
  { to: "/j", label: "Judge join", module: "m3", group: "Passenger", surface: "mobile", icon: QrCode, blurb: "Scan, pick a diet, get a seat in row 5" },
  { to: "/chat", label: "Meal chat", module: "m17", group: "Passenger", surface: "mobile", icon: MessageCircle, blurb: "Say what you eat in your own words; the Radar asks before fast days" },
  { to: "/groups", label: "Group upload", module: "m14", group: "Passenger", surface: "desktop", icon: Users, blurb: "Tour operators upload a whole group" },
  { to: "/crew", label: "Crew tablet", module: "m8", group: "Crew", surface: "tablet", icon: Tablet, blurb: "Offline galley check and seat scan" },
  { to: "/demo", label: "Demo control", module: "m11", group: "Team", surface: "desktop", icon: PlayCircle, blurb: "Step the story, reset the data" },
  { to: "/ui", label: "UI kit", module: "m2", group: "Team", surface: "desktop", icon: Palette, blurb: "Components and tokens" },
]

export const NAV_GROUPS: NavGroup[] = ["Overview", "Operations", "Passenger", "Crew", "Team"]
