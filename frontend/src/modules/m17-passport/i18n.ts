// Every string /chat shows, in English, Hindi and Japanese. Keep the English short so the others fit at 390 px.
// `{x}` placeholders are filled by fill().
import { t as pick } from "@/lib/i18n"
import type { Lang, Text } from "@/lib/types"

export { pick }

export function fill(text: Text, lang: Lang, vars: Record<string, string | number> = {}): string {
  return pick(text, lang).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

export const s = {
  header: { en: "JAL meals", hi: "JAL भोजन", ja: "JAL 機内食" },
  welcome: {
    en: "Tell us what you eat, in your own words, in any language. We'll turn it into food rules you can check.",
    hi: "बताइए आप क्या खाते हैं, अपने शब्दों में, किसी भी भाषा में। हम इसे खाने के नियमों में बदल देंगे, जिन्हें आप जाँच सकते हैं।",
    ja: "召し上がるものを、ご自分の言葉で、どの言語でもお知らせください。確認できる食事のルールにします。",
  },
  askBooking: {
    en: "First, your booking: send the booking reference and surname, e.g. 6XK2QP SHARMA.",
    hi: "पहले आपकी बुकिंग: बुकिंग रेफ़रेंस और उपनाम भेजिए, जैसे 6XK2QP SHARMA।",
    ja: "まずご予約を確認します。予約番号と姓を送ってください（例：6XK2QP SHARMA）。",
  },
  bookingFormat: {
    en: "Send the 6-character booking reference and your surname, e.g. 6XK2QP SHARMA.",
    hi: "6 अक्षरों का बुकिंग रेफ़रेंस और अपना उपनाम भेजिए, जैसे 6XK2QP SHARMA।",
    ja: "6桁の予約番号と姓を送ってください（例：6XK2QP SHARMA）。",
  },
  notFound: {
    en: "We couldn't find that booking. Check the reference and the surname on your ticket.",
    hi: "यह बुकिंग नहीं मिली। टिकट पर लिखा रेफ़रेंस और उपनाम दोबारा देखें।",
    ja: "ご予約が見つかりません。航空券の予約番号と姓をご確認ください。",
  },
  found: { en: "Found you: {name}, seat {seat}.", hi: "आपकी बुकिंग मिल गई: {name}, सीट {seat}।", ja: "ご予約を確認しました：{name} 様、座席 {seat}。" },
  tryThese: { en: "Tap one to try", hi: "आज़माने के लिए किसी एक पर टैप करें", ja: "タップして試せます" },
  placeholder: { en: "Type what you eat…", hi: "आप क्या खाते हैं, लिखिए…", ja: "食事について入力…" },
  placeholderBooking: { en: "6XK2QP SHARMA", hi: "6XK2QP SHARMA", ja: "6XK2QP SHARMA" },
  send: { en: "Send", hi: "भेजें", ja: "送信" },
  speak: { en: "Speak", hi: "बोलें", ja: "音声入力" },
  stop: { en: "Stop listening", hi: "सुनना बंद करें", ja: "音声入力を停止" },
  listening: { en: "Listening…", hi: "सुन रहे हैं…", ja: "聞き取り中…" },
  speechLang: { en: "Speech language", hi: "बोलने की भाषा", ja: "音声の言語" },
  reading: { en: "Reading your message…", hi: "आपका संदेश पढ़ रहे हैं…", ja: "メッセージを読み取っています…" },
  error: {
    en: "Something went wrong. Check your connection and try again.",
    hi: "कुछ गड़बड़ हो गई। अपना कनेक्शन जाँचें और फिर से कोशिश करें।",
    ja: "エラーが発生しました。接続を確認して、もう一度お試しください。",
  },
  retry: { en: "Try again", hi: "फिर से कोशिश करें", ja: "もう一度" },
  you: { en: "You", hi: "आप", ja: "あなた" },

  card: {
    title: { en: "Here's what we understood", hi: "हमने यह समझा", ja: "このように理解しました" },
    never: { en: "Never", hi: "कभी नहीं", ja: "食べられない" },
    medical: { en: "Medical", hi: "स्वास्थ्य के कारण", ja: "医療上の制限" },
    prefer: { en: "Prefer not", hi: "पसंद नहीं", ja: "できれば避けたい" },
    allergy: { en: "Allergy", hi: "एलर्जी", ja: "アレルギー" },
    fine: { en: "Fine to eat", hi: "खा सकते हैं", ja: "食べられる" },
    days: { en: "On some days", hi: "कुछ दिनों पर", ja: "特定の日" },
    willAsk: { en: "we'll ask before each one", hi: "हर बार पहले पूछेंगे", ja: "毎回事前に確認します" },
    youChose: { en: "you chose this", hi: "आपने चुना", ja: "ご自身で選択" },
    model: { en: "read by the extraction model", hi: "एक्सट्रैक्शन मॉडल ने पढ़ा", ja: "抽出モデルが読み取り" },
    flexTitle: { en: "Flexible on mains?", hi: "मेन कोर्स में लचीले हैं?", ja: "メインの料理は柔軟に選べますか？" },
    flexBody: {
      en: "If someone with a strict need is short, we may swap your main and add 300 miles.",
      hi: "अगर किसी सख़्त ज़रूरत वाले यात्री का खाना कम पड़े, तो हम आपका मेन कोर्स बदल सकते हैं और 300 मील जोड़ेंगे।",
      ja: "厳しい制限のあるお客様の分が足りない場合、メインを交換させていただくことがあります。300マイルを加算します。",
    },
    unclear: {
      en: "We didn't understand: {words}. Say it another way, or tap Change.",
      hi: "हम समझ नहीं पाए: {words}। दूसरे शब्दों में लिखिए, या बदलें पर टैप करें।",
      ja: "理解できませんでした：{words}。別の言い方で送るか、「変更」をタップしてください。",
    },
    nothing: {
      en: "We couldn't find any food rules in that. Try \"no onion, no garlic\" or \"Jain\".",
      hi: "इसमें हमें खाने का कोई नियम नहीं मिला। जैसे लिखिए: \"प्याज़ लहसुन नहीं\" या \"जैन\"।",
      ja: "食事のルールが見つかりませんでした。「玉ねぎ・にんにく抜き」のように送ってください。",
    },
    noRules: { en: "No food rules: you eat anything.", hi: "कोई नियम नहीं: आप सब कुछ खाते हैं।", ja: "制限なし：何でも召し上がれます。" },
    right: { en: "That's right", hi: "यह सही है", ja: "これで合っています" },
    change: { en: "Change", hi: "बदलें", ja: "変更" },
    saving: { en: "Saving…", hi: "सेव हो रहा है…", ja: "保存中…" },
    saved: { en: "Saved", hi: "सेव हो गया", ja: "保存しました" },
    editTitle: { en: "Change your food rules", hi: "अपने खाने के नियम बदलें", ja: "食事のルールを変更" },
    editSub: {
      en: "Tick what you don't eat. Fast days stay as you said them.",
      hi: "जो नहीं खाते, उस पर टिक करें। व्रत के दिन वैसे ही रहेंगे।",
      ja: "食べられないものにチェックしてください。断食の日はそのままです。",
    },
    editDone: { en: "Use these", hi: "यही रखें", ja: "これを使う" },
  },

  plan: {
    code: { en: "{flight}, {date}: we've ordered {code} for you.", hi: "{flight}, {date}: आपके लिए {code} ऑर्डर कर दिया है।", ja: "{flight}便（{date}）：{code} を手配しました。" },
    main: {
      en: "{flight}, {date}: no special meal needed. We'll hold this main for you: {dish}.",
      hi: "{flight}, {date}: विशेष भोजन की ज़रूरत नहीं। हम आपके लिए यह मेन कोर्स रखेंगे: {dish}।",
      ja: "{flight}便（{date}）：特別食は不要です。こちらのメインをお取り置きします：{dish}",
    },
    none: {
      en: "{flight}, {date}: no special meal needed. Choose anything from the trolley.",
      hi: "{flight}, {date}: विशेष भोजन की ज़रूरत नहीं। ट्रॉली से कुछ भी चुनें।",
      ja: "{flight}便（{date}）：特別食は不要です。カートからお好きなものをお選びください。",
    },
    kitchen: { en: "Kitchen note", hi: "रसोई नोट", ja: "キッチンへの指示" },
    trayLabel: { en: "Your tray label", hi: "आपकी ट्रे का लेबल", ja: "トレーのラベル" },
    others: {
      en: "Anyone else on your booking? Send them this link so they can tell us too.",
      hi: "आपकी बुकिंग में और कोई है? उन्हें यह लिंक भेजिए, ताकि वे भी बता सकें।",
      ja: "同じご予約の方にもこのリンクを送って、お食事を教えていただけます。",
    },
    allTold: {
      en: "Everyone on your booking has told us what they eat.",
      hi: "आपकी बुकिंग के सभी यात्रियों ने बता दिया है कि वे क्या खाते हैं।",
      ja: "同じご予約の皆さまからお食事の情報をいただいています。",
    },
    sendLink: { en: "Send link", hi: "लिंक भेजें", ja: "リンクを送る" },
    copied: { en: "Link copied", hi: "लिंक कॉपी हो गया", ja: "リンクをコピーしました" },
    told: { en: "Told us", hi: "बता चुके", ja: "回答済み" },
  },

  radar: {
    answered: { en: "Answered", hi: "जवाब दिया", ja: "回答済み" },
  },

  examples: [
    { text: "pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon", tag: { en: "Hinglish", hi: "हिंग्लिश", ja: "ヒングリッシュ" } },
    { text: "मैं अंडा खाता हूँ पर मछली नहीं", tag: { en: "Hindi", hi: "हिन्दी", ja: "ヒンディー語" } },
    { text: "肉と魚は食べません", tag: { en: "Japanese", hi: "जापानी", ja: "日本語" } },
    { text: "Vegan, allergic to peanuts", tag: { en: "English", hi: "अंग्रेज़ी", ja: "英語" } },
  ] satisfies { text: string; tag: Text }[],
}

/** Speech recognition languages offered next to the mic. */
export const SPEECH_LANGS: { id: string; label: string }[] = [
  { id: "hi-IN", label: "हिन्दी" },
  { id: "en-IN", label: "English" },
  { id: "ja-JP", label: "日本語" },
  { id: "ta-IN", label: "தமிழ்" },
]

const LOCALE: Record<Lang, string> = { en: "en-GB", hi: "hi-IN", ja: "ja-JP" }

/** "Sun 25 Oct" in the page language, from an ISO date. */
export function dayLabel(date: string, lang: Lang): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short" })
}
