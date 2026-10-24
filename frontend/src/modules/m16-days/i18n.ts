// m16 strings. Keep the English short so Hindi and Japanese fit.
import type { Text } from "@/lib/types"

export const s = {
  title: { en: "Your fast days", hi: "आपके व्रत के दिन", ja: "断食の日" },
  sub: {
    en: "Only the dates go to the airline.",
    hi: "एयरलाइन को सिर्फ़ तारीखें जाती हैं।",
    ja: "航空会社に送るのは日付だけです。",
  },
  find: { en: "Find your trip", hi: "अपनी यात्रा खोजें", ja: "旅程を検索" },
  pnr: { en: "Booking reference", hi: "बुकिंग संदर्भ", ja: "予約番号" },
  surname: { en: "Surname", hi: "उपनाम", ja: "姓" },
  notFound: { en: "No booking with that reference and surname.", hi: "इस संदर्भ और उपनाम से कोई बुकिंग नहीं मिली।", ja: "該当する予約が見つかりません。" },
  noProfile: {
    en: "Tell us what you eat first, then come back here.",
    hi: "पहले बताइए आप क्या खाते हैं, फिर यहाँ लौटिए।",
    ja: "先に食事の制限を登録してから、ここに戻ってください。",
  },
  noProfileAction: { en: "Say what you don't eat", hi: "बताइए क्या नहीं खाते", ja: "食べられないものを登録" },
  keep: { en: "Which fasts do you keep?", hi: "आप कौन-से व्रत रखते हैं?", ja: "守っている断食" },
  keepNote: {
    en: "Stays on this phone.",
    hi: "यह इसी फ़ोन पर रहता है।",
    ja: "この端末にのみ保存されます。",
  },
  legs: { en: "Your flights", hi: "आपकी उड़ानें", ja: "ご搭乗便" },
  fasting: { en: "I'm fasting on this flight", hi: "इस उड़ान पर मेरा व्रत है", ja: "この便の日は断食します" },
  fastDay: { en: "Fast day", hi: "व्रत का दिन", ja: "断食日" },
  usualDay: { en: "Usual meal", hi: "सामान्य भोजन", ja: "通常の食事" },
  meal: { en: "Meal", hi: "भोजन", ja: "お食事" },
  kitchen: { en: "Kitchen note", hi: "रसोई नोट", ja: "キッチンへの指示" },
  kitchenJa: { en: "Tokyo kitchen sees", hi: "टोक्यो की रसोई को", ja: "東京のキッチンへ" },
  cateredIn: { en: "Catered in", hi: "भोजन बनता है", ja: "調理地" },
  altDay: {
    en: "Some families fast a day later ({alt}). Untick if that's you.",
    hi: "कुछ परिवार एक दिन बाद ({alt}) व्रत रखते हैं। ऐसा हो तो हटा दें।",
    ja: "1日後（{alt}）に断食するご家庭もあります。該当する場合は外してください。",
  },
  unsaved: { en: "Not saved yet", hi: "अभी सहेजा नहीं", ja: "未保存" },
  save: { en: "Save fast days", hi: "व्रत के दिन सहेजें", ja: "断食日を保存" },
  saved: { en: "Saved. Only the dates were sent.", hi: "सहेजा गया। सिर्फ़ तारीखें भेजी गईं।", ja: "保存しました。送信したのは日付だけです。" },
  sends: { en: "Sends: {dates}", hi: "भेजा जाएगा: {dates}", ja: "送信内容：{dates}" },
  nothing: { en: "no dates", hi: "कोई तारीख नहीं", ja: "日付なし" },
} satisfies Record<string, Text>

export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "")
}
