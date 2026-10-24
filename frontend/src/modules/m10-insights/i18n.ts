// /insights copy. English is short so Hindi and Japanese fit.
import type { Text } from "@/lib/types"

export const copy = {
  eyebrow: { en: "JL740 · DEL → NRT · 25 Oct", hi: "JL740 · DEL → NRT · 25 अक्टूबर", ja: "JL740 · DEL → NRT · 10月25日" },
  title: { en: "Insights", hi: "इनसाइट्स", ja: "インサイト" },
  subtitle: { en: "Every promise, hand-off by hand-off.", hi: "हर वादा, हर हैंड-ऑफ़ पर।", ja: "各お約束を受け渡しごとに。" },
  promises: { en: "Meal promises", hi: "भोजन वादे", ja: "機内食の約束" },
  seat: { en: "Seat", hi: "सीट", ja: "座席" },
  passenger: { en: "Passenger", hi: "यात्री", ja: "乗客" },
  code: { en: "Code", hi: "कोड", ja: "コード" },
  status: { en: "Status", hi: "स्थिति", ja: "状態" },
  journey: { en: "Journey C1 → C5", hi: "यात्रा C1 → C5", ja: "経過 C1 → C5" },
  passed: { en: "Checkpoints passed", hi: "पार किए चेकपॉइंट", ja: "通過したチェックポイント" },
  caught: { en: "Caught before the caterer's list", hi: "कैटरर सूची से पहले पकड़ा", ja: "ケータリング発注前に検知" },
  fixTime: { en: "Time to fix", hi: "ठीक करने में समय", ja: "復旧までの時間" },
  breakpoints: { en: "Breakpoints", hi: "ब्रेकपॉइंट", ja: "途切れ" },
  breakpoint: { en: "Breakpoint", hi: "ब्रेकपॉइंट", ja: "途切れ" },
  fixed: { en: "Fixed", hi: "ठीक हुआ", ja: "復旧" },
  notFixed: { en: "Not fixed yet", hi: "अभी ठीक नहीं", ja: "未復旧" },
  learns: { en: "What JAL learns", hi: "JAL क्या सीखता है", ja: "JALが得る知見" },
  held: { en: "Every hand-off held.", hi: "हर हैंड-ऑफ़ सही रहा।", ja: "すべての受け渡しが問題なし。" },
  noPromises: { en: "No meal promises yet", hi: "अभी कोई भोजन वादा नहीं", ja: "機内食の約束はまだありません" },
  noPromisesBody: { en: "Appears when a passenger saves food rules.", hi: "यात्री के भोजन नियम सेव करने पर दिखता है।", ja: "食事のルール保存後に表示されます。" },
  loadError: { en: "Couldn't load the timeline", hi: "टाइमलाइन लोड नहीं हुई", ja: "タイムラインを読み込めません" },
  retry: { en: "Try again", hi: "फिर से कोशिश करें", ja: "再試行" },
} satisfies Record<string, Text>

export const promiseStatus: Record<string, { status: "safe" | "warn" | "unsafe"; label: Text }> = {
  ok: { status: "safe", label: { en: "On track", hi: "सामान्य", ja: "順調" } },
  at_risk: { status: "warn", label: { en: "At risk", hi: "जोखिम में", ja: "要注意" } },
  broken: { status: "unsafe", label: { en: "Broken", hi: "टूटा", ja: "途切れ" } },
  fixed: { status: "safe", label: { en: "Fixed", hi: "ठीक हुआ", ja: "復旧" } },
}

export const sources: Record<string, string> = {
  passenger_app: "Passenger app · /p",
  judge_join: "Judge join · /j",
  pnl_adl_watcher: "PNL/ADL watcher",
  caterer: "Caterer portal",
  "crew tablet": "Crew tablet",
}

/** The one line Act 6 lands on: where it broke, how early it was caught, how fast it was fixed. */
export function lesson(where: string, at: string, caught: string | null, fix: string | null, by: string | null): Text {
  const en = [`${where} broke at ${at}.`]
  const hi = [`${where} ${at} पर टूटा।`]
  const ja = [`${where}が${at}に途切れました。`]
  if (caught) {
    en.push(`ThaliBento caught it ${caught} before the caterer's final list`)
    hi.push(`ThaliBento ने इसे कैटरर की अंतिम सूची से ${caught} पहले पकड़ा`)
    ja.push(`ThaliBentoはケータリング最終リストの${caught}前に検知し`)
  }
  if (fix) {
    en.push(`${caught ? "and" : "It was"} fixed ${fix} later${by ? ` by ${by}` : ""}.`)
    hi.push(`और ${fix} बाद${by ? ` ${by} ने` : ""} ठीक किया।`)
    ja.push(`${fix}後に${by ? `${by}が` : ""}復旧しました。`)
  } else if (caught) {
    en[en.length - 1] += "."
    hi[hi.length - 1] += "।"
    ja[ja.length - 1] += "ました。"
  }
  en.push("Today this hand-off has no alert: the drop shows up as a missing tray at the seat.")
  hi.push("आज इस हैंड-ऑफ़ पर कोई अलर्ट नहीं है: गड़बड़ी सीट पर ट्रे न मिलने पर ही दिखती है।")
  ja.push("現状この受け渡しには警告がなく、座席で食事が無いときに初めて発覚します。")
  return { en: en.join(" "), hi: hi.join(" "), ja: ja.join("") }
}
