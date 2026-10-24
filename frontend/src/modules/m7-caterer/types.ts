// Shapes from shared/api.md (m7), plus the additive fields the server sends.
import type { Text } from "@/lib/types"

export interface Line {
  passenger_id: string
  name: string
  pnr: string
  code: string
  note: string | null
  item_id: string | null
}

export interface Change {
  passenger_id: string
  name: string
  fields: { field: keyof Line; before: string | null; after: string | null }[]
  before: Line
  after: Line
}

export interface MealListVersion {
  id: string
  flight_id: string
  version: number
  created_at: string
  sha256: string
  short_hash: string
  ack_at: string | null
  ack_by: string | null
  lines: Line[]
  diff: { added: Line[]; removed: Line[]; changed?: Change[] }
}

export interface Label {
  item_id: string
  qr: string
  mark: Text
  name: string
  pnr: string
  flight_no: string
  date: string
  code: string
  note: string | null
  version: number
}
