// m22's calls (shared/api.md, ## m22). Seat screens and the crew tablet poll the aircraft server every 2 s.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"

import type { Answer, SeatbackStatus, SeatOptions, SeatView } from "./types"

export const SEAT_RE = /^\d{1,2}[A-K]$/

const seatKey = (flightId: string, seat: string) => ["m22", "seat", flightId, seat] as const
const statusKey = (flightId: string) => ["m22", "status", flightId] as const

export function useSeatView(seat: string, flightId: string = FLIGHT_ID) {
  return useQuery({
    queryKey: seatKey(flightId, seat),
    queryFn: () => api.get<SeatView>(`/seatback/${flightId}/seats/${seat}`),
    refetchInterval: POLL_MS,
    enabled: SEAT_RE.test(seat),
  })
}

export function useSeatOptions(seat: string, enabled: boolean, flightId: string = FLIGHT_ID) {
  return useQuery({
    queryKey: ["m22", "options", flightId, seat],
    queryFn: () => api.get<SeatOptions>(`/seatback/${flightId}/seats/${seat}/options`),
    enabled: enabled && SEAT_RE.test(seat),
    staleTime: 0,
  })
}

export function useAnswer(seat: string, flightId: string = FLIGHT_ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { answer: Answer; item_id?: string }) =>
      api.post<SeatView>("/seatback/answer", { flight_id: flightId, seat, ...body }),
    onSuccess: (view) => {
      qc.setQueryData(seatKey(flightId, seat), view)
      void qc.invalidateQueries({ queryKey: statusKey(flightId) })
    },
  })
}

/** The crew's live view of every seat asked. Keeps the last answers while the tablet is off the network. */
export function useSeatbackStatus(flightId: string = FLIGHT_ID) {
  return useQuery({
    queryKey: statusKey(flightId),
    queryFn: () => api.get<SeatbackStatus>(`/seatback/${flightId}`),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useAskSeats(flightId: string = FLIGHT_ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<SeatbackStatus>("/seatback/ask", { flight_id: flightId }),
    onSuccess: (status) => qc.setQueryData(statusKey(flightId), status),
  })
}
