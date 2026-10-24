"""The demo story (v2): six steps over the sim clock, each with the presenter's cue. See docs/plan/v2.md."""
from dataclasses import dataclass
from datetime import datetime

from app.core.clock import IST, JST


@dataclass(frozen=True)
class Step:
    n: int
    act: int
    sim_time: datetime
    screen: str
    title: dict
    cue: dict
    auto: str | None = None  # what "Do it for me" does, shown on the button


STEPS: tuple[Step, ...] = (
    Step(
        0, 0, datetime(2026, 10, 23, 18, 0, tzinfo=IST), "/demo",
        {"en": "JAL listens once, 25 h before take-off", "hi": "JAL सिर्फ़ एक बार सुनता है, उड़ान से 25 घंटे पहले", "ja": "JALが聞くのは出発25時間前の一度だけ"},
        {"en": "The ladder: no meal changes after 24 Oct 03:35. Judges scan the QR.",
         "hi": "सीढ़ी: 24 अक्टूबर 03:35 के बाद भोजन नहीं बदलता। जज QR स्कैन करें।",
         "ja": "はしご：10月24日03:35以降は変更不可。審査員はQRを読み取り。"},
    ),
    Step(
        1, 1, datetime(2026, 10, 23, 18, 10, tzinfo=IST), "/jal",
        {"en": "Priya ticks what she doesn't eat", "hi": "प्रिया चुनती हैं क्या नहीं खातीं", "ja": "プリヤが食べられないものを選ぶ"},
        {"en": "Phone /jal → My Booking 6XK2QP · SHARMA → Special meal: Vegetarian, Onion & garlic, Purnima fast → Save.",
         "hi": "फ़ोन /jal → My Booking 6XK2QP · SHARMA → Special meal: Vegetarian, Onion & garlic, Purnima fast → Save।",
         "ja": "スマホ /jal → 予約確認 6XK2QP・SHARMA → 特別食：ベジタリアン、玉ねぎ・にんにく、満月の断食 → 保存。"},
        auto="Save Priya's form",
    ),
    Step(
        2, 1, datetime(2026, 10, 23, 18, 12, tzinfo=IST), "/jal/meal?passenger=PX-0057",
        {"en": "The Radar asks before the cutoff", "hi": "रडार कटऑफ़ से पहले पूछता है", "ja": "レーダーが締切前に確認"},
        {"en": "Same page: Sun 25 Oct is Sharad Purnima, keeping the fast? → Yes → the fasting meal.",
         "hi": "वही पेज: रवि 25 अक्टूबर शरद पूर्णिमा, व्रत रखेंगी? → हाँ → व्रत वाला भोजन।",
         "ja": "同じページ：10月25日はシャラド・プールニマー、断食しますか？ → はい → 断食食。"},
        auto="Answer Yes",
    ),
    Step(
        3, 2, datetime(2026, 10, 24, 11, 30, tzinfo=IST), "/ops/changes",
        {"en": "Chaos Mode: seven late changes", "hi": "केओस मोड: सात देर से आए बदलाव", "ja": "カオスモード：直前の変更7件"},
        {"en": "/ops/changes → Run Chaos Mode: seven late changes land on the ladder.",
         "hi": "/ops/changes → Run Chaos Mode: सात बदलाव सीढ़ी पर।",
         "ja": "/ops/changes → カオスモード実行：変更7件がはしごに並ぶ。"},
        auto="Run Chaos Mode",
    ),
    Step(
        4, 3, datetime(2026, 10, 25, 6, 30, tzinfo=IST), "/crew",
        {"en": "In the air: the crew copilot", "hi": "हवा में: क्रू कोपायलट", "ja": "機内：クルーコパイロット"},
        {"en": "iPad /crew: Download → Ask seats now → /seat?seat=23C: Yes. Airplane mode → 2A's card, 23C red then green.",
         "hi": "iPad /crew: डाउनलोड → Ask seats now → /seat?seat=23C: हाँ। एयरप्लेन मोड → 2A का कार्ड, 23C लाल फिर हरा।",
         "ja": "iPad /crew：ダウンロード → 座席に確認 → /seat?seat=23C：はい。機内モード → 2Aのカード、23Cは赤→緑。"},
        auto="Ask the seats and sync the crew's scans",
    ),
    Step(
        5, 4, datetime(2026, 10, 25, 15, 20, tzinfo=JST), "/ops/changes",
        {"en": "Landed: ThaliBento vs today", "hi": "पहुँच गए: ThaliBento बनाम आज", "ja": "到着：ThaliBentoと現在の運用"},
        {"en": "/ops/changes: the numbers vs today. Then /ops/load.",
         "hi": "/ops/changes: आज के मुक़ाबले आँकड़े। फिर /ops/load।",
         "ja": "/ops/changes：現在の運用との比較。続いて /ops/load。"},
    ),
)

BY_N = {s.n: s for s in STEPS}
