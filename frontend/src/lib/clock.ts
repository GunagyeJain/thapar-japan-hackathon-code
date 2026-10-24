// Sim clock on the client. Polls /api/clock and ticks locally in between. Never use Date.now() for deadlines.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { api, POLL_MS } from "@/lib/api"

export interface ClockResponse {
  now: string
  tz: string
}

const TICK_MS = 1000
const OFFSET_KEY = "thalibento.sim-offset-ms" // sim minus wall, kept so the crew tablet has a clock offline

function storedOffset(): number | null {
  try {
    const v = localStorage.getItem(OFFSET_KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

export function useSimClock(): { now: Date | null; isLoading: boolean; error: Error | null } {
  const query = useQuery({
    queryKey: ["clock"],
    queryFn: async () => {
      const res = await api.get<ClockResponse>("/clock")
      const sim = new Date(res.now).getTime()
      const fetchedAt = Date.now()
      try {
        localStorage.setItem(OFFSET_KEY, String(sim - fetchedAt))
      } catch {
        // private mode: the clock still works while online
      }
      return { sim, fetchedAt }
    },
    refetchInterval: POLL_MS,
  })
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const offline = storedOffset()
  const now = query.data
    ? new Date(query.data.sim + (Date.now() - query.data.fetchedAt))
    : query.isError && offline !== null
      ? new Date(Date.now() + offline)
      : null
  return { now, isLoading: query.isLoading, error: query.error }
}

/** Milliseconds from the sim time `now` until `iso` (negative once it has passed). */
export function msUntil(iso: string, now: Date): number {
  return new Date(iso).getTime() - now.getTime()
}
