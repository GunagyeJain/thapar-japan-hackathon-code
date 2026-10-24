// What passengers read: the answer the router sends after a change. English short so Hindi and Japanese fit.
// Staff-facing words are in labels.ts.
import type { Lang, Text } from "@/lib/types"

import type { Rung } from "./types"

/** Meal names inside the passenger messages, by meal code (plus the two onboard fallbacks). */
export const MEAL: Record<string, Text> = {
  VJML: { en: "Jain vegetarian meal (VJML)", hi: "जैन शाकाहारी भोजन (VJML)", ja: "ジャイナ菜食（VJML）" },
  AVML: { en: "vegetarian meal (AVML)", hi: "शाकाहारी भोजन (AVML)", ja: "ベジタリアン食（AVML）" },
  DBML: { en: "diabetic meal (DBML)", hi: "डायबिटिक भोजन (DBML)", ja: "糖尿病対応食（DBML）" },
  VGML: { en: "vegan meal (VGML)", hi: "वीगन भोजन (VGML)", ja: "ヴィーガン食（VGML）" },
  POUCH: { en: "sealed reserve meal", hi: "सीलबंद रिज़र्व भोजन", ja: "密封の予備食" },
  MAIN: { en: "vegetarian main", hi: "शाकाहारी मुख्य भोजन", ja: "ベジタリアンのメイン料理" },
  ANY: { en: "meal", hi: "भोजन", ja: "お食事" },
}

/** The answer per rung. {meal} and {seat} are filled in by fillMessage(). */
export const ANSWER: Record<Rung, Text> = {
  ssr_change: {
    en: "Your {meal} is booked for JL740 on 25 Oct, seat {seat}.",
    hi: "25 अक्टूबर की JL740 में सीट {seat} के लिए आपका {meal} बुक हो गया है।",
    ja: "10月25日JL740、座席{seat}に{meal}を手配しました。",
  },
  caterer_add: {
    en: "Your {meal} is on the caterer's list for JL740 on 25 Oct, seat {seat}.",
    hi: "25 अक्टूबर की JL740 के लिए आपका {meal} कैटरर की सूची में है, सीट {seat}।",
    ja: "10月25日JL740、座席{seat}の{meal}をケータリング発注に追加しました。",
  },
  standby_uplift: {
    en: "Your {meal} is being loaded for seat {seat} before take-off.",
    hi: "उड़ान से पहले सीट {seat} के लिए आपका {meal} लोड किया जा रहा है।",
    ja: "離陸前に座席{seat}へ{meal}を搭載します。",
  },
  lounge: {
    en: "Please collect your {meal} at the lounge before boarding.",
    hi: "बोर्डिंग से पहले लाउंज में अपना {meal} ले लें।",
    ja: "ご搭乗前にラウンジで{meal}をお受け取りください。",
  },
  airside_partner: {
    en: "Show this message at the airside restaurant for your {meal}.",
    hi: "अपना {meal} पाने के लिए यह संदेश एयरसाइड रेस्तराँ में दिखाएँ।",
    ja: "このメッセージを搭乗エリアのレストランで提示し、{meal}をお受け取りください。",
  },
  onboard_spare: {
    en: "A {meal} is set aside for you on board, seat {seat}. The crew will bring it.",
    hi: "विमान में सीट {seat} के लिए आपका {meal} अलग रखा गया है। क्रू आपको देगा।",
    ja: "機内で座席{seat}用に{meal}を確保しました。乗務員がお持ちします。",
  },
  noshow_release: {
    en: "A {meal} on board is kept for you, seat {seat}. The crew will bring it.",
    hi: "विमान में सीट {seat} के लिए एक {meal} रखा गया है। क्रू आपको देगा।",
    ja: "機内の{meal}を座席{seat}用に確保しました。乗務員がお持ちします。",
  },
  reserve_pouch: {
    en: "A {meal} that fits your rules is being heated for seat {seat}.",
    hi: "सीट {seat} के लिए आपके नियमों वाला {meal} गरम किया जा रहा है।",
    ja: "ご希望に合う{meal}を座席{seat}用に温めています。",
  },
  flex_swap: {
    en: "A {meal} is kept for you, seat {seat}. The crew will bring it.",
    hi: "सीट {seat} के लिए आपका {meal} रखा गया है। क्रू आपको देगा।",
    ja: "座席{seat}用に{meal}を確保しました。乗務員がお持ちします。",
  },
  sunrise_box: {
    en: "Your meal is packed to eat after sunrise, seat {seat}. The crew will tell you when.",
    hi: "आपका भोजन सूर्योदय के बाद खाने के लिए पैक है, सीट {seat}। समय क्रू बताएगा।",
    ja: "日の出後に召し上がれるようお食事をご用意しました（座席{seat}）。時間は乗務員がお知らせします。",
  },
  unmet: {
    en: "We're sorry: nothing on board fits your rules. The crew will offer what is safe and a voucher.",
    hi: "क्षमा करें: विमान में आपके नियमों के अनुसार कुछ नहीं बचा। क्रू सुरक्षित विकल्प और वाउचर देगा।",
    ja: "申し訳ありません。機内にご希望に合うお食事がありません。乗務員が安全なものとバウチャーをご案内します。",
  },
}

/** Fill {meal} and {seat} in every language of a template. */
export function fillMessage(template: Text, meal: Text, seat: string): Text {
  const fill = (lang: Lang): string | undefined => {
    const text = template[lang]
    if (text === undefined) return undefined
    return text.replaceAll("{meal}", meal[lang] ?? meal.en).replaceAll("{seat}", seat)
  }
  return { en: fill("en") ?? template.en, hi: fill("hi"), ja: fill("ja") }
}
