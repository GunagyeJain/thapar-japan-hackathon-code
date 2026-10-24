// m21 strings. Keep the English short so Hindi and Japanese fit. Labels name the rule, never the person.
import type { Text } from "@/lib/types"

export const s = {
  // SunTimer (crew tablet, passenger phone)
  eatFrom: { en: "Eat from {time}", hi: "{time} से भोजन", ja: "{time}から食事可" },
  left: { en: "in {d}", hi: "{d} बाद", ja: "あと{d}" },
  open: { en: "May eat now", hi: "अब खा सकते हैं", ja: "食事できます" },
  box: { en: "Sunrise Box at the door", hi: "दरवाज़े पर सनराइज़ बॉक्स", ja: "搭乗口でサンライズボックス" },
  noLimit: { en: "No sun-time limit", hi: "सूरज से जुड़ी कोई सीमा नहीं", ja: "時間の制限なし" },
  until: { en: "until {time}", hi: "{time} तक", ja: "{time}まで" },
  durHM: { en: "{h} h {m} m", hi: "{h} घं {m} मि", ja: "{h}時間{m}分" },
  durM: { en: "{m} min", hi: "{m} मिनट", ja: "{m}分" },

  // Rules
  ruleWait: { en: "Daylight only, +{min} min", hi: "केवल दिन में, +{min} मिनट", ja: "日中のみ（日の出+{min}分）" },
  ruleDaylight: { en: "Daylight only", hi: "केवल दिन में", ja: "日中のみ" },
  ruleFast: { en: "Fasts dawn to sunset", hi: "भोर से सूर्यास्त तक उपवास", ja: "夜明けから日没まで断食" },

  // /ops/sun
  title: { en: "Sun at the aircraft", hi: "विमान पर सूरज", ja: "機上の太陽" },
  subtitle: {
    en: "Meal times for passengers who eat by the sun, worked out where the aircraft is.",
    hi: "सूरज के हिसाब से खाने वाले यात्रियों के भोजन का समय, विमान की जगह से गिना गया।",
    ja: "太陽に合わせて食事をする乗客の食事時刻を、機体の位置で計算します。",
  },
  kpiAircraft: { en: "Sunrise at the aircraft", hi: "विमान पर सूर्योदय", ja: "機上の日の出" },
  kpiAircraftHint: { en: "{pos} at {alt} m", hi: "{pos}, {alt} मी ऊँचाई", ja: "{pos}・高度{alt} m" },
  kpiOrigin: { en: "Sunrise in {city}", hi: "{city} में सूर्योदय", ja: "{city}の日の出" },
  kpiOriginHint: { en: "On the ground at {code}", hi: "{code} पर ज़मीन से", ja: "{code}の地上" },
  kpiEarlier: { en: "Earlier at the aircraft", hi: "विमान पर पहले", ja: "機上で早まる" },
  kpiEarlierHint: { en: "Flying east at cruise height", hi: "क्रूज़ ऊँचाई पर पूर्व की ओर", ja: "巡航高度で東へ飛行" },
  kpiRule: { en: "First meal, +48 min rule", hi: "पहला भोजन, +48 मिनट नियम", ja: "最初の食事（+48分）" },
  kpiRuleHint: {
    en: "For passengers who wait 48 min after sunrise",
    hi: "सूर्योदय के 48 मिनट बाद खाने वालों के लिए",
    ja: "日の出から48分待つ乗客向け",
  },
  minUnit: { en: "min", hi: "मिनट", ja: "分" },
  explain: {
    en: "Flying east at 11,000 m, the sun rises over the aircraft {n} minutes before it rises in {city}.",
    hi: "11,000 मी की ऊँचाई पर पूर्व की ओर उड़ते हुए, विमान पर सूरज {city} से {n} मिनट पहले उगता है।",
    ja: "高度11,000 mで東へ飛ぶと、機上では{city}より{n}分早く日が昇ります。",
  },
  why: {
    en: "Some passengers eat and drink nothing between sunset and sunrise, and many wait 48 minutes more; others fast from dawn to sunset. Crew go by the sun at the aircraft, not the {city} clock.",
    hi: "कुछ यात्री सूर्यास्त से सूर्योदय तक कुछ नहीं खाते-पीते, और कई 48 मिनट और रुकते हैं; कुछ भोर से सूर्यास्त तक उपवास रखते हैं। क्रू {city} की घड़ी से नहीं, विमान पर सूरज देखकर परोसता है।",
    ja: "日没から日の出まで何も口にしない乗客がいて、多くは日の出後さらに48分待ちます。夜明けから日没まで断食する乗客もいます。乗務員は{city}の時計ではなく、機上の太陽に合わせて提供します。",
  },
  chartTitle: { en: "Height of the sun on {flight}", hi: "{flight} पर सूरज की ऊँचाई", ja: "{flight}の太陽高度" },
  legendAircraft: { en: "Sun at the aircraft", hi: "विमान पर सूरज", ja: "機上の太陽" },
  legendOrigin: { en: "Sun over {city}, on the ground", hi: "{city} पर सूरज, ज़मीन से", ja: "{city}の太陽（地上）" },
  legendLine: { en: "Sunrise line at 11,000 m ({deg})", hi: "11,000 मी पर सूर्योदय रेखा ({deg})", ja: "高度11,000 mの日の出線（{deg}）" },
  climb: { en: "climb", hi: "चढ़ाई", ja: "上昇" },
  descent: { en: "descent", hi: "उतराई", ja: "降下" },
  now: { en: "Now", hi: "अभी", ja: "現在" },
  axisTime: { en: "Time (IST)", hi: "समय (IST)", ja: "時刻（IST）" },
  tipAircraft: { en: "At the aircraft", hi: "विमान पर", ja: "機上" },
  tipOrigin: { en: "Over {city}", hi: "{city} पर", ja: "{city}" },
  tipAlt: { en: "Altitude", hi: "ऊँचाई", ja: "高度" },
  method: {
    en: "NOAA solar position along the great circle · horizon dip 1.76′√h · climb 25 min, cruise 11,000 m, descent 30 min.",
    hi: "ग्रेट-सर्कल मार्ग पर NOAA सौर स्थिति · क्षितिज झुकाव 1.76′√h · चढ़ाई 25 मिनट, क्रूज़ 11,000 मी, उतराई 30 मिनट।",
    ja: "大圏航路上のNOAA太陽位置 · 水平線の伏角 1.76′√h · 上昇25分、巡航11,000 m、降下30分。",
  },
  presetsTitle: { en: "India → Japan departures", hi: "भारत → जापान उड़ानें", ja: "インド発・日本行き" },
  presetsSub: {
    en: "Published schedules on {date}. Sunrise Box: no eating time on board before the descent.",
    hi: "{date} की प्रकाशित समय-सारणी। सनराइज़ बॉक्स: उतराई से पहले विमान पर खाने का समय नहीं।",
    ja: "{date}の公表ダイヤ。サンライズボックス：降下開始までに機内で食事できる時間がない場合。",
  },
  colFlight: { en: "Flight", hi: "उड़ान", ja: "便" },
  colDeparts: { en: "Departs", hi: "प्रस्थान", ja: "出発" },
  colAircraft: { en: "Sunrise at aircraft", hi: "विमान पर सूर्योदय", ja: "機上の日の出" },
  colOrigin: { en: "Sunrise at origin", hi: "प्रस्थान शहर में सूर्योदय", ja: "出発地の日の出" },
  colEarlier: { en: "Earlier", hi: "पहले", ja: "差" },
  colEat: { en: "Eats from (+48 min)", hi: "भोजन (+48 मिनट)", ja: "食事開始（+48分）" },
  sunriseBox: { en: "Sunrise Box", hi: "सनराइज़ बॉक्स", ja: "サンライズボックス" },
  noSunrise: { en: "No sunrise on board", hi: "विमान पर सूर्योदय नहीं", ja: "機上で日の出なし" },
  seatsTitle: { en: "{flight} seats with a sun-time rule", hi: "{flight} में सूरज-समय नियम वाली सीटें", ja: "{flight}の時間制限がある座席" },
  seatsEmptyTitle: { en: "No sun-time rules on {flight} yet", hi: "{flight} पर अभी कोई सूरज-समय नियम नहीं", ja: "{flight}に時間制限のある乗客はまだいません" },
  seatsEmptyBody: {
    en: "Seats appear here when a passenger's profile says they eat only in daylight or fast from dawn to sunset.",
    hi: "जब किसी यात्री की प्रोफ़ाइल में लिखा हो कि वे केवल दिन में खाते हैं या भोर से सूर्यास्त तक उपवास रखते हैं, तो सीट यहाँ दिखेगी।",
    ja: "日中のみ食事、または夜明けから日没まで断食とプロフィールにある乗客の座席がここに表示されます。",
  },
  loadError: { en: "Couldn't load the sun times", hi: "सूरज के समय लोड नहीं हुए", ja: "太陽の時刻を読み込めませんでした" },
  loadErrorBody: {
    en: "They are worked out on the server from the flight's route and times.",
    hi: "ये सर्वर पर उड़ान के मार्ग और समय से गिने जाते हैं।",
    ja: "便の経路と時刻からサーバーで計算しています。",
  },
  retry: { en: "Retry", hi: "फिर कोशिश करें", ja: "再試行" },
  delayed: { en: "{n} min late: times follow the delay", hi: "{n} मिनट देर: समय देरी के साथ बदले", ja: "{n}分遅延：遅延を反映" },
} satisfies Record<string, Text>

export const CITY: Record<string, Text> = {
  DEL: { en: "Delhi", hi: "दिल्ली", ja: "デリー" },
  BLR: { en: "Bengaluru", hi: "बेंगलुरु", ja: "ベンガルール" },
  NRT: { en: "Tokyo", hi: "टोक्यो", ja: "東京" },
  HND: { en: "Tokyo", hi: "टोक्यो", ja: "東京" },
}

export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""))
}
