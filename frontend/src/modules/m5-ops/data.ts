// Alerts, feed and actions for the ops console. Talks to m4's routes from shared/api.md; while they aren't on
// main (404), it serves mock.ts and applies actions locally, so the console can be rehearsed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, ApiError, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Alert, AlertAction, PassengerWithPromise, RawMessage } from "@/lib/types"
import { toast } from "@/ui"
import { MOCK_ALERTS, MOCK_MESSAGES, MOCK_RESTORE } from "@/modules/m5-ops/mock"

export const ACTOR = "JAL ground ops, Delhi"
export type ActionName = "acknowledge" | "request_again" | "notify_passenger" | "notify_kitchen" | "resolve"

const NOT_THERE = [404, 405]
let mockAlerts = MOCK_ALERTS
let mockMessages = MOCK_MESSAGES

const missing = (e: unknown) => e instanceof ApiError && NOT_THERE.includes(e.status)

export interface Feed<T> {
  rows: T
  live: boolean
}

async function alertsOrMock(): Promise<Feed<Alert[]>> {
  try {
    return { rows: await api.get<Alert[]>(`/alerts?flight_id=${FLIGHT_ID}`), live: true }
  } catch (e) {
    if (missing(e)) return { rows: mockAlerts, live: false }
    throw e
  }
}

async function messagesOrMock(): Promise<Feed<RawMessage[]>> {
  try {
    return { rows: await api.get<RawMessage[]>(`/flights/${FLIGHT_ID}/messages`), live: true }
  } catch (e) {
    if (missing(e)) return { rows: mockMessages, live: false }
    throw e
  }
}

export function useAlerts() {
  return useQuery({ queryKey: ["m5", "alerts"], queryFn: alertsOrMock, refetchInterval: POLL_MS })
}

export function useMessages() {
  return useQuery({ queryKey: ["m5", "messages"], queryFn: messagesOrMock, refetchInterval: POLL_MS })
}

export function usePassengers() {
  return useQuery({
    queryKey: ["flight", FLIGHT_ID, "passengers", "promises"],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
    refetchInterval: POLL_MS,
  })
}

async function applyMock(id: string, action: ActionName, note?: string): Promise<Alert> {
  const { now: at } = await api.get<{ now: string }>("/clock")
  const step: AlertAction = { action, actor: ACTOR, at, ...(note ? { note } : {}) }
  const fixed = action === "request_again" || action === "resolve"
  mockAlerts = mockAlerts.map((a) =>
    a.id !== id
      ? a
      : {
          ...a,
          actions: [...a.actions, step, ...(action === "request_again" ? [{ action: "resolve", actor: "watcher", at, note: "Corrected ADL received" }] : [])],
          status: fixed ? "resolved" : action === "acknowledge" ? "acknowledged" : a.status,
        },
  )
  if (action === "request_again" && !mockMessages.some((m) => m.id === MOCK_RESTORE.id)) mockMessages = [...mockMessages, MOCK_RESTORE]
  return mockAlerts.find((a) => a.id === id) as Alert
}

export function useAlertAction(live: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: ActionName; note?: string }) =>
      live ? api.post<Alert>(`/alerts/${id}/actions`, { action, actor: ACTOR, ...(note ? { note } : {}) }) : applyMock(id, action, note),
    onSuccess: (_alert, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["m5"] })
      queryClient.invalidateQueries({ queryKey: ["flight"] })
      toast.success(DONE[action])
    },
    onError: (e) => toast.error(`Couldn't do that: ${e.message}`),
  })
}

const DONE: Record<ActionName, string> = {
  acknowledge: "Acknowledged. The alert stays open until it's fixed.",
  request_again: "Meal requested again. The watcher closes the alert when the corrected ADL arrives.",
  notify_passenger: "Passenger notified.",
  notify_kitchen: "Kitchen notified.",
  resolve: "Resolved.",
}
