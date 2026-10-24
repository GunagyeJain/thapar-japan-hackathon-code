// m19 strings. Staff screen: short English; Hindi and Japanese where the copy can reach a passenger or the kitchen.
import type { Text } from "@/lib/types"

export const s = {
  title: { en: "Smart load", hi: "स्मार्ट लोड", ja: "スマートロード" },
  subtitle: {
    en: "Load for the cabin we'll actually have, and make the safety stock something that never goes bad.",
    hi: "जो केबिन सच में होगा, उसके लिए लोड करें; और सुरक्षित स्टॉक ऐसा रखें जो कभी ख़राब न हो।",
    ja: "実際の客室に合わせて積み、予備は傷まないものにします。",
  },
  familiesTitle: { en: "Demand by diet family", hi: "आहार परिवार के अनुसार माँग", ja: "食事タイプ別の需要" },
  familiesSub: {
    en: "Told us: passports on the flight date. Forecast: plus the passengers who told us nothing. On board: meals that suit them if they're served last.",
  },
  told: { en: "Told us", hi: "बताया", ja: "申告済み" },
  forecast: { en: "Forecast", hi: "अनुमान", ja: "予測" },
  p90: { en: "p90", hi: "p90", ja: "p90" },
  onBoard: { en: "On board for them", hi: "उनके लिए विमान में", ja: "機内の対応食" },
  runOut: { en: "Run-out risk", hi: "कमी का ख़तरा", ja: "不足リスク" },
  covered: { en: "Covered", hi: "पूरा", ja: "充足" },
  reserveTitle: { en: "Reserve size: the newsvendor rule", hi: "रिज़र्व का आकार", ja: "予備食の数（新聞売り子モデル）" },
  fresh: { en: "Fresh spare meal", hi: "ताज़ा अतिरिक्त भोजन", ja: "生鮮の予備食" },
  pouch: { en: "Retort pouch (universal plate)", hi: "रिटॉर्ट पाउच (यूनिवर्सल थाली)", ja: "レトルトパウチ（ユニバーサル・プレート）" },
  universalTitle: { en: "One plate for every diet on this route", hi: "इस रूट की हर डाइट के लिए एक थाली", ja: "この路線のすべての食事制限に合う一皿" },
  bentoTitle: { en: "Sealed-cup thali-bento spares", hi: "सीलबंद कप वाले थाली-बेंटो", ja: "密封カップ式ターリー弁当の予備" },
  assumptionsTitle: { en: "Assumptions", hi: "मान्यताएँ", ja: "前提" },
  loadError: { en: "Couldn't load the plan", hi: "योजना लोड नहीं हुई", ja: "計画を読み込めません" },
} satisfies Record<string, Text>
