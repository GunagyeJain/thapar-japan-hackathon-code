// m18's calls (and m17's cabin), typed per shared/api.md. When an endpoint isn't on the server yet
// (FastAPI's 404 "Not Found", or 405 from the page catch-all), the call answers from mock.ts and says so with
// `live: false`; the next poll after the merge switches to the server by itself.
import itemsJson from "@shared/seed/meal_items.json"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, ApiError, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Lang, MealItem } from "@/lib/types"

import { mockChanges, mockMetrics, mockReset, mockRunChaos } from "./mock"
import { mockCabin, mockSubmit } from "./mockDesk"
import type {
  CabinResponse,
  ChangeEvent,
  ChangesResponse,
  ChaosRunResponse,
  Feed,
  MetricsResponse,
  SubmitChange,
} from "./types"
import type { ItemPlace } from "./words"

export const CHANGES_KEY = ["m18", "changes", FLIGHT_ID] as const
const METRICS_KEY = ["m18", "metrics", FLIGHT_ID] as const
const CABIN_KEY = ["m17", "cabin", FLIGHT_ID] as const
const PLACES_KEY = ["m18", "places", FLIGHT_ID] as const

/** The route isn't on the server yet. A module's own 404 ("No passenger PX-…") is a real error and is shown. */
export function missingEndpoint(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 405 || (e.status === 404 && /^not found$/i.test(e.message.trim())))
}

async function orMock<T>(real: () => Promise<T>, mock: () => T | Promise<T>): Promise<Feed<T>> {
  try {
    return { data: await real(), live: true }
  } catch (e) {
    if (missingEndpoint(e)) return { data: await mock(), live: false }
    throw e
  }
}

async function simNow(): Promise<string> {
  return (await api.get<{ now: string }>("/clock")).now
}

/** Fill what a screen needs if the server leaves an optional part out, so one odd event can't blank the page. */
export function normalizeEvent(e: ChangeEvent): ChangeEvent {
  const request = e.request ?? { forbid: [], allow: [], tiers: {}, note: null, lang: "en" }
  return {
    ...e,
    request: { ...request, forbid: request.forbid ?? [], allow: request.allow ?? [], tiers: request.tiers ?? {}, lang: request.lang ?? "en" },
    decision: { ...e.decision, steps_tried: e.decision.steps_tried ?? [], reason: e.decision.reason ?? { en: "" } },
    today: e.today ?? { ok: false, outcome: { en: "—" } },
  }
}

async function getChanges(): Promise<ChangesResponse> {
  const res = await api.get<ChangesResponse>(`/changes?flight_id=${FLIGHT_ID}`)
  return { ...res, events: (res.events ?? []).map(normalizeEvent) }
}

export function useChanges() {
  return useQuery({
    queryKey: CHANGES_KEY,
    queryFn: () => orMock(getChanges, async () => mockChanges(await simNow())),
    refetchInterval: POLL_MS,
  })
}

export function useChangeMetrics() {
  return useQuery({
    queryKey: METRICS_KEY,
    queryFn: () => orMock(() => api.get<MetricsResponse>(`/changes/metrics?flight_id=${FLIGHT_ID}`), mockMetrics),
    refetchInterval: POLL_MS,
  })
}

export function useCabin() {
  return useQuery({
    queryKey: CABIN_KEY,
    queryFn: () => orMock(() => api.get<CabinResponse>(`/passport/cabin/${FLIGHT_ID}`), mockCabin),
    refetchInterval: POLL_MS,
  })
}

const SEED_PLACES = new Map((itemsJson as MealItem[]).map((i) => [i.id, { galley: i.galley, position: i.position }]))

/** Galley and position of every tray (m6's inventory), so a decision can say "galley 2 · G2-X01". */
export function useItemPlaces() {
  return useQuery({
    queryKey: PLACES_KEY,
    queryFn: async (): Promise<Map<string, ItemPlace>> => {
      try {
        const inv = await api.get<{ items: MealItem[] }>(`/flights/${FLIGHT_ID}/inventory`)
        return new Map([...SEED_PLACES, ...inv.items.map((i): [string, ItemPlace] => [i.id, { galley: i.galley, position: i.position }])])
      } catch {
        return SEED_PLACES
      }
    },
    refetchInterval: POLL_MS * 5,
  })
}

function useRefreshChanges() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["m18"] })
    queryClient.invalidateQueries({ queryKey: ["m17"] })
  }
}

export function useRunChaos() {
  const refresh = useRefreshChanges()
  return useMutation({
    mutationFn: () =>
      orMock(async () => {
        const res = await api.post<ChaosRunResponse>("/chaos/run", { flight_id: FLIGHT_ID, preset: "jl740" })
        return { ...res, events: (res.events ?? []).map(normalizeEvent) }
      }, mockRunChaos),
    onSettled: refresh,
  })
}

export function useResetChaos() {
  const refresh = useRefreshChanges()
  return useMutation({
    mutationFn: () => orMock(() => api.post<{ ok: boolean }>("/chaos/reset", { flight_id: FLIGHT_ID }), mockReset),
    onSettled: refresh,
  })
}

export function useSubmitChange() {
  const refresh = useRefreshChanges()
  return useMutation({
    mutationFn: (body: SubmitChange) =>
      orMock(async () => normalizeEvent(await api.post<ChangeEvent>("/changes", body)), async () => mockSubmit(body, await simNow())),
    onSettled: refresh,
  })
}

