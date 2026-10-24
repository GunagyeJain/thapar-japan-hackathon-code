// Passenger messages previewed before ops sends them (English + Hindi).
import type { Alert, MealPromise } from "@/lib/types"

export function smsFor(alert: Alert, promise: MealPromise | undefined): { en: string; hi: string } {
  const mark = promise?.label_mark
  const en = mark?.en ?? promise?.code ?? "special meal"
  const hi = mark?.hi ?? en
  if (alert.type === "WRONG_CODE") {
    const code = typeof alert.evidence.suggested_code === "string" ? alert.evidence.suggested_code : "the right meal"
    return {
      en: `JAL: your booked meal on JL740 (25 Oct) doesn't match your food rules. We're changing it to ${code} (${en}). Nothing for you to do.`,
      hi: `JAL: 25 अक्टूबर की JL740 पर बुक किया गया भोजन आपके नियमों से मेल नहीं खाता। हम इसे ${code} (${hi}) में बदल रहे हैं। आपको कुछ नहीं करना है।`,
    }
  }
  return {
    en: `JAL: your flight change dropped your meal request. We've asked for it again on JL740 (25 Oct): ${en}. Nothing for you to do.`,
    hi: `JAL: उड़ान बदलने से आपका भोजन अनुरोध हट गया था। हमने JL740 (25 अक्टूबर) के लिए इसे फिर से माँगा है: ${hi}। आपको कुछ नहीं करना है।`,
  }
}
