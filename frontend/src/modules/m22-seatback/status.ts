// How each answer looks wherever it is listed: icon + word, and a status tone only where it is a status.
import { CheckCircle2, Circle, Clock, MessageCircleQuestion, Repeat, type LucideIcon } from "lucide-react"

import type { Text } from "@/lib/types"
import type { Status } from "@/ui"

import type { SeatStatus } from "./types"

export const STATUS_LOOK: Record<SeatStatus, { icon: LucideIcon; word: Text; status: Status; tone: string }> = {
  asked: { icon: Clock, word: { en: "Asked", hi: "पूछा गया", ja: "確認中" }, status: "neutral", tone: "text-muted-foreground" },
  confirmed: { icon: CheckCircle2, word: { en: "Yes", hi: "हाँ", ja: "はい" }, status: "safe", tone: "text-safe" },
  changed: { icon: Repeat, word: { en: "Changed", hi: "बदला", ja: "変更" }, status: "info", tone: "text-sky" },
  skipped: { icon: Circle, word: { en: "Skipped", hi: "छोड़ा", ja: "辞退" }, status: "neutral", tone: "text-muted-foreground" },
  no_answer: { icon: MessageCircleQuestion, word: { en: "No answer", hi: "कोई जवाब नहीं", ja: "未回答" }, status: "warn", tone: "text-warn" },
}
