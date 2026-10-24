// Every string m3 shows, in English, Hindi and Japanese. Keep the English short so the others fit at 390 px.
// `{x}` placeholders are filled by fill().
import { t as pick } from "@/lib/i18n"
import type { Lang, Text } from "@/lib/types"

export { pick }

/** Japanese has no spaces, so mark where a short label may wrap: before "（" and after "・".
 * Pair with the `jaWrap` class so the browser breaks only there (and anywhere as a last resort). */
export function breakable(text: string, lang: Lang): string {
  return lang === "ja" ? text.replace(/（/g, "\u200B（").replace(/・/g, "・\u200B") : text
}

export const jaWrap = "[word-break:keep-all] [overflow-wrap:anywhere]"

export function fill(text: Text, lang: Lang, vars: Record<string, string | number> = {}): string {
  return pick(text, lang).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

const SEP: Record<Lang, string> = { en: ", ", hi: ", ", ja: "、" }

function joinTexts(items: Text[], lang: Lang, sep = SEP[lang]): string {
  return items.map((t) => pick(t, lang)).join(sep)
}

/** Build a Text from a pattern per language and a list of Texts. */
function listText(pattern: Text, items: Text[], sep?: Partial<Record<Lang, string>>): Text {
  const out: Text = { en: "" }
  for (const lang of ["en", "hi", "ja"] as Lang[]) {
    out[lang] = fill(pattern, lang, { list: joinTexts(items, lang, sep?.[lang]) })
  }
  return out
}

export const s = {
  common: {
    next: { en: "Next", hi: "आगे", ja: "次へ" },
    back: { en: "Back", hi: "पीछे", ja: "戻る" },
    retry: { en: "Try again", hi: "फिर से कोशिश करें", ja: "もう一度" },
    loading: { en: "Loading", hi: "लोड हो रहा है", ja: "読み込み中" },
    error: {
      en: "Something went wrong. Check your connection and try again.",
      hi: "कुछ गड़बड़ हो गई। अपना इंटरनेट कनेक्शन जाँचें और फिर से कोशिश करें।",
      ja: "エラーが発生しました。接続を確認して、もう一度お試しください。",
    },
    step: { en: "Step {n} of {total}", hi: "चरण {n} / {total}", ja: "ステップ {n} / {total}" },
  },

  pass: {
    flight: { en: "Flight", hi: "फ़्लाइट", ja: "便名" },
    date: { en: "Date", hi: "तारीख़", ja: "日付" },
    seat: { en: "Seat", hi: "सीट", ja: "座席" },
    meal: { en: "Meal", hi: "भोजन", ja: "機内食" },
    passenger: { en: "Passenger", hi: "यात्री", ja: "お客様" },
    mealUnknown: { en: "Not set", hi: "तय नहीं", ja: "未設定" },
  },

  lookup: {
    title: { en: "Find your booking", hi: "अपनी बुकिंग खोजें", ja: "ご予約を検索" },
    pnr: { en: "Booking reference (PNR)", hi: "बुकिंग रेफ़रेंस (PNR)", ja: "予約番号（PNR）" },
    surname: { en: "Surname", hi: "उपनाम (सरनेम)", ja: "姓（ローマ字）" },
    hint: { en: "Demo booking: 6XK2QP · SHARMA", hi: "डेमो बुकिंग: 6XK2QP · SHARMA", ja: "デモ用：6XK2QP · SHARMA" },
    submit: { en: "Find booking", hi: "बुकिंग खोजें", ja: "検索" },
    searching: { en: "Looking up your booking", hi: "आपकी बुकिंग खोजी जा रही है", ja: "ご予約を検索しています" },
    notFound: {
      en: "We couldn't find that booking. Check the 6-character reference and the surname on your ticket.",
      hi: "यह बुकिंग नहीं मिली। टिकट पर लिखा 6 अक्षरों का रेफ़रेंस और उपनाम दोबारा देखें।",
      ja: "ご予約が見つかりません。航空券に記載の6桁の予約番号と姓をご確認ください。",
    },
  },

  language: {
    title: { en: "Choose your language", hi: "अपनी भाषा चुनें", ja: "言語を選択" },
  },

  consent: {
    title: { en: "Your food rules, your choice", hi: "आपके खाने के नियम, आपकी मर्ज़ी", ja: "食事のルールの取り扱い" },
    thisTrip: { en: "Use them for this trip", hi: "इस यात्रा के लिए इस्तेमाल करें", ja: "今回の旅行に使う" },
    saveProfile: { en: "Save them for next time", hi: "अगली बार के लिए सेव करें", ja: "次回のために保存する" },
    shareCaterer: { en: "Share them with the caterer", hi: "केटरर के साथ साझा करें", ja: "機内食会社と共有する" },
    notice: {
      en: "Your food rules go to JAL and its caterer in Delhi and Tokyo. We store food rules, not religion. Deleted after your trip.",
      hi: "आपके खाने के नियम JAL और दिल्ली व टोक्यो में उसके केटरर तक जाते हैं। हम खाने के नियम रखते हैं, धर्म नहीं। यात्रा के बाद ये मिटा दिए जाते हैं।",
      ja: "食事のルールはJALと、デリーおよび東京の機内食会社に送られます。保存するのは食事のルールのみで、宗教は保存しません。旅行後に削除されます。",
    },
    needThisTrip: {
      en: "Turn on \"Use them for this trip\" so we can order your meal.",
      hi: "भोजन ऑर्डर करने के लिए \"इस यात्रा के लिए इस्तेमाल करें\" चालू करें।",
      ja: "機内食を手配するには「今回の旅行に使う」をオンにしてください。",
    },
    agree: { en: "Continue", hi: "आगे बढ़ें", ja: "続ける" },
  },

  picker: {
    title: { en: "Tell us about your food", hi: "अपने खाने के बारे में बताएँ", ja: "お食事について教えてください" },
    dietTitle: { en: "Do you follow a diet?", hi: "क्या आप किसी खास आहार का पालन करते हैं?", ja: "特定の食事スタイルはありますか？" },
    dietSub: {
      en: "Optional. Tap one and we tick its foods below for you.",
      hi: "ज़रूरी नहीं। एक चुनें, हम नीचे उससे जुड़ी चीज़ों पर अपने आप निशान लगा देंगे।",
      ja: "任意です。選ぶと、下の食材に自動でチェックが入ります。",
    },
    foodsTitle: { en: "What can't you eat?", hi: "आप क्या नहीं खा सकते?", ja: "召し上がれない食材は？" },
    foodsSub: { en: "Tick every food you don't eat.", hi: "जो भी नहीं खाते, उन सब पर निशान लगाएँ।", ja: "召し上がれない食材をすべて選んでください。" },
    allergensTitle: { en: "Any food allergies?", hi: "क्या आपको किसी खाने से एलर्जी है?", ja: "食物アレルギーはありますか？" },
    allergensSub: { en: "The kitchen keeps these out completely.", hi: "किचन इन्हें आपके खाने से पूरी तरह दूर रखेगा।", ja: "厨房でこれらを完全に取り除きます。" },
    yourAnswer: { en: "Your answer so far", hi: "अब तक आपका जवाब", ja: "現在のご回答" },
    needFood: {
      en: "Tick at least one food you can't eat, or choose a diet.",
      hi: "कम से कम एक खाना चुनें जो आप नहीं खा सकते, या कोई आहार चुनें।",
      ja: "召し上がれない食材を1つ以上、または食事スタイルを選んでください。",
    },
    sub: {
      en: "Tap one that fits, then untick anything that doesn't apply.",
      hi: "जो आप पर लागू हो उसे चुनें, फिर जो लागू न हो उसका निशान हटा दें।",
      ja: "近いものを選び、当てはまらない項目のチェックを外してください。",
    },
    presets: { en: "Quick picks", hi: "जल्दी चुनें", ja: "よく選ばれるもの" },
    groups: { en: "I don't eat", hi: "मैं नहीं खाता/खाती", ja: "食べられないもの" },
    allergens: { en: "Allergies", hi: "एलर्जी", ja: "アレルギー" },
    allAllergens: { en: "Show all {n}", hi: "सभी {n} दिखाएँ", ja: "全{n}品目を表示" },
    fewerAllergens: { en: "Show fewer", hi: "कम दिखाएँ", ja: "表示を減らす" },
    nothing: {
      en: "Nothing ticked yet. Tap a quick pick or tick what you don't eat.",
      hi: "अभी कुछ नहीं चुना। ऊपर से चुनें या जो नहीं खाते उस पर निशान लगाएँ।",
      ja: "まだ選択されていません。上から選ぶか、食べられないものにチェックしてください。",
    },
  },

  summary: {
    title: { en: "Is this right?", hi: "क्या यह सही है?", ja: "こちらでよろしいですか？" },
    yes: { en: "Yes, that's right", hi: "हाँ, सही है", ja: "はい、これで大丈夫です" },
    change: { en: "Change", hi: "बदलें", ja: "変更する" },
  },

  result: {
    title: { en: "Your meal", hi: "आपका भोजन", ja: "お客様の機内食" },
    working: { en: "Finding the right meal code", hi: "सही मील कोड खोजा जा रहा है", ja: "最適な機内食コードを探しています" },
    recommended: { en: "Recommended", hi: "सुझाया गया", ja: "おすすめ" },
    kitchenNote: { en: "Kitchen note", hi: "किचन के लिए नोट", ja: "キッチンへの指示" },
    noNote: { en: "No note needed", hi: "नोट की ज़रूरत नहीं", ja: "指示は不要" },
    trayLabel: { en: "Your tray label", hi: "आपकी ट्रे का लेबल", ja: "トレーのラベル" },
    alternative: { en: "Also possible", hi: "यह भी हो सकता है", ja: "ほかの選択肢" },
    loses: { en: "Leaves out food you eat: {list}", hi: "इसमें वह नहीं होगा जो आप खाते हैं: {list}", ja: "召し上がれる食材も除かれます：{list}" },
    gaps: { en: "Needs a kitchen note for: {list}", hi: "इनके लिए किचन नोट ज़रूरी: {list}", ja: "キッチンへの指示が必要：{list}" },
    clashTitle: { en: "Your booking has the wrong meal", hi: "आपकी बुकिंग में गलत भोजन है", ja: "ご予約の機内食が合っていません" },
    clash: {
      en: "Your booking has {booked}. It contains {list}. We'll change it to {suggested}.",
      hi: "आपकी बुकिंग में {booked} है। इसमें {list} होता है। हम इसे {suggested} में बदल देंगे।",
      ja: "ご予約は{booked}です。{list}が含まれます。{suggested}に変更します。",
    },
    choose: { en: "Choose {code} instead", hi: "इसकी जगह {code} चुनें", ja: "{code}に変更する" },
    confirm: { en: "Confirm {code}", hi: "{code} पक्का करें", ja: "{code}で確定する" },
    saving: { en: "Saving your meal", hi: "आपका भोजन सेव हो रहा है", ja: "保存しています" },
  },

  promise: {
    title: { en: "Your meal promise", hi: "आपके भोजन का वादा", ja: "機内食のお約束" },
    sub: {
      en: "We check it at every hand-off: booking, caterer list, galley and your seat.",
      hi: "हर पड़ाव पर हम इसकी जाँच करते हैं: बुकिंग, केटरर की सूची, गैली और आपकी सीट।",
      ja: "予約、機内食会社のリスト、ギャレー、お座席の各段階で確認します。",
    },
    updates: { en: "Updates", hi: "अपडेट", ja: "お知らせ" },
    change: { en: "Change my answers", hi: "अपने जवाब बदलें", ja: "回答を変更する" },
    statusLabel: { en: "Promise status", hi: "वादे की स्थिति", ja: "お約束の状況" },
    empty: {
      en: "No updates yet. If anything changes before your flight, it shows up here.",
      hi: "अभी कोई अपडेट नहीं। फ़्लाइट से पहले कुछ बदला तो यहाँ दिखेगा।",
      ja: "お知らせはまだありません。出発前に変更があればここに表示されます。",
    },
  },

  judge: {
    title: { en: "Join flight JL740", hi: "फ़्लाइट JL740 से जुड़ें", ja: "JL740便に参加" },
    sub: {
      en: "Tell us what you can't eat. You get a seat on JL740, and we find you a safe meal on board.",
      hi: "बताइए आप क्या नहीं खा सकते। आपको JL740 पर सीट मिलेगी और हम विमान में आपके लिए सुरक्षित भोजन खोजेंगे।",
      ja: "召し上がれないものを教えてください。JL740の座席をご用意し、機内で安全なお食事をお探しします。",
    },
    name: { en: "Your name (shown to the crew)", hi: "आपका नाम (क्रू को दिखेगा)", ja: "お名前（乗務員に表示）" },
    namePlaceholder: { en: "Judge 1", hi: "जज 1", ja: "審査員 1" },
    join: { en: "Join and get a seat", hi: "जुड़ें और सीट पाएँ", ja: "参加して座席を取る" },
    saveNew: { en: "Save my new answers", hi: "नए जवाब सेव करें", ja: "新しい回答を保存" },
    cancel: { en: "Cancel", hi: "रद्द करें", ja: "キャンセル" },
    tryAgain: { en: "Try a different diet", hi: "कोई और आहार आज़माएँ", ja: "別の食事で試す" },
    tryAgainSub: {
      en: "You keep seat {seat}. We'll find a meal for your new answers.",
      hi: "आपकी सीट {seat} वही रहेगी। हम नए जवाबों के लिए भोजन खोजेंगे।",
      ja: "座席{seat}はそのままです。新しい回答に合う食事をお探しします。",
    },
    editTitle: { en: "Change your answers", hi: "अपने जवाब बदलें", ja: "回答を変更" },
    joining: { en: "Getting your seat", hi: "आपकी सीट तय हो रही है", ja: "座席を確保しています" },
    full: {
      en: "All demo seats are taken. Watch the crew tablet on the big screen.",
      hi: "डेमो की सभी सीटें भर गई हैं। बड़ी स्क्रीन पर क्रू टैबलेट देखें।",
      ja: "デモ用の座席はすべて埋まりました。大画面の乗務員タブレットをご覧ください。",
    },
    matching: { en: "Checking every meal on board", hi: "विमान का हर भोजन जाँचा जा रहा है", ja: "機内のすべての食事を確認しています" },
    crewWillConfirm: {
      en: "Crew will confirm your meal on board.",
      hi: "क्रू विमान में आपके भोजन की पुष्टि करेगा।",
      ja: "機内で乗務員がお食事を確認します。",
    },
  },
} satisfies Record<string, Record<string, Text>>

export const promiseStatus: Record<"ok" | "fixed" | "at_risk" | "broken", Text> = {
  ok: { en: "On track", hi: "सब ठीक", ja: "問題なし" },
  fixed: { en: "Fixed", hi: "ठीक कर दिया गया", ja: "修正済み" },
  at_risk: { en: "At risk", hi: "जोखिम में", ja: "要注意" },
  broken: { en: "Broken", hi: "टूट गया", ja: "未対応の問題あり" },
}

/** Summary chip text. Short nouns are joined into one chip for meat, fish and egg. */
const CORE_NOUN: Record<string, Text> = {
  meat: { en: "meat", hi: "मांस", ja: "肉" },
  seafood: { en: "fish", hi: "मछली", ja: "魚" },
  egg: { en: "egg", hi: "अंडा", ja: "卵" },
}

export const chip = {
  noCore: (ids: string[]) =>
    listText({ en: "No {list}", hi: "{list} नहीं", ja: "{list}なし" }, ids.map((id) => CORE_NOUN[id]), { ja: "・" }),
  noList: (items: Text[]) => listText({ en: "No {list}", hi: "{list} नहीं", ja: "{list}なし" }, items),
  alsoNo: (items: Text[]) => listText({ en: "Also no {list}", hi: "{list} भी नहीं", ja: "{list}もなし" }, items),
  allergy: (items: Text[]) => listText({ en: "Allergy: {list}", hi: "एलर्जी: {list}", ja: "アレルギー：{list}" }, items),
  noGroup: {
    onion_garlic: { en: "No onion or garlic", hi: "प्याज़-लहसुन नहीं", ja: "玉ねぎ・にんにくなし" },
    root_veg: { en: "No root vegetables", hi: "कंद-मूल नहीं", ja: "根菜なし" },
    dairy: { en: "No dairy", hi: "डेयरी नहीं", ja: "乳製品なし" },
    honey: { en: "No honey", hi: "शहद नहीं", ja: "はちみつなし" },
    alcohol: { en: "No alcohol", hi: "शराब नहीं", ja: "アルコールなし" },
  } as Record<string, Text>,
  ok: {
    dairy: { en: "Dairy OK", hi: "डेयरी चलेगी", ja: "乳製品は可" },
    egg: { en: "Egg OK", hi: "अंडा चलेगा", ja: "卵は可" },
  } as Record<string, Text>,
}
