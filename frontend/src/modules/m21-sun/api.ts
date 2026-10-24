// m21 data hooks. The sun only moves when the flight does (a delay), so 30 s polling is plenty.
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type { SunFlight, SunPresets, SunSeats } from "./types"

export const SUN_POLL_MS = 30_000

export function useSunFlight(flightId: string) {
  return useQuery({
    queryKey: ["m21", "flight", flightId],
    queryFn: () => api.get<SunFlight>(`/sun/flight/${encodeURIComponent(flightId)}`),
    refetchInterval: SUN_POLL_MS,
  })
}

export function useSunPresets(date?: string) {
  return useQuery({
    queryKey: ["m21", "presets", date ?? "default"],
    queryFn: () => api.get<SunPresets>(date ? `/sun/presets?date=${encodeURIComponent(date)}` : "/sun/presets"),
  })
}

/** Seats on a flight with a sun-time rule, each with when they may eat (crew tablet, passenger phone, ops). */
export function useSunSeats(flightId: string) {
  return useQuery({
    queryKey: ["m21", "seats", flightId],
    queryFn: () => api.get<SunSeats>(`/sun/seats/${encodeURIComponent(flightId)}`),
    refetchInterval: SUN_POLL_MS,
  })
}
