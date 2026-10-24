// Queries and the acknowledge action for the caterer screens.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Notification } from "@/lib/types"
import { toast } from "@/ui"
import type { Label, MealListVersion } from "@/modules/m7-caterer/types"

export const CATERER = "Skyline Flight Kitchens · shift lead"
const LISTS_KEY = ["m7", "meal-lists", FLIGHT_ID]

export function useMealLists() {
  return useQuery({
    queryKey: LISTS_KEY,
    queryFn: () => api.get<MealListVersion[]>(`/flights/${FLIGHT_ID}/meal-lists`),
    refetchInterval: POLL_MS,
  })
}

export function useCatererInbox() {
  return useQuery({
    queryKey: ["notifications", "caterer"],
    queryFn: () => api.get<Notification[]>("/notifications?to=caterer"),
    refetchInterval: POLL_MS,
  })
}

export function useLabels(version: number | null) {
  return useQuery({
    queryKey: ["m7", "labels", FLIGHT_ID, version],
    queryFn: () => api.get<Label[]>(`/flights/${FLIGHT_ID}/labels${version ? `?version=${version}` : ""}`),
  })
}

export function useAcknowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<MealListVersion>(`/meal-lists/${id}/ack`, { by: CATERER }),
    onSuccess: (v) => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY })
      toast.success(`Meal list v${v.version} acknowledged. JAL sees it now.`)
    },
    onError: (e) => toast.error(`Couldn't acknowledge: ${e.message}`),
  })
}

/** "AVML  SHARMA/PRIYA MS  8MZ2TN  NO ONION NO GARLIC  TB-7K2Q9F": one line per meal, for the diff. */
export function lineText(l: { code: string; name: string; pnr: string; note: string | null; item_id: string | null }): string {
  return [l.code.padEnd(5), l.name.padEnd(26), l.pnr, l.note ?? "", l.item_id ?? ""].filter(Boolean).join("  ")
}
