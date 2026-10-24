"""The dictionary reader: a passenger's own words → food rules, with no model.

English, romanized Hindi (Hinglish), Hindi in Devanagari and Japanese, plus a few Tamil and Gujarati words.
Every hit keeps the word it came from, so the phone can show what each word became ("lahsun → garlic").
Content words we don't know go to `unclear`; nothing is guessed.

How a sentence is read:
1. Normalise (NFKC, lower case, Devanagari nukta and chandrabindu folded, hyphens become spaces).
2. Pull out "anything is fine" style phrases (flex).
3. Split into clauses on punctuation and on "but / par / lekin / けど".
4. Find lexicon words in each clause, longest first.
5. Each food word takes its polarity from the nearest marker: "no / not / without / bina X" before it,
   "X nahi / X chalega / X抜き / Xは大丈夫" after it. Allergy beats forbid beats allow.
6. Weekday and festival words claim the food words next to them: those become a time rule, not a rule for every day.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from functools import lru_cache
from typing import Any

from app.modules.m1_rules import engine

# ---------------------------------------------------------------- normalising

NUKTA = "़"
CHANDRABINDU, ANUSVARA = "ँ", "ं"
_SPACE_LIKE = re.compile(r"[-_/&+・~]")
_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Fold the ways people type the same word: case, full-width letters, nukta, hyphens, apostrophes."""
    s = unicodedata.normalize("NFKC", text).lower()
    s = s.replace(NUKTA, "").replace(CHANDRABINDU, ANUSVARA)
    s = s.replace("’", "'").replace("'", "")
    s = _SPACE_LIKE.sub(" ", s)
    return _SPACES.sub(" ", s).strip()


def _is_word_char(ch: str) -> bool:
    return ch.isalnum() or unicodedata.category(ch).startswith("M")


def _is_cjk(text: str) -> bool:
    return any("぀" <= ch <= "ヿ" or "㐀" <= ch <= "鿿" for ch in text)


# ---------------------------------------------------------------- lexicon

# Diet words → m1 presets. The preset's forbid and allow lists are the rules; the word itself is never stored.
DIET_WORDS: dict[tuple[str, ...], list[str]] = {
    ("vegetarian",): [
        "veg", "vegetarian", "vegetarians", "veggie", "pure veg", "pure vegetarian", "only veg", "lacto vegetarian",
        "shakahari", "shakahaari", "shaakahaari", "sakahari", "शाकाहारी", "शुद्ध शाकाहारी", "वेज", "प्योर वेज",
        "ベジタリアン", "菜食", "菜食主義", "saivam", "சைவம்", "શાકાહારી",
    ],
    ("jain",): [
        "jain", "jains", "jain food", "जैन", "ジャイナ", "ジャイナ教", "ஜைன", "જૈન", "digambar", "shwetambar", "swetambar",
        "svetambar", "sthanakvasi", "terapanthi", "दिगंबर", "श्वेतांबर",
    ],
    ("vegan",): ["vegan", "plant based", "वीगन", "वेगन", "ヴィーガン", "ビーガン", "完全菜食"],
    ("eggetarian",): ["eggetarian", "eggitarian", "ovo vegetarian"],
    ("halal",): ["halal", "halaal", "zabiha", "हलाल", "ハラール", "ハラル", "ஹலால்", "હલાલ"],
    ("diabetic",): [
        "diabetic", "diabetes", "sugar free", "sugarfree", "sugar patient", "sugar hai", "sugar ka patient",
        "शुगर", "शुगर फ्री", "मधुमेह", "डायबिटीज", "डायबिटिक", "糖尿病", "நீரிழிவு", "ડાયાબિટીસ",
    ],
    ("vegetarian", "no_onion_garlic"): ["satvik", "sattvic", "satvic", "saatvik", "सात्विक", "सात्त्विक"],
}

# Food words → taxonomy tags. These override the taxonomy's own synonyms (loaded underneath).
FOOD_WORDS: dict[tuple[str, ...], list[str]] = {
    ("meat",): ["maans", "maas", "gosht", "मांस", "गोश्त", "肉", "お肉", "肉類", "இறைச்சி", "માંસ"],
    ("meat", "seafood", "egg"): ["non veg", "nonveg", "non vegetarian", "मांसाहारी", "मांसाहार", "नॉन वेज", "नॉनवेज"],
    ("chicken",): ["murgi", "murga", "murgh", "मुर्गा", "मुर्गी", "चिकन", "鶏肉", "チキン", "kozhi", "கோழி"],
    ("mutton",): ["mutton", "bakra", "मटन", "बकरा", "羊肉"],
    ("beef",): ["gomans", "gai ka maas", "gaay ka maas", "गोमांस", "बीफ", "牛肉", "ビーフ"],
    ("pork",): ["suar", "suwar", "sooar", "सूअर", "सुअर", "豚肉", "ポーク"],
    ("fish",): ["machhli", "machli", "machhi", "macchi", "macchli", "मछली", "meen", "மீன்", "માછલી"],
    ("seafood",): ["sea food", "samudri", "魚", "さかな", "魚介", "魚介類", "シーフード"],
    ("shrimp",): ["jhinga", "jheenga", "prawns", "झींगा"],
    ("egg",): ["anda", "ande", "andaa", "anday", "eggs", "अंडा", "अंडे", "अण्डा", "卵", "たまご", "玉子", "முட்டை", "muttai", "ઈંડા"],
    ("milk",): ["doodh", "dudh", "दूध", "牛乳", "ミルク", "paal", "பால்", "દૂધ"],
    ("dairy",): ["milk products", "dairy products", "डेयरी", "乳製品"],
    ("yogurt",): ["दही", "yoghurt", "thayir", "தயிர்"],
    ("paneer",): ["पनीर"],
    ("ghee",): ["ghi", "घी"],
    ("butter",): ["makhan", "makkhan", "मक्खन"],
    ("honey",): ["shahad", "shehad", "sahad", "शहद"],
    ("potato",): ["alu", "aaloo", "potatoes", "आलू"],
    ("onion",): ["pyaz", "pyaaz", "piyaz", "piyaj", "pyaj", "kanda", "kaanda", "प्याज", "कांदा", "vengayam", "வெங்காயம்", "ડુંગળી"],
    ("garlic",): ["lahsun", "lehsun", "lasun", "lahsan", "lehsan", "लहसुन", "लसुन", "poondu", "பூண்டு", "લસણ"],
    ("onion", "garlic"): [
        "onion garlic", "onions garlic", "pyaz lahsun", "pyaaz lahsun", "pyaj lahsun", "प्याज लहसुन", "लहसुन प्याज",
        "玉ねぎ にんにく", "玉ねぎにんにく",
    ],
    ("ginger",): ["adrak", "adrakh", "अदरक"],
    ("root_veg",): [
        "root vegetables", "root vegetable", "root veg", "kandmool", "kand mool", "kandmul", "jamikand", "zameenkand",
        "कंदमूल", "कंद मूल", "जमीकंद", "根菜類",
    ],
    ("mushroom",): ["mushrooms", "khumbi", "khumb", "मशरूम", "खुंभी", "きのこ", "キノコ"],
    ("alcohol",): ["sharab", "sharaab", "daru", "daaru", "liquor", "booze", "beer", "शराब", "दारू", "お酒", "ビール"],
    ("peanut",): [
        "moongphali", "mungfali", "moongfali", "mungphali", "singdana", "peanuts", "groundnuts", "मूंगफली",
        "ピーナッツ", "verkadalai", "வேர்க்கடலை", "સીંગ",
    ],
    ("sesame",): ["तिल"],
    ("cashew",): ["cashews", "काजू"],
    ("almond",): ["almonds", "बादाम"],
    ("tree_nut",): ["nuts", "nut", "dry fruits", "dryfruits", "mewa", "meva", "मेवा", "मेवे"],
    ("wheat",): ["gehun", "gehu", "गेहूं"],
    ("wheat", "barley"): ["gluten", "ग्लूटेन", "グルテン"],
    ("grain",): ["anaj", "anaaj", "अनाज", "grains", "cereals"],
    ("legume",): ["daal", "दाल", "lentils", "beans"],
    ("rice",): ["चावल", "ご飯"],
    ("sugar",): ["cheeni", "chini", "shakkar", "चीनी", "शक्कर"],
    ("gelatin",): ["जिलेटिन"],
    ("soy",): ["सोया", "豆腐"],
}

# Markers: (polarity, direction, soft). "pre" governs the food words after it, "post" the ones before it.
MARKER_WORDS: list[tuple[str | None, str, bool, list[str]]] = [
    ("forbid", "pre", False, [
        "no", "not", "without", "never", "avoid", "avoiding", "except", "excluding", "exclude", "other than", "zero",
        "dont eat", "do not eat", "doesnt eat", "does not eat", "dont take", "do not take", "dont have", "do not have",
        "cant eat", "can not eat", "cannot eat", "cant have", "wont eat", "will not eat", "never eat", "dont consume",
        "do not consume", "stay away from", "abstain from", "free from", "nothing with", "no more",
        "bina", "baghair", "bagair", "बिना", "बगैर",
    ]),
    ("forbid", "post", False, [
        "nahi", "nahin", "nai", "nhi", "nahee", "nahi khata", "nahi khati", "nahi khate", "nahin khata", "nahin khati",
        "nahin khate", "khata nahi", "khati nahi", "khate nahi", "khata nahin", "khati nahin", "nahi chalega",
        "nahi chalegi", "nahi chalta", "nahi chalti", "nahi leta", "nahi leti", "nahi lete", "mat", "mat dena", "mat do",
        "mat dijiye", "se parhez", "parhez", "varjit", "not allowed", "is not allowed", "not ok", "not okay", "free",
        "नहीं", "नही", "मत", "नहीं खाता", "नहीं खाती", "नहीं खाते", "खाता नहीं", "खाती नहीं", "खाते नहीं",
        "नहीं चलेगा", "नहीं चलेगी", "से परहेज", "परहेज", "वर्जित",
        "食べません", "食べない", "食べられません", "食べられない", "食べれません", "食べれない", "飲みません", "飲まない",
        "抜き", "ぬき", "不可", "なし", "無し", "ダメ", "だめ", "駄目", "ng", "禁止", "いりません", "要りません", "不要", "除去",
    ]),
    ("forbid", "pre", True, [
        "prefer not", "prefer no", "prefer not to eat", "would rather not", "rather not", "try to avoid", "try not to eat",
        "try not to have", "dont like", "do not like", "dont really eat", "not a fan of", "dislike",
    ]),
    ("forbid", "post", True, ["pasand nahi", "pasand nahin", "पसंद नहीं", "苦手", "控えています", "控えたい"]),
    ("allow", "pre", False, [
        "i eat", "eat", "eats", "i do eat", "i can eat", "can eat", "i have", "i take", "i drink", "drink", "i like",
        "i love", "ok with", "okay with", "fine with", "happy with", "can have",
    ]),
    ("allow", "post", False, [
        "ok", "okay", "fine", "is fine", "are fine", "is ok", "is okay", "are ok", "allowed", "is allowed", "are allowed",
        "theek", "thik", "theek hai", "thik hai", "chalega", "chalegi", "chalenge", "chal jayega", "chal jaega", "chalta",
        "chalti", "chalte", "chalta hai", "chalti hai", "khata", "khati", "khate", "khata hoon", "khati hoon", "khate hain",
        "khata hun", "khati hun", "kha leta", "kha leti", "kha lete", "kha sakta", "kha sakti", "le leta", "le leti",
        "pasand hai", "पसंद है", "खाता", "खाती", "खाते", "खा लेता", "खा लेती", "खा सकता", "खा सकती", "चलेगा", "चलेगी",
        "चलता", "चलती", "चलता है", "ठीक", "ठीक है",
        "大丈夫", "食べます", "食べられます", "食べれます", "飲みます", "平気", "問題ない", "問題ありません",
    ]),
    ("allergen", "pre", False, ["allergic to", "allergy to", "allergic", "an allergy to", "allergy from", "allergy of"]),
    ("allergen", "post", False, [
        "allergy", "allergies", "se allergy", "se allergy hai", "allergy hai", "से एलर्जी", "से एलर्जी है", "एलर्जी",
        "アレルギー",
    ]),
]

# Words that make every forbid in their clause a taste preference (soft tier).
SOFT_WORDS = [
    "prefer", "preferably", "if possible", "ideally", "jahan tak ho sake", "ho sake to", "agar ho sake", "できれば",
    "なるべく", "出来れば",
]

# "I eat anything": a flex opt-in, only when nothing hard comes with it.
FLEX_WORDS = [
    "flexible", "flexi", "im flexible", "i am flexible", "kuch bhi chalega", "kuch bhi kha leta", "kuch bhi kha leti",
    "kuch bhi kha lunga", "kuch bhi kha lungi", "sab chalega", "sab kuch chalega", "sab khata hoon", "sab khati hoon",
    "sab kuch khata hoon", "sab kuch khati hoon", "anything is fine", "anything is ok", "anything works", "anything goes",
    "eat anything", "eat everything", "i eat everything", "i eat anything", "anything", "everything is fine",
    "no restrictions", "no restriction", "no preference", "no preferences", "no dietary restrictions", "koi parhez nahi",
    "कुछ भी चलेगा", "सब चलेगा", "सब कुछ चलेगा", "कुछ भी खा लेता", "कुछ भी खा लेती", "सब खाता हूं", "सब खाती हूं",
    "なんでも大丈夫", "何でも大丈夫", "なんでも食べます", "何でも食べます", "特になし", "制限なし", "好き嫌いなし",
]

OBSERVANCE_WORDS: dict[str, list[str]] = {
    "purnima": [
        "purnima", "poornima", "purnimaa", "punam", "poonam", "pournami", "pournima", "full moon", "पूर्णिमा", "पूनम",
        "पूर्णमासी", "満月", "プールニマー", "பௌர்ணமி", "પૂનમ",
    ],
    "ekadashi": [
        "ekadashi", "ekadasi", "ekadashee", "gyaras", "agiyaras", "agyaras", "एकादशी", "ग्यारस", "エーカーダシー", "ஏகாதசி",
        "અગિયારસ",
    ],
    "navratri": [
        "navratri", "navaratri", "navratra", "navratras", "navratre", "नवरात्रि", "नवरात्र", "नवरात्रे", "ナヴァラートリ",
        "நவராத்திரி", "નવરાત્રી",
    ],
}
RAMADAN_WORDS = ["ramadan", "ramzan", "ramazan", "ramadhan", "रमजान", "रमदान", "ラマダン", "ரமலான்", "રમઝાન"]
ROZA_WORDS = ["roza", "rozah", "rozay", "roze", "rozas", "roja", "रोजा", "रोजे", "断食月"]  # the fast itself, never a name
# "I keep / observe it": with a festival in the same clause, that's a fast, not a name ("Purnima" is also a first name).
KEEP_WORDS = [
    "keep", "keeps", "observe", "observes", "rakhta", "rakhti", "rakhte", "rakhna", "rakhta hoon", "rakhti hoon",
    "rakhte hain", "manata", "manati", "manate", "रखता", "रखती", "रखते", "मानता", "मानती", "मानते", "守っています", "守ります",
]
# Diet words that are also surnames: "Sushila Jain" is a name, "main Jain hoon" is a diet.
SURNAME_DIETS = {"jain", "जैन"}
_NAME_INTRO = re.compile(
    r"(my names|my name is|name is|i am called|im called|mera naam|mera nam|मेरा नाम)\s+([^\s,.;:!?।]+)(\s+[^\s,.;:!?।]+)?"
)
CHAUVIHAR_WORDS = ["chauvihar", "chovihar", "chouvihar", "chauvihaar", "chovihaar", "choviyar", "चौविहार", "चोविहार", "ચોવિહાર"]
NAVKARSI_WORDS = ["navkarsi", "navkarshi", "navakarsi", "navkarasi", "नवकारसी", "નવકારશી"]
SUNSET_WORDS = [
    "sunset", "after sunset", "sundown", "after dark", "sunset ke baad", "suryast", "suryast ke baad", "sooraj dhalne",
    "sooraj dhalne ke baad", "सूर्यास्त", "सूर्यास्त के बाद", "सूरज ढलने", "सूरज ढलने के बाद", "日没", "日没後", "日の入り",
]
SUNRISE_WORDS = ["sunrise", "after sunrise", "suryoday", "sooraj nikalne", "सूर्योदय", "日の出"]
FAST_WORDS = [
    "vrat", "vrath", "upvas", "upvaas", "upwas", "fast", "fasts", "fasting", "व्रत", "उपवास", "断食", "விரதம்", "ઉપવાસ",
]
WEEKDAY_WORDS: dict[int, list[str]] = {
    0: ["monday", "mondays", "somvar", "somwar", "somvaar", "सोमवार", "月曜日", "月曜", "સોમવાર"],
    1: ["tuesday", "tuesdays", "mangalvar", "mangalwar", "mangalvaar", "मंगलवार", "火曜日", "火曜", "મંગળવાર"],
    2: ["wednesday", "wednesdays", "budhvar", "budhwar", "बुधवार", "水曜日", "水曜"],
    3: ["thursday", "thursdays", "guruvar", "guruwar", "brihaspativar", "veervar", "गुरुवार", "बृहस्पतिवार", "木曜日", "木曜"],
    4: ["friday", "fridays", "shukravar", "shukrawar", "शुक्रवार", "金曜日", "金曜"],
    5: ["saturday", "saturdays", "shanivar", "shaniwar", "shanivaar", "शनिवार", "土曜日", "土曜"],
    6: ["sunday", "sundays", "ravivar", "raviwar", "itvaar", "itwar", "रविवार", "इतवार", "日曜日", "日曜"],
}
WEEKDAY_NAMES = {
    0: {"en": "Monday", "hi": "सोमवार", "ja": "月曜日"},
    1: {"en": "Tuesday", "hi": "मंगलवार", "ja": "火曜日"},
    2: {"en": "Wednesday", "hi": "बुधवार", "ja": "水曜日"},
    3: {"en": "Thursday", "hi": "गुरुवार", "ja": "木曜日"},
    4: {"en": "Friday", "hi": "शुक्रवार", "ja": "金曜日"},
    5: {"en": "Saturday", "hi": "शनिवार", "ja": "土曜日"},
    6: {"en": "Sunday", "hi": "रविवार", "ja": "日曜日"},
}

# Clause breaks: punctuation, and "but" in each language. "par"/"पर" also means "on", so after a day word it isn't a break.
_PUNCT = re.compile(r"[,.;:!?\n\r、。！？；：()\[\]{}\"“”「」『』|।॥]+")
BUT_WORDS = {"but", "however", "though", "although", "whereas", "lekin", "lekan", "magar", "parantu", "kintu", "par", "pr",
             "लेकिन", "मगर", "परंतु", "परन्तु", "किंतु", "किन्तु", "पर"}
ON_WORDS = {"par", "pr", "पर"}
AND_WORDS = {"and", "aur", "or", "also", "plus", "और", "तथा"}
_JA_BUT = re.compile(r"(けれども|けれど|けど|しかし|ただし)")
_JA_MASU_GA = re.compile(r"(ます|です)が")
_MINUTES = re.compile(r"(\d{1,3})\s*(min|mins|minute|minutes|मिनट|分)")

DEFAULT_AFTER_SUNRISE_MIN = 48  # navkarsi: 48 minutes after sunrise

STOP_LATIN = set("""
i im me my mine myself am is are was were be been being a an the and or nor also too to of on in at for with from by as
so do does did done please pls plz kindly thanks thank thankyou you your we us our they them their he she his her it its
this that these those there here food foods meal meals dish dishes diet diets dietary any some all only just very really
strictly strict totally completely mostly usually always generally normally keep keeps kept follow follows following
observe observes observing eating ate day days week weeks weekly every each daily during after before until till since
time times hi hello hey sir madam maam ji would like want wants need needs maybe etc things thing stuff something
nothing items item type types kind kinds person someone people family wife husband mother father mom dad son daughter
child children kids religious religion reason reasons because due health medical doctor advised advice also yes then
main mai mein me mujhe mujhko mera meri mere hum hamara hamari hamare hoon hu hun hai hain ho hota hoti hote tha thi the
ka ki ke ko se ya bhi toh sirf bas sab kuch koi kabhi kya kyunki rakhta rakhti rakhte rakhna rakhte karta karti karte
karna kar khana khaana khane din dino har wala wali wale ek dhanyavad shukriya chahiye chahie dena de dijiye lena lunga
lungi leta leti lete baad pehle tak bilkul zyada kam thoda bahut roz rozana hamesha vaise waise abhi ab aaj kal raat
subah shaam yeh ye woh wo is us bhai behen hindu muslim sikh christian min mins minute minutes pure proper full
complete total practising practicing orthodox name names called naam nam
""".split())
STOP_DEVANAGARI = set(normalize(w) for w in """
मैं मै मुझे मुझको मेरा मेरी मेरे हम हमारा हमारी हमारे हूं हूँ हु है हैं हो होता होती होते था थी थे का की के को से में और या भी
तो सिर्फ बस सब कुछ कोई कभी क्या रखता रखती रखते रखना करता करती करते करना खाना खाने दिन हर वाला वाली वाले एक कृपया जी
धन्यवाद चाहिए देना दीजिए लेना बाद पहले तक बिल्कुल ज्यादा कम थोड़ा बहुत रोज हमेशा अभी आज कल रात सुबह शाम यह ये वह वो मिनट
""".split())
STOP_JA = {"私", "僕", "俺", "食事", "機内食", "毎日", "今日", "日", "宗教", "理由", "家族", "全部", "全て", "何", "少し", "絶対",
           "必ず", "普段", "基本", "基本的", "願", "食", "食品", "料理", "方", "人", "物", "もの", "分"}


@dataclass(frozen=True)
class Entry:
    kind: str  # diet | food | marker | soft | flex | observance | ramadan | chauvihar | navkarsi | sunset | sunrise | fast | weekday
    value: Any = None


def _plurals(word: str) -> list[str]:
    if not word.isascii() or not word[-1:].isalpha():
        return []
    return [word + "s", word + "es"]


@lru_cache(maxsize=1)
def lexicon() -> dict[str, Entry]:
    """Every word we read, normalised, → what it means. Our own words win over the taxonomy's synonyms."""
    lex: dict[str, Entry] = {}
    r = engine.rules()
    for tag_id, tag in r.tags.items():
        if tag.get("kind") in ("property", "rule"):
            continue
        words = [tag_id.replace("_", " "), *tag["synonyms_en"], *tag["synonyms_ja"]]
        words += [tag["labels"][lang] for lang in ("hi", "ja") if tag["labels"].get(lang)]
        for word in words:
            key = normalize(word)
            if key:
                for form in [key, *_plurals(key)]:
                    lex.setdefault(form, Entry("food", (tag_id,)))

    def put(words, entry: Entry) -> None:
        for word in words:
            key = normalize(word)
            if key:
                lex[key] = entry

    for tags, words in FOOD_WORDS.items():
        put(words, Entry("food", tags))
    for presets, words in DIET_WORDS.items():
        put(words, Entry("diet", presets))
    for polarity, direction, soft, words in MARKER_WORDS:
        put(words, Entry("marker", (polarity, direction, soft)))
    put(SOFT_WORDS, Entry("soft"))
    put(FAST_WORDS, Entry("fast"))
    for observance, words in OBSERVANCE_WORDS.items():
        put(words, Entry("observance", observance))
    put(RAMADAN_WORDS, Entry("ramadan", False))
    put(ROZA_WORDS, Entry("ramadan", True))
    put(KEEP_WORDS, Entry("keep"))
    put(CHAUVIHAR_WORDS, Entry("chauvihar"))
    put(NAVKARSI_WORDS, Entry("navkarsi"))
    put(SUNSET_WORDS, Entry("sunset"))
    put(SUNRISE_WORDS, Entry("sunrise"))
    for weekday, words in WEEKDAY_WORDS.items():
        put(words, Entry("weekday", weekday))
    return lex


@lru_cache(maxsize=1)
def _flex_keys() -> list[str]:
    return sorted({normalize(w) for w in FLEX_WORDS}, key=len, reverse=True)


@lru_cache(maxsize=1)
def _time_keys() -> set[str]:
    words = [*RAMADAN_WORDS, *[w for ws in OBSERVANCE_WORDS.values() for w in ws], *[w for ws in WEEKDAY_WORDS.values() for w in ws]]
    return {normalize(w) for w in words}


def _is_grammar(token: str) -> bool:
    return token in STOP_LATIN or token in STOP_DEVANAGARI


def _strip_names(text: str) -> str:
    """"my name is Purnima Jain" / "mera naam Poonam hai": a name says nothing about food, so it isn't read.

    The word after the given name is blanked too when it looks like a surname (unknown, or a diet word that is
    also a surname), and kept when it is grammar or a food word ("my name is Priya, vegetarian")."""

    def blank(m: re.Match) -> str:
        second = (m.group(3) or "").strip()
        surname = second and (second in SURNAME_DIETS or (second not in lexicon() and not _is_grammar(second)))
        names = len(m.group(2)) + 1 + (len(m.group(3)) if surname else 0)
        return m.group(1) + " " * names + ("" if surname else (m.group(3) or ""))

    return _NAME_INTRO.sub(blank, text)


# ---------------------------------------------------------------- matching


@dataclass(frozen=True)
class Hit:
    start: int
    end: int
    word: str
    entry: Entry

    @property
    def kind(self) -> str:
        return self.entry.kind


def _bounded(text: str, start: int, end: int) -> bool:
    before = start == 0 or not _is_word_char(text[start - 1])
    after = end == len(text) or not _is_word_char(text[end])
    return before and after


def find_hits(text: str) -> list[Hit]:
    """Lexicon words in `text`, longest first, never overlapping, in reading order."""
    candidates = []
    for key, entry in lexicon().items():
        at = text.find(key)
        while at != -1:
            end = at + len(key)
            if _is_cjk(key) or _bounded(text, at, end):
                candidates.append(Hit(at, end, key, entry))
            at = text.find(key, at + 1)
    candidates.sort(key=lambda h: (-(h.end - h.start), h.start))
    used = [False] * len(text)
    chosen = []
    for hit in candidates:
        if any(used[hit.start:hit.end]):
            continue
        for i in range(hit.start, hit.end):
            used[i] = True
        chosen.append(hit)
    return sorted(chosen, key=lambda h: h.start)


# ---------------------------------------------------------------- clauses


def _strip_flex(text: str) -> tuple[str, list[str]]:
    found = []
    for key in _flex_keys():
        at = text.find(key)
        while at != -1:
            end = at + len(key)
            if _is_cjk(key) or _bounded(text, at, end):
                found.append(key)
                text = text[:at] + " , " + text[end:]
                at = text.find(key, at + 3)
            else:
                at = text.find(key, at + 1)
    return text, found


def _split_on_but(part: str) -> list[str]:
    tokens = part.split(" ")
    clauses, current = [], []
    keys = _time_keys()
    for token in tokens:
        if token in BUT_WORDS:
            previous = " ".join(current[-2:])
            after_time_word = current and (current[-1] in keys or previous in keys)
            if token in ON_WORDS and after_time_word:
                current.append(token)
                continue
            clauses.append(" ".join(current))
            current = []
            continue
        current.append(token)
    clauses.append(" ".join(current))
    return [c.strip() for c in clauses if c.strip()]


def _split_on_and(clause: str) -> list[str]:
    parts, current = [], []
    for token in clause.split(" "):
        if token in AND_WORDS:
            parts.append(" ".join(current))
            current = []
            continue
        current.append(token)
    parts.append(" ".join(current))
    return [p.strip() for p in parts if p.strip()]


def clauses(text: str) -> list[str]:
    """Split a normalised sentence into clauses. A clause that names a weekday or festival is split on "and" too,
    so "vegetarian and fast on Tuesdays" keeps "vegetarian" for every day."""
    text = _JA_MASU_GA.sub(r"\1、", text)
    text = _JA_BUT.sub("、", text)
    out = []
    for part in _PUNCT.split(text):
        for clause in _split_on_but(part.strip()):
            hits = find_hits(clause)
            if any(h.kind in ("weekday", "observance") for h in hits):
                out.extend(_split_on_and(clause))
            else:
                out.append(clause)
    return [c for c in out if c]


# ---------------------------------------------------------------- reading

PRIORITY = {"allergen": 3, "forbid": 2, "allow": 1}


@dataclass
class FoodHit:
    tags: tuple[str, ...]
    word: str
    polarity: str | None  # forbid | allow | allergen | None (no marker: inherits from a neighbouring clause)
    soft: bool
    direction: str | None  # pre | post: which side the marker was on


@dataclass
class Reading:
    presets: list[tuple[str, str, bool]] = field(default_factory=list)  # (preset id, word, soft)
    foods: list[FoodHit] = field(default_factory=list)
    time_rules: list[dict[str, Any]] = field(default_factory=list)  # with label and via; stripped before saving
    flex: bool = False
    unclear: list[str] = field(default_factory=list)


def _marker(hit: Hit) -> tuple[str | None, str, bool]:
    return hit.entry.value


def _polarity(hits: list[Hit], i: int) -> tuple[str | None, bool, str | None]:
    """The nearest marker on each side decides: one before it only if it points forward, one after only if it points back."""
    pre = post = None
    for j in range(i - 1, -1, -1):
        if hits[j].kind == "marker":
            polarity, direction, soft = _marker(hits[j])
            if direction == "pre" and polarity:
                pre = (polarity, soft, "pre")
            break
    for j in range(i + 1, len(hits)):
        if hits[j].kind == "marker":
            polarity, direction, soft = _marker(hits[j])
            if direction == "post" and polarity:
                post = (polarity, soft, "post")
            break
    found = [c for c in (pre, post) if c]
    if not found:
        return None, False, None
    return max(found, key=lambda c: PRIORITY[c[0]])


def _leftover(clause: str, hits: list[Hit]) -> list[str]:
    """Words no lexicon entry covered, minus grammar words: these go to `unclear`."""
    covered = [False] * len(clause)
    for hit in hits:
        for i in range(hit.start, hit.end):
            covered[i] = True
    rest = "".join(" " if covered[i] else ch for i, ch in enumerate(clause))
    out = []
    for token in rest.split():
        token = token.strip("-'\"")
        if not token or token.isdigit() or _MINUTES.fullmatch(token):
            continue
        if _is_cjk(token):
            out.extend(_ja_leftover(token))
        elif token.isascii():
            if len(token) > 2 and token not in STOP_LATIN and token.isalpha():
                out.append(token)
        elif token not in STOP_DEVANAGARI and len(token) > 1:
            out.append(token)
    return out


def _ja_leftover(token: str) -> list[str]:
    runs = re.findall(r"[゠-ヿ]{2,}|[㐀-鿿]+", token)
    return [r for r in runs if r not in STOP_JA and not all(ch in STOP_JA for ch in r)]


def _dates_of(observance: str) -> list[str]:
    for o in engine.calendar()["observances"]:
        if o["id"] == observance:
            return [d["date"] for d in o["days"]]
    return []


def _observance_labels(observance: str) -> dict[str, str]:
    for o in engine.calendar()["observances"]:
        if o["id"] == observance:
            return o["labels"]
    return {"en": observance}


def _tag_words(tags: list[str], lang: str) -> str:
    r = engine.rules()
    words = [r.label(t, lang) if lang != "en" else r.label(t, "en").lower() for t in tags]
    return ("、" if lang == "ja" else ", ").join(words)


def _display(word: str) -> str:
    return word.title() if word.isascii() else word


def _claimed_rule(hits: list[Hit]) -> dict[str, Any]:
    """What a weekday or festival clause asks for on those days: a fast (vrat), vegetarian, or extra forbids."""
    if any(h.kind == "fast" for h in hits):
        return {"preset": "vrat"}
    forbid: list[str] = []
    for i, hit in enumerate(hits):
        if hit.kind == "diet":
            polarity, _, _ = _polarity(hits, i)
            if polarity != "forbid":
                for preset in hit.entry.value:
                    forbid += engine.rules().presets[preset]["forbid"]
        elif hit.kind == "food":
            polarity, _, _ = _polarity(hits, i)
            if polarity in ("forbid", "allergen"):
                forbid += list(hit.entry.value)
    forbid = list(dict.fromkeys(forbid))
    if not forbid:
        return {}
    r = engine.rules()
    veg = r.presets["vegetarian"]["forbid"]
    if "meat" in forbid or any(f in r.paths("meat") for f in forbid):
        extra = [f for f in forbid if not any(v in r.paths(f) for v in veg)]
        return {"preset": "vegetarian", **({"add_forbid": extra} if extra else {})}
    return {"add_forbid": forbid}


def _weekday_label(days: list[int], rule: dict[str, Any]) -> dict[str, str]:
    names = {lang: ("・" if lang == "ja" else ", ").join(WEEKDAY_NAMES[d][lang] for d in days) for lang in ("en", "hi", "ja")}
    if rule.get("preset") == "vrat":
        return {"en": f"Fast on {names['en']}s", "hi": f"{names['hi']} का व्रत", "ja": f"{names['ja']}は断食"}
    if rule.get("preset") == "vegetarian":
        label = {"en": f"Vegetarian on {names['en']}s", "hi": f"{names['hi']} को शाकाहारी", "ja": f"{names['ja']}はベジタリアン"}
    else:
        label = {"en": f"{names['en']}s", "hi": names["hi"], "ja": names["ja"]}
    extra = rule.get("add_forbid") or []
    if extra:
        label = {
            "en": f"{label['en']}: no {_tag_words(extra, 'en')}",
            "hi": f"{label['hi']}: {_tag_words(extra, 'hi')} नहीं",
            "ja": f"{label['ja']}：{_tag_words(extra, 'ja')}なし",
        }
    return label


def _weekday_via(said: list[str], days: list[int]) -> str:
    """"mangalvar → Tuesdays"; just "Tuesdays" when the person wrote the English day."""
    target = ", ".join(f"{WEEKDAY_NAMES[d]['en']}s" for d in days)
    english = {WEEKDAY_NAMES[d]["en"].lower() for d in days}
    if all(w.rstrip("s") in english for w in said):
        return target
    return f"{', '.join(_display(w) for w in said)} → {target}"


def _observance_label(observance: str, rule: dict[str, Any]) -> dict[str, str]:
    name = _observance_labels(observance)
    if rule.get("preset") == "vrat":
        return {"en": f"{name['en']} fasts", "hi": f"{name.get('hi', name['en'])} का व्रत", "ja": f"{name.get('ja', name['en'])}の断食"}
    extra = rule.get("add_forbid") or []
    return {
        "en": f"On {name['en']}: no {_tag_words(extra, 'en')}",
        "hi": f"{name.get('hi', name['en'])} पर: {_tag_words(extra, 'hi')} नहीं",
        "ja": f"{name.get('ja', name['en'])}：{_tag_words(extra, 'ja')}なし",
    }


def _daylight_label(minutes: int) -> dict[str, str]:
    if minutes:
        return {
            "en": f"Nothing from sunset until {minutes} min after sunrise",
            "hi": f"सूर्यास्त से सूर्योदय के {minutes} मिनट बाद तक कुछ नहीं",
            "ja": f"日没後〜日の出{minutes}分後まで飲食なし",
        }
    return {"en": "Nothing from sunset until sunrise", "hi": "सूर्यास्त से सूर्योदय तक कुछ नहीं", "ja": "日没から日の出まで飲食なし"}


RAMADAN_LABEL = {
    "en": "Ramadan fasts: nothing from dawn until sunset (dates depend on the moon)",
    "hi": "रमज़ान के रोज़े: भोर से सूर्यास्त तक कुछ नहीं (तारीखें चाँद पर निर्भर)",
    "ja": "ラマダンの断食：夜明けから日没まで飲食なし（日付は月の観測による）",
}


TIME_KINDS = ("observance", "weekday", "ramadan", "chauvihar", "navkarsi", "sunset")


class _TimeRules:
    """Time rules in reading order, numbered TR-1, TR-2, …; one per festival, one daylight rule, one Ramadan rule."""

    def __init__(self) -> None:
        self.rules: list[dict[str, Any]] = []
        self.by_key: dict[str, dict[str, Any]] = {}
        self.pending_days: list[int] = []
        self.pending_words: list[str] = []
        self.last_weekday: dict[str, Any] | None = None
        self.pending_festivals: list[Hit] = []
        self.last_festival: dict[str, Any] | None = None  # what the last festival clause asked for

    def add(self, key: str | None, rule: dict[str, Any]) -> dict[str, Any]:
        if key and key in self.by_key:
            return self.by_key[key]
        rule = {"id": f"TR-{len(self.rules) + 1}", **rule}
        self.rules.append(rule)
        if key:
            self.by_key[key] = rule
        return rule

    def festivals(self, hits: list[Hit], claimed: dict[str, Any], kept: bool) -> None:
        """A festival only makes a rule when its clause says what happens on it: a fast ("Purnima ka vrat"),
        "I keep it", or food rules. "Purnima" or "Poonam" alone is a first name, not a fast.
        "Ekadashi and Purnima vrat": the bare festival waits for the clause that says it."""
        if not claimed and not kept:
            self.pending_festivals = [*self.pending_festivals, *hits]
            return
        rule = claimed or {"preset": "vrat"}
        for hit in [*self.pending_festivals, *hits]:
            self._festival(hit, rule)
        self.pending_festivals, self.last_festival = [], rule

    def _festival(self, hit: Hit, rule: dict[str, Any]) -> None:
        added = self.add(f"obs:{hit.entry.value}", {"kind": "dates", "dates": _dates_of(hit.entry.value), **rule, "confirm": True})
        added["label"] = _observance_label(hit.entry.value, rule)
        target = "fasting days" if rule.get("preset") == "vrat" else _tag_words(rule.get("add_forbid", []), "en")
        added["via"] = f"{_display(hit.word)} → {target}"

    def weekdays(self, hits: list[Hit], claimed: dict[str, Any]) -> None:
        days = list(dict.fromkeys([*self.pending_days, *[h.entry.value for h in hits]]))
        said = list(dict.fromkeys([*self.pending_words, *[h.word for h in hits]]))
        if not claimed:  # "Tuesday and Saturday veg": the day waits for the clause that says what happens on it
            self.pending_days, self.pending_words = days, said
            return
        added = self.add(None, {"kind": "weekday", "weekdays": days, **claimed})
        added["label"] = _weekday_label(days, claimed)
        added["via"] = _weekday_via(said, days)
        self.last_weekday, self.pending_days, self.pending_words = added, [], []

    def ramadan(self, hit: Hit) -> None:
        added = self.add("ramadan", {"kind": "dawn_to_sunset", "dates": _dates_of("ramadan")})
        added["label"] = RAMADAN_LABEL
        added.setdefault("via", f"{_display(hit.word)} → nothing from dawn until sunset")

    def daylight(self, hit: Hit) -> None:
        added = self.add("daylight", {"kind": "daylight", "after_sunrise_min": DEFAULT_AFTER_SUNRISE_MIN})
        if hit.kind == "sunset":
            added.setdefault("via", f"{hit.word} → nothing until sunrise")
        else:
            added.setdefault("via", f"{_display(hit.word)} → nothing after sunset")

    def finish(self, normalized: str, kinds: set[str]) -> list[str]:
        """Settle the daylight minutes and days still waiting; returns day words nobody claimed (unclear)."""
        unclear = []
        if self.pending_festivals and self.last_festival is not None:
            for hit in self.pending_festivals:
                self._festival(hit, self.last_festival)
        if self.pending_days:
            if self.last_weekday is not None:
                self.last_weekday["weekdays"] = sorted({*self.last_weekday["weekdays"], *self.pending_days})
                self.last_weekday["label"] = _weekday_label(self.last_weekday["weekdays"], self.last_weekday)
            else:
                unclear = [WEEKDAY_NAMES[d]["en"].lower() for d in self.pending_days]
        daylight = self.by_key.get("daylight")
        if daylight is not None:
            minutes = _MINUTES.search(normalized)
            if minutes:
                daylight["after_sunrise_min"] = int(minutes.group(1))
            elif "sunrise" in kinds and not kinds & {"chauvihar", "navkarsi"}:
                daylight["after_sunrise_min"] = 0  # "nothing from sunset until sunrise"
            daylight["label"] = _daylight_label(daylight["after_sunrise_min"])
        return unclear


def _after_a_name(clause: str, hit: Hit) -> bool:
    """"Sushila Jain": the word before is someone's given name (not grammar, not a word we know)."""
    before = clause[: hit.start].split()
    if not before:
        return False
    token = before[-1]
    return token.isalpha() and not _is_grammar(token) and token not in lexicon()


@dataclass(frozen=True)
class _Context:
    soft: bool
    has_time_word: bool
    fasting: bool  # the message says "fast", "vrat", "roza" or "I keep it" somewhere


def _clause_foods(clause: str, hits: list[Hit], ctx: _Context, reading: Reading, time: _TimeRules) -> list[FoodHit]:
    """Diet words, food words and timing words of one ordinary clause (no weekday or festival in it)."""
    foods = []
    for i, hit in enumerate(hits):
        if hit.kind == "diet":
            polarity, _, _ = _polarity(hits, i)
            if polarity == "forbid":
                reading.unclear.append(hit.word)  # "not jain": we won't guess what that means
                continue
            if hit.word in SURNAME_DIETS and _after_a_name(clause, hit):
                continue  # a surname: nothing is inferred from a name
            reading.presets.extend((preset, hit.word, ctx.soft) for preset in hit.entry.value)
        elif hit.kind == "food":
            polarity, marker_soft, direction = _polarity(hits, i)
            foods.append(FoodHit(hit.entry.value, hit.word, polarity, ctx.soft or marker_soft, direction))
        elif hit.kind == "fast" and not ctx.has_time_word:
            reading.unclear.append(hit.word)  # a fast, but on which days?
        elif hit.kind == "ramadan" and (hit.entry.value or ctx.fasting):  # "Ramzan" alone may be a first name
            time.ramadan(hit)
        elif hit.kind in ("chauvihar", "navkarsi", "sunset"):
            time.daylight(hit)
    return foods


def read(text: str) -> Reading:
    """Read one message. Pure: no database, no model."""
    reading = Reading()
    normalized, flex_found = _strip_flex(_strip_names(normalize(text)))
    reading.flex = bool(flex_found)
    parts = clauses(normalized)
    all_hits = [find_hits(c) for c in parts]
    kinds = {h.kind for hits in all_hits for h in hits}
    has_time_word = bool(kinds & set(TIME_KINDS))
    fasting = bool(kinds & {"fast", "keep"}) or any(h.kind == "ramadan" and h.entry.value for hs in all_hits for h in hs)
    time = _TimeRules()
    per_clause: list[list[FoodHit]] = []

    for clause, hits in zip(parts, all_hits):
        reading.unclear += _leftover(clause, hits)
        weekdays = [h for h in hits if h.kind == "weekday"]
        festivals = [h for h in hits if h.kind == "observance"]
        if weekdays or festivals:
            claimed = _claimed_rule(hits)
            if festivals:
                time.festivals(festivals, claimed, kept=any(h.kind == "keep" for h in hits))
            else:
                time.weekdays(weekdays, claimed)
            per_clause.append([])
            continue
        ctx = _Context(soft=any(h.kind == "soft" for h in hits), has_time_word=has_time_word, fasting=fasting)
        per_clause.append(_clause_foods(clause, hits, ctx, reading, time))

    reading.unclear += time.finish(normalized, kinds)
    resolved = _inherit(per_clause)
    reading.foods = [f for foods in resolved for f in foods if f.polarity]
    # A food with no "no" or "OK" anywhere near it: we won't guess which way it goes.
    reading.unclear += [f.word for foods in resolved for f in foods if not f.polarity]
    reading.time_rules = time.rules
    reading.unclear = list(dict.fromkeys(reading.unclear))
    return reading


def _inherit(per_clause: list[list[FoodHit]]) -> list[list[FoodHit]]:
    """A clause that is only a list of foods ("no onion, garlic" / "pyaz, lahsun nahi") takes the "no" of its neighbour:
    the clause before if its "no" pointed forward, else the clause after if its "nahi" pointed back."""
    out = []
    for i, foods in enumerate(per_clause):
        if not foods or any(f.polarity for f in foods):
            out.append(foods)
            continue
        before = next((f for f in reversed(out[i - 1]) if f.polarity), None) if i > 0 else None
        after = next((f for f in per_clause[i + 1] if f.polarity), None) if i + 1 < len(per_clause) else None
        source = before if before and before.direction == "pre" else after if after and after.direction == "post" else None
        if source is None:
            out.append(foods)
            continue
        out.append([FoodHit(f.tags, f.word, source.polarity, source.soft or f.soft, source.direction) for f in foods])
    return out


def weekday_of(iso: str) -> int:
    return date.fromisoformat(iso[:10]).weekday()
