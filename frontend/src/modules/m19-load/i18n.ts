// m19 strings. Staff screen: short English; Hindi and Japanese where the copy can reach a passenger or the kitchen.
import type { Text } from "@/lib/types"

export const s = {
  title: { en: "Smart load", hi: "स्मार्ट लोड", ja: "スマートロード" },
  subtitle: { en: "Load for the cabin, not the codes", hi: "कोड नहीं, केबिन के हिसाब से लोड", ja: "コードではなく客室に合わせて積む" },
  familiesTitle: { en: "Demand by diet family", hi: "आहार परिवार के अनुसार माँग", ja: "食事タイプ別の需要" },
  told: { en: "Told us", hi: "बताया", ja: "申告済み" },
  forecast: { en: "Forecast", hi: "अनुमान", ja: "予測" },
  p90: { en: "p90", hi: "p90", ja: "p90" },
  onBoard: { en: "On board for them", hi: "उनके लिए विमान में", ja: "機内の対応食" },
  runOut: { en: "Run-out risk", hi: "कमी का ख़तरा", ja: "不足リスク" },
  covered: { en: "Covered", hi: "पूरा", ja: "充足" },
  reserveTitle: { en: "Reserve size", hi: "रिज़र्व का आकार", ja: "予備食の数" },
  fresh: { en: "Fresh spare meal", hi: "ताज़ा अतिरिक्त भोजन", ja: "生鮮の予備食" },
  pouch: { en: "Retort pouch (universal plate)", hi: "रिटॉर्ट पाउच (यूनिवर्सल थाली)", ja: "レトルトパウチ（ユニバーサル・プレート）" },
  universalTitle: { en: "One plate for every diet on this route", hi: "इस रूट की हर डाइट के लिए एक थाली", ja: "この路線のすべての食事制限に合う一皿" },
  bentoTitle: { en: "Sealed-cup spares", hi: "सीलबंद कप", ja: "密封カップの予備" },
  howSized: { en: "How it's sized", hi: "आकार कैसे तय हुआ", ja: "数の決め方" },
  howCups: { en: "How the cups are picked", hi: "कप कैसे चुने गए", ja: "カップの選び方" },
  assumptionsTitle: { en: "Assumptions", hi: "मान्यताएँ", ja: "前提" },
  loadError: { en: "Couldn't load the plan", hi: "योजना लोड नहीं हुई", ja: "計画を読み込めません" },
} satisfies Record<string, Text>
