// Shapes from shared/api.md (m6), plus the additive fields the server sends.
import type { Fired, MealItem, MealSpec, Text, Verdict } from "@/lib/types"

export type Tier = "spare_special" | "main_menu" | "backup" | "voucher"
export type Source = "checkin" | "gate" | "crew" | "join"

export type InventoryItem = MealItem & {
  spec: MealSpec
  tier: Exclude<Tier, "voucher"> | null
  cabin: "C" | "Y" | null
  free: boolean
  reserve: boolean
}

export interface Considered {
  item_id: string
  spec_name: Text
  tier: Exclude<Tier, "voucher">
  galley: string
  verdict: Verdict
  fired: Fired[]
  note: Text | null
  chosen: boolean
}

export interface Voucher {
  code: string
  value_inr: number
  outlets: { name: string; terminal: string; open: string }[]
  illustrative?: boolean
}

export interface MatchResult {
  status: "matched" | "voucher"
  tier: Tier
  item: InventoryItem | null
  explanation: Text
  considered: Considered[]
  solver: { engine: "cp-sat" | "greedy"; ms: number; swaps: { passenger_id: string; from_item_id: string; to_item_id: string }[] }
  voucher?: Voucher
  label_mark?: Text
  source?: Source
}

export interface LateRequestResponse {
  late_request: { id: string; passenger_id: string; at: string; source: Source; status: "reserved" | "voucher" }
  match: MatchResult
}

export interface InventoryResponse {
  items: InventoryItem[]
  summary: { special: number; spare: number; main: number; backup: number; free: number; main_free: { C: number; Y: number }; backup_reserve: number }
}
