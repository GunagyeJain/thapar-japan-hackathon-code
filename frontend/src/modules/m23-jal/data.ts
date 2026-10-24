// m23 data: the sample booking (m17's booking lookup) and each person's meal as JAL's record shows it.
import { useQuery } from "@tanstack/react-query"

import { api, FLIGHT_ID } from "@/lib/api"
import type { PassengerWithPromise } from "@/lib/types"
import type { BookingOut } from "@/modules/m17-passport/types"

export const SAMPLE_PASSENGER = "PX-0057" // Priya Sharma, 23C: the story's passenger
const POLL_MS = 5000 // a booking page, not a live board

export function useBooking(passengerId: string) {
  return useQuery({
    queryKey: ["m23", "booking", passengerId],
    queryFn: () => api.get<BookingOut>(`/passport/booking/${encodeURIComponent(passengerId)}`),
    refetchInterval: POLL_MS,
    retry: false,
  })
}

/** The booking's passengers with their booked code and any meal promise, keyed by passenger id. */
export function useBookingMeals(passengerIds: string[]) {
  const wanted = new Set(passengerIds)
  return useQuery({
    queryKey: ["m23", "meals", FLIGHT_ID],
    queryFn: () => api.get<PassengerWithPromise[]>(`/flights/${FLIGHT_ID}/passengers?with_promises=true`),
    refetchInterval: POLL_MS,
    enabled: passengerIds.length > 0,
    select: (rows) => new Map(rows.filter((p) => wanted.has(p.id)).map((p) => [p.id, p])),
  })
}

export interface MealLine {
  code: string
  note: string | null
  fromThaliBento: boolean
}

/** What the booking shows: the ThaliBento promise when there is one, else the code booked with the ticket. */
export function mealLine(p: PassengerWithPromise | undefined): MealLine | null {
  if (p?.promise) return { code: p.promise.code, note: p.promise.kitchen_note, fromThaliBento: true }
  if (p?.ssr_meal) return { code: p.ssr_meal, note: p.ssr_note, fromThaliBento: false }
  return null
}
