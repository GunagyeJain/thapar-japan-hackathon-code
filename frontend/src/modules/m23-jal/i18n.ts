// m23 strings: the concept page in JAL's look. English and Japanese, the two languages JAL's own site leads with.
import type { Lang, Text } from "@/lib/types"

export type PageLang = Extract<Lang, "en" | "ja">

export const s = {
  bannerTitle: { en: "Concept demo · not a Japan Airlines website", ja: "コンセプトデモ · 日本航空の公式サイトではありません" },
  bannerBody: {
    en: "How ThaliBento could sit inside JAL's Manage booking. No login, no payment, no personal data: the booking is a sample passenger from our JL740 demo.",
    ja: "ThaliBentoがJALの予約確認に入った場合のイメージです。ログイン・支払い・個人情報の入力はありません。予約はJL740デモのサンプル乗客です。",
  },
  concept: { en: "Concept", ja: "コンセプト" },
  navBook: { en: "Book", ja: "予約" },
  navManage: { en: "Manage booking", ja: "予約確認" },
  navCheckin: { en: "Check-in", ja: "チェックイン" },
  navStatus: { en: "Flight status", ja: "運航状況" },
  crumbMeal: { en: "Special meal", ja: "特別機内食" },
  title: { en: "Special meal", ja: "特別機内食" },
  subtitle: { en: "{flight} · Delhi → Tokyo Narita · {date}", ja: "{flight} · デリー → 東京（成田）· {date}" },

  ref: { en: "Booking reference", ja: "予約番号" },
  depart: { en: "Delhi", ja: "デリー" },
  arrive: { en: "Tokyo Narita", ja: "東京（成田）" },
  economy: { en: "Economy", ja: "エコノミークラス" },
  business: { en: "Business", ja: "ビジネスクラス" },
  passengers: { en: "Passengers", ja: "ご搭乗者" },
  seat: { en: "Seat", ja: "座席" },
  meal: { en: "Special meal", ja: "特別機内食" },
  noMeal: { en: "None requested", ja: "リクエストなし" },
  viaThali: { en: "from ThaliBento", ja: "ThaliBentoから" },
  passport: { en: "ThaliBento passport", ja: "ThaliBentoパスポート" },
  passportYes: { en: "Told us", ja: "登録済み" },
  passportNo: { en: "Not yet", ja: "未登録" },

  formTitle: { en: "Choose a special meal", ja: "特別機内食を選ぶ" },
  formToday: { en: "Today's form: one meal code per passenger.", ja: "現在のフォーム：お一人につきミールコードは1つ。" },
  formFor: { en: "For", ja: "対象" },
  deadlines: { en: "Request by", ja: "リクエスト期限" },
  deadlineStandard: { en: "Special meals", ja: "特別機内食" },
  deadlineLongLead: { en: "Kosher and minimal-allergen meals", ja: "コーシャミール・アレルギー対応食" },
  deadlineHours: { en: "{h} h before departure ({p} h by phone)", ja: "出発の{h}時間前まで（お電話は{p}時間前）" },
  open: { en: "Open", ja: "受付中" },
  closed: { en: "Closed", ja: "締切" },
  closedAt: { en: "closed {time}", ja: "{time}に締切" },
  source: { en: "Deadlines: JAL's special-meal page", ja: "期限の出典：JAL特別機内食のページ" },
  request: { en: "Request meal", ja: "リクエストする" },
  requestedNote: {
    en: "This concept sends nothing to JAL. It shows today's limit: one fixed code, and no way to say \"veg on Tuesdays\", a Navratri fast, or no onion-garlic.",
    ja: "このコンセプトはJALに何も送信しません。現在の限界を示しています：コードは1つだけで、「火曜日はベジ」、ナヴラトリの断食、玉ねぎ・にんにく抜きは伝えられません。",
  },
  formClosed: {
    en: "Requests for this flight closed at {time}. From here, today's only channel is the crew on board.",
    ja: "この便のリクエストは{time}に締め切られました。以降の窓口は、現在は機内の客室乗務員だけです。",
  },
  cantSay: { en: "One code can't say", ja: "コード1つでは伝えられないこと" },
  cant1: { en: "vegetarian only on certain days", ja: "特定の曜日だけベジタリアン" },
  cant2: { en: "a fast that falls on the flight date", ja: "搭乗日に重なる断食" },
  cant3: { en: "no onion, no garlic", ja: "玉ねぎ・にんにく抜き" },
  cant4: { en: "what the rest of the booking eats", ja: "同じ予約の他の方の食事" },

  panelEyebrow: { en: "New · ThaliBento", ja: "新機能 · ThaliBento" },
  panelTitle: { en: "Tell us in your own words", ja: "ご自身の言葉で伝える" },
  panelBody: {
    en: "Type or speak, in any language. The rules turn it into the right code and a kitchen note.",
    ja: "入力でも音声でも、どの言語でも。ルールが正しいコードとキッチンへのメモに変えます。",
  },
  point1: { en: "Food rules, not religion: we keep what you don't eat and the dates, never why.", ja: "宗教ではなく食のルール：食べないものと日付だけを保存し、理由は保存しません。" },
  point2: { en: "Asks before your fast days, a day ahead of the cutoff.", ja: "断食日の前に、締切より前にお尋ねします。" },
  point3: { en: "Keeps listening after the cutoff: late changes go to the Change Router.", ja: "締切後も受け付け：遅い変更はChange Routerへ。" },
  stillListening: { en: "Still listening", ja: "受付継続中" },
  afterCutoff: {
    en: "The kitchen's list has closed, but ThaliBento keeps listening: a change now goes to the Change Router, which takes the best fix still possible.",
    ja: "キッチンのリストは締め切られましたが、ThaliBentoは受け付けを続けます。今の変更はChange Routerに送られ、その時点で可能な最善の対応をとります。",
  },
  frameTitle: { en: "ThaliBento meal chat for {name}", ja: "{name}様のThaliBento機内食チャット" },
  openTab: { en: "Open in a new tab", ja: "新しいタブで開く" },

  noBooking: { en: "No booking found", ja: "予約が見つかりません" },
  retry: { en: "Retry", ja: "再試行" },
  backToSample: { en: "Show the sample booking", ja: "サンプルの予約を表示" },
  footer1: {
    en: "A concept for JAL-PS-01 by Team Caffeinated Nerds. Not affiliated with or endorsed by Japan Airlines.",
    ja: "Team Caffeinated NerdsによるJAL-PS-01のコンセプトです。日本航空とは提携・承認の関係にありません。",
  },
  footer2: {
    en: "Meal codes and deadlines follow JAL's public special-meal page; the flight and passengers are sample data.",
    ja: "ミールコードと期限はJALの公開ページに基づき、便と乗客はサンプルデータです。",
  },
} satisfies Record<string, Text>

/** The string for `lang` with {name} placeholders filled in. */
export function tr(text: Text, lang: PageLang, values: Record<string, string | number> = {}): string {
  const raw = text[lang] ?? text.en
  return raw.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

const DATE_FORMATS: Record<PageLang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric" }),
  ja: new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Kolkata", year: "numeric", month: "long", day: "numeric", weekday: "short" }),
}
const WHEN_FORMATS: Record<PageLang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  ja: new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Kolkata", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
}

/** "Sun 25 Oct 2026" / "2026年10月25日(日)", on the Delhi calendar. */
export function fmtDay(iso: string, lang: PageLang): string {
  return DATE_FORMATS[lang].format(new Date(iso))
}

/** "Sat 24 Oct, 03:35 IST" / "10月24日(土) 03:35 IST". */
export function fmtWhen(iso: string, lang: PageLang): string {
  return `${WHEN_FORMATS[lang].format(new Date(iso))} IST`
}
