// The story's state (/api/demo/scenario) and Priya's live promise, shared by /demo and the guide bar.
import { useQuery } from "@tanstack/react-query"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import { fmtTime } from "@/lib/format"
import type { PassengerWithPromise, Text } from "@/lib/types"

export interface Step {
  n: number
  act: number
  title: Text
  sim_time: string
  screen: string
  cue: Text
  auto: string | null
  done: boolean
}

export interface Scenario {
  current: number
  steps: Step[]
}

export const SCENARIO_KEY = ["m11", "scenario"]
export const PRIYA_SEAT = "23C"

export function useScenario() {
  return useQuery({ queryKey: SCENARIO_KEY, queryFn: () => api.get<Scenario>("/demo/scenario"), refetchInterval: POLL_MS })
}

/** Same query (and cache) as the ops board's passenger list. */
export function usePriya() {
  return useQuery({
    queryKey: ["flight", FLIGHT_ID, "passengers", "promises"],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
    refetchInterval: POLL_MS,
    select: (rows) => rows.find((r) => r.seat === PRIYA_SEAT) ?? null,
  })
}

/** "24 Oct, 23:02 IST", or JST once the story lands in Tokyo. */
export function when(step: Step): string {
  return step.sim_time.endsWith("+09:00") ? fmtTime(step.sim_time, "JST", { date: true }) : fmtTime(step.sim_time, "IST", { date: true })
}
