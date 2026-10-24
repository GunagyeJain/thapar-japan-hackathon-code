// /jal's calls: the booking lookup (m3), the booking and passport (m17), the flight's passengers (m0), the Radar.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, ApiError, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Notification, Passenger, PassengerWithPromise } from "@/lib/types"
import type { BookingOut, Passport, Rules, SaveOut } from "@/modules/m17-passport/types"

export const SAMPLE = { pnr: "6XK2QP", surname: "SHARMA", passengerId: "PX-0057" }

export function lookupBooking(pnr: string, surname: string): Promise<Passenger> {
  return api.get<Passenger>(`/passenger/lookup?pnr=${encodeURIComponent(pnr.trim().toUpperCase())}&surname=${encodeURIComponent(surname.trim().toUpperCase())}`)
}

export function useBooking(passengerId: string | null) {
  return useQuery({
    queryKey: ["m23", "booking", passengerId],
    queryFn: () => api.get<BookingOut>(`/passport/booking/${encodeURIComponent(passengerId ?? "")}`),
    enabled: !!passengerId,
    retry: false,
  })
}

/** Everyone on the flight with their meal, keyed by passenger id. */
export function useMeals() {
  return useQuery({
    queryKey: ["m23", "meals", FLIGHT_ID],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
    refetchInterval: POLL_MS,
    select: (rows) => new Map(rows.map((p) => [p.id, p])),
  })
}

/** The saved passport, or null when the passenger hasn't told us anything yet. */
export function usePassport(passengerId: string) {
  return useQuery({
    queryKey: ["m23", "passport", passengerId],
    queryFn: async () => {
      try {
        return await api.get<Passport>(`/passport/${encodeURIComponent(passengerId)}`)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    retry: false,
  })
}

export function useSavePassport(passengerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { lang: string; rules: Omit<Rules, "tiers"> }) =>
      api.post<SaveOut>("/passport", { passenger_id: passengerId, lang: body.lang, rules: body.rules, source: "form" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["m23"] })
      void qc.invalidateQueries({ queryKey: ["m23", "notes", passengerId] })
    },
  })
}

/** The passenger's messages (the Radar's question arrives here). */
export function useNotes(passengerId: string) {
  return useQuery({
    queryKey: ["m23", "notes", passengerId],
    queryFn: () => api.get<Notification[]>(`/notifications?to=${encodeURIComponent(passengerId)}`),
    refetchInterval: POLL_MS,
  })
}

export function useRadarAnswer(passengerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { question_id: string; option_id: "yes" | "no" }) => api.post<unknown>("/radar/answer", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["m23", "notes", passengerId] })
      void qc.invalidateQueries({ queryKey: ["m23", "meals", FLIGHT_ID] })
    },
  })
}
