// Recipe sheets over /api. Photos go up as multipart, which api.post (JSON only) doesn't do.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, ApiError } from "@/lib/api"

import misoPng from "@shared/seed/recipes/miso_soup.png"
import misoTxt from "@shared/seed/recipes/miso_soup.txt?raw"
import curryPng from "@shared/seed/recipes/vegetable_curry.png"
import curryTxt from "@shared/seed/recipes/vegetable_curry.txt?raw"
import udonPng from "@shared/seed/recipes/kitsune_udon.png"
import udonTxt from "@shared/seed/recipes/kitsune_udon.txt?raw"
import tempuraPng from "@shared/seed/recipes/vegetable_tempura.png"
import tempuraTxt from "@shared/seed/recipes/vegetable_tempura.txt?raw"

import type { ApproveOut, EvalTable, RecipeSheet } from "./types"

/** The four demo sheets. Their Gemini answers are cached on the server, so they work offline. */
export const DEMO_SHEETS = [
  { id: "miso_soup", ja: "味噌汁", en: "Miso soup", png: misoPng, text: misoTxt },
  { id: "vegetable_curry", ja: "野菜カレー", en: "Vegetable curry", png: curryPng, text: curryTxt },
  { id: "kitsune_udon", ja: "きつねうどん", en: "Kitsune udon", png: udonPng, text: udonTxt },
  { id: "vegetable_tempura", ja: "野菜天ぷら", en: "Vegetable tempura", png: tempuraPng, text: tempuraTxt },
]

export type Upload = { kind: "photo"; file: File } | { kind: "text"; text: string }

async function uploadPhoto(file: File): Promise<RecipeSheet> {
  const form = new FormData()
  form.append("file", file)
  let res: Response
  try {
    res = await fetch("/api/recipes/extract", { method: "POST", body: form })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check the connection and try again.")
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? String((body as { detail: unknown }).detail) : res.statusText
    throw new ApiError(res.status, detail)
  }
  return body as RecipeSheet
}

export function useRecipeSheets() {
  return useQuery({ queryKey: ["recipes"], queryFn: () => api.get<RecipeSheet[]>("/recipes") })
}

export function useEvalTable() {
  return useQuery({ queryKey: ["recipes", "eval"], queryFn: () => api.get<EvalTable>("/recipes/eval") })
}

export function useExtract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (u: Upload) => (u.kind === "photo" ? uploadPhoto(u.file) : api.post<RecipeSheet>("/recipes/extract", { text: u.text })),
    onSuccess: (sheet) => {
      qc.setQueryData<RecipeSheet[]>(["recipes"], (old) => [sheet, ...(old ?? []).filter((s) => s.id !== sheet.id)])
    },
  })
}

export function useApprove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => api.post<ApproveOut>(`/recipes/${id}/approve`, { by }),
    onSuccess: ({ sheet }) => {
      qc.setQueryData<RecipeSheet[]>(["recipes"], (old) => (old ?? []).map((s) => (s.id === sheet.id ? sheet : s)))
    },
  })
}

export async function demoPhoto(demo: (typeof DEMO_SHEETS)[number]): Promise<File> {
  const blob = await (await fetch(demo.png)).blob()
  return new File([blob], `${demo.id}.png`, { type: "image/png" })
}
