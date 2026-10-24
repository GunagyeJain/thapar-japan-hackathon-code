// /rules page strings. English is short so Hindi and Japanese fit.
import type { Text } from "@/lib/types"

export const STR = {
  verdict: {
    SAFE: { en: "Safe", hi: "सुरक्षित", ja: "安全" },
    UNSAFE: { en: "Not safe", hi: "असुरक्षित", ja: "不可" },
    NEEDS_HUMAN: { en: "Needs a person", hi: "व्यक्ति जाँचे", ja: "要確認" },
  },
  noRuleFired: {
    en: "No rule fired: nothing in this dish is on the forbidden list.",
    hi: "कोई नियम लागू नहीं हुआ: इस व्यंजन में कुछ भी वर्जित नहीं है।",
    ja: "該当する規則はありません。この料理に禁止食材は含まれていません。",
  },
  allergy: { en: "allergy", hi: "एलर्जी", ja: "アレルギー" },
  pickDiet: {
    en: "Pick at least one diet to check the dish.",
    hi: "व्यंजन जाँचने के लिए कम से कम एक आहार चुनें।",
    ja: "料理を確認するには、食事規則を1つ以上選んでください。",
  },
} satisfies Record<string, Text | Record<string, Text>>
