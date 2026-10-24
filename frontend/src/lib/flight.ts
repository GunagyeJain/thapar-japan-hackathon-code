// JL740 data shared by every surface: the flight query and its hand-off deadlines (sim clock).
import { useQuery } from "@tanstack/react-query"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Flight, FlightDetail } from "@/lib/types"

export function useFlight(flightId: string = FLIGHT_ID) {
  return useQuery({
    queryKey: ["flight", flightId],
    queryFn: () => api.get<FlightDetail>(`/flights/${flightId}`),
    refetchInterval: POLL_MS,
  })
}

export interface Deadline {
  id: "cutoff" | "caterer" | "dispatch" | "boarding" | "departure"
  label: string
  at: string
}

export function flightDeadlines(flight: Flight): Deadline[] {
  return [
    { id: "cutoff", label: "Special-meal cutoff (T-25 h)", at: flight.special_meal_cutoff },
    { id: "caterer", label: "Caterer final list", at: flight.caterer_final_list_at },
    { id: "dispatch", label: "Meals dispatched", at: flight.dispatch_at },
    { id: "boarding", label: "Boarding", at: flight.boarding_at },
    { id: "departure", label: "Departure DEL", at: flight.std },
  ]
}

/** The first deadline still ahead of `now`, or null once the flight has left. */
export function nextDeadline(flight: Flight, now: Date): Deadline | null {
  return flightDeadlines(flight).find((d) => new Date(d.at).getTime() > now.getTime()) ?? null
}
