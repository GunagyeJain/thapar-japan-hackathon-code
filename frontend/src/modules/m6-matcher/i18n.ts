// Late-request strings. English short so Hindi and Japanese fit.
import type { Text } from "@/lib/types"
import type { Tier } from "@/modules/m6-matcher/types"

export const TIER_TEXT: Record<Tier, Text> = {
  spare_special: { en: "Spare special", hi: "अतिरिक्त विशेष", ja: "予備の特別食" },
  main_menu: { en: "Main menu", hi: "मुख्य मेन्यू", ja: "通常メニュー" },
  backup: { en: "Sealed backup", hi: "सीलबंद बैकअप", ja: "密封予備食" },
  voucher: { en: "Voucher", hi: "वाउचर", ja: "バウチャー" },
}

export const STR = {
  chosen: { en: "Reserve this meal", hi: "यह भोजन आरक्षित करें", ja: "この食事を確保" },
  considered: { en: "Everything else on board", hi: "विमान में बाकी सब", ja: "機内のほかの食事" },
  noneSafe: { en: "none safe", hi: "कोई सुरक्षित नहीं", ja: "安全なものなし" },
  voucherTitle: { en: "Airside meal voucher", hi: "हवाई अड्डे का भोजन वाउचर", ja: "空港内ミールバウチャー" },
  illustrative: { en: "Outlets are illustrative", hi: "दुकानें उदाहरण हैं", ja: "店舗は例示です" },
  safe: { en: "fits", hi: "ठीक", ja: "適合" },
} satisfies Record<string, Text>
