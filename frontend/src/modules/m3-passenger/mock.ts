// Stand-in for m1 until GET /api/rules and POST /api/rules/code-options are live.
// When m1 ships, set USE_MOCK_RULES to false. Nothing else changes.
import type { BookingCheck, CodeOption, PickerGroup, Preset, Text } from "./types";

export const USE_MOCK_RULES = true;

const DAIRY_OK = ["dairy"];

export const MOCK_PRESETS: Preset[] = [
  {
    id: "vegetarian",
    labels: { en: "Vegetarian", hi: "शाकाहारी", ja: "ベジタリアン" },
    forbid: ["meat", "seafood", "egg"],
    allow: DAIRY_OK,
  },
  {
    id: "jain",
    labels: { en: "Jain", hi: "जैन", ja: "ジャイナ食" },
    forbid: ["meat", "seafood", "egg", "onion", "garlic", "root_veg", "honey"],
    allow: DAIRY_OK,
  },
  {
    id: "no_onion_garlic",
    labels: { en: "No onion or garlic", hi: "प्याज़-लहसुन नहीं", ja: "玉ねぎ・にんにく抜き" },
    forbid: ["onion", "garlic"],
    allow: [],
  },
  {
    id: "eggetarian",
    labels: { en: "Vegetarian, eggs OK", hi: "शाकाहारी, अंडा चलेगा", ja: "ベジタリアン（卵は可）" },
    forbid: ["meat", "seafood"],
    allow: ["egg", "dairy"],
  },
  {
    id: "vegan",
    labels: { en: "Vegan", hi: "वीगन", ja: "ヴィーガン" },
    forbid: ["meat", "seafood", "egg", "dairy", "honey"],
    allow: [],
  },
  {
    id: "halal",
    labels: { en: "Halal", hi: "हलाल", ja: "ハラール" },
    forbid: ["pork", "lard", "gelatin", "alcohol"],
    allow: [],
  },
  {
    id: "no_beef",
    labels: { en: "No beef", hi: "बीफ़ नहीं", ja: "牛肉なし" },
    forbid: ["beef"],
    allow: [],
  },
  {
    id: "vrat",
    labels: { en: "Fasting (vrat)", hi: "व्रत", ja: "断食（ヴラット）" },
    forbid: ["meat", "seafood", "egg", "onion", "garlic", "wheat", "rice", "legume"],
    allow: DAIRY_OK,
  },
];

export const MOCK_PICKER_GROUPS: PickerGroup[] = [
  { id: "meat", kind: "diet", labels: { en: "Meat", hi: "मांस", ja: "肉" }, tags: ["meat"] },
  { id: "seafood", kind: "diet", labels: { en: "Fish & seafood", hi: "मछली और सी-फ़ूड", ja: "魚介類" }, tags: ["seafood"] },
  { id: "egg", kind: "diet", labels: { en: "Egg", hi: "अंडा", ja: "卵" }, tags: ["egg"] },
  { id: "onion_garlic", kind: "diet", labels: { en: "Onion & garlic", hi: "प्याज़ और लहसुन", ja: "玉ねぎ・にんにく" }, tags: ["onion", "garlic"] },
  { id: "root_veg", kind: "diet", labels: { en: "Root vegetables", hi: "ज़मीकंद (आलू, गाजर)", ja: "根菜" }, tags: ["root_veg"] },
  { id: "dairy", kind: "diet", labels: { en: "Dairy", hi: "दूध से बनी चीज़ें", ja: "乳製品" }, tags: ["dairy"] },
  { id: "honey", kind: "diet", labels: { en: "Honey", hi: "शहद", ja: "はちみつ" }, tags: ["honey"] },
  { id: "alcohol", kind: "diet", labels: { en: "Alcohol", hi: "शराब", ja: "アルコール" }, tags: ["alcohol"] },
  { id: "peanut", kind: "allergen", labels: { en: "Peanuts", hi: "मूंगफली", ja: "落花生" }, tags: ["peanut"] },
  { id: "tree_nut", kind: "allergen", labels: { en: "Tree nuts", hi: "मेवे (बादाम, काजू)", ja: "ナッツ類" }, tags: ["tree_nut"] },
  { id: "sesame", kind: "allergen", labels: { en: "Sesame", hi: "तिल", ja: "ごま" }, tags: ["sesame"] },
  { id: "soy", kind: "allergen", labels: { en: "Soy", hi: "सोया", ja: "大豆" }, tags: ["soy"] },
  { id: "wheat", kind: "allergen", labels: { en: "Wheat (gluten)", hi: "गेहूँ (ग्लूटेन)", ja: "小麦" }, tags: ["wheat"] },
  { id: "buckwheat", kind: "allergen", labels: { en: "Buckwheat", hi: "कुट्टू", ja: "そば" }, tags: ["buckwheat"] },
  { id: "shellfish", kind: "allergen", labels: { en: "Shellfish", hi: "झींगा, केकड़ा", ja: "えび・かに・貝" }, tags: ["shellfish"] },
];

/** Labels for tags a preset can add that no picker group covers. m1's taxonomy replaces this. */
export const MOCK_TAG_LABELS: Record<string, Text> = {
  beef: { en: "beef", hi: "बीफ़", ja: "牛肉" },
  pork: { en: "pork", hi: "सूअर का मांस", ja: "豚肉" },
  lard: { en: "lard", hi: "लार्ड (सूअर की चर्बी)", ja: "ラード" },
  gelatin: { en: "gelatin", hi: "जिलेटिन", ja: "ゼラチン" },
  rice: { en: "rice", hi: "चावल", ja: "米" },
  legume: { en: "lentils and beans", hi: "दालें", ja: "豆類" },
  dairy: { en: "dairy", hi: "डेयरी", ja: "乳製品" },
  root_veg: { en: "root vegetables", hi: "ज़मीकंद", ja: "根菜" },
  chicken: { en: "chicken", hi: "चिकन", ja: "鶏肉" },
  fish: { en: "fish", hi: "मछली", ja: "魚" },
  onion: { en: "onion", hi: "प्याज़", ja: "玉ねぎ" },
  garlic: { en: "garlic", hi: "लहसुन", ja: "にんにく" },
};

// Priya's answer from shared/api.md. The mock returns it for every request.
export const MOCK_CODE_OPTIONS: CodeOption[] = [
  {
    code: "AVML",
    recommended: true,
    safety_gaps: ["onion", "garlic"],
    preference_losses: [],
    kitchen_note: "NO ONION NO GARLIC",
    label_mark: { en: "VEG · no onion, no garlic", hi: "शाकाहारी · प्याज़-लहसुन नहीं", ja: "ベジ · 玉ねぎ・にんにくなし" },
    why: {
      en: "Indian vegetarian meal. The kitchen note removes onion and garlic.",
      hi: "भारतीय शाकाहारी भोजन। किचन नोट से प्याज़ और लहसुन हटा दिए जाते हैं।",
      ja: "インド式ベジタリアン食です。キッチンへの指示で玉ねぎとにんにくを除きます。",
    },
  },
  {
    code: "VJML",
    recommended: false,
    safety_gaps: [],
    preference_losses: ["dairy", "root_veg"],
    kitchen_note: null,
    label_mark: { en: "JAIN", hi: "जैन", ja: "ジャイナ食" },
    why: {
      en: "Safe without a note, but it leaves out food you eat.",
      hi: "बिना नोट के भी सुरक्षित, पर इसमें वह खाना नहीं होगा जो आप खाते हैं।",
      ja: "指示なしでも安全ですが、召し上がれる食材も除かれます。",
    },
  },
];

// The HNML trap. Any vegetarian rule against HNML fails; everything else passes.
export function mockCheckBooking(forbid: string[], bookedCode: string | null): BookingCheck {
  const veg = forbid.includes("meat") || forbid.includes("seafood");
  if (bookedCode === "HNML" && veg) {
    return {
      ok: false,
      problem: {
        contains: ["chicken", "fish"],
        message: {
          en: "HNML contains chicken or fish.",
          hi: "HNML में चिकन या मछली होती है।",
          ja: "HNMLには鶏肉または魚が含まれます。",
        },
      },
      suggested_code: "AVML",
    };
  }
  return { ok: true };
}
