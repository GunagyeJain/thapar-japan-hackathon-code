// Real JL740 examples for the gallery (from shared/seed and the demo story).
import type { Fired } from "@/lib/types"

export const PRIYA_AVML_SPARE: Fired[] = [
  {
    rule_id: "no_onion_garlic.onion",
    tag: "onion",
    via: "Vegetable biryani → onion → allium",
    message: { en: "Contains onion · 23C eats no onion or garlic", ja: "玉ねぎを含む · 23Cは玉ねぎ・にんにく不可", hi: "प्याज़ है · 23C प्याज़-लहसुन नहीं खाते" },
  },
  {
    rule_id: "no_onion_garlic.garlic",
    tag: "garlic",
    via: "Vegetable biryani → garlic → allium",
    message: { en: "Contains garlic · 23C eats no onion or garlic", ja: "にんにくを含む · 23Cは玉ねぎ・にんにく不可", hi: "लहसुन है · 23C प्याज़-लहसुन नहीं खाते" },
  },
]

export const DASHI_CHECK: Fired[] = [
  {
    rule_id: "vegetarian.fish",
    tag: "bonito",
    via: "出汁 → bonito → fish",
    message: { en: "Dashi may be made with bonito · confirm with the kitchen", ja: "出汁に鰹節の可能性 · 厨房に確認" },
  },
]
