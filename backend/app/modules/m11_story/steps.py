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
        {"en": "Show the cutoff ladder: after 24 Oct 03:35 there is no channel for a meal change. Invite the judges: scan the QR to join JL740.",
         "hi": "कटऑफ़ सीढ़ी दिखाएँ: 24 अक्टूबर 03:35 के बाद भोजन बदलने का कोई रास्ता नहीं। जजों को QR से JL740 में बुलाएँ।",
         "ja": "締切のはしごを表示：10月24日03:35以降は食事変更の窓口がありません。審査員をQRでJL740に招待。"},
    ),
    Step(
        1, 1, datetime(2026, 10, 23, 18, 10, tzinfo=IST), "/chat",
        {"en": "Priya says it her way", "hi": "प्रिया अपने शब्दों में बताती हैं", "ja": "プリヤが自分の言葉で伝える"},
        {"en": "Phone /chat (6XK2QP, SHARMA): type or say \"pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon\" → That's right → AVML + NO ONION NO GARLIC.",
         "hi": "फ़ोन /chat: लिखें या बोलें \"pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon\" → सही है → AVML + NO ONION NO GARLIC।",
         "ja": "スマホ /chat：「pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon」と入力または音声 → 確認 → AVML＋NO ONION NO GARLIC。"},
        auto="Save Priya's passport",
    ),
    Step(
        2, 1, datetime(2026, 10, 23, 18, 12, tzinfo=IST), "/chat",
        {"en": "The Radar asks before the cutoff", "hi": "रडार कटऑफ़ से पहले पूछता है", "ja": "レーダーが締切前に確認"},
        {"en": "Phone: \"Your JL740 on Sun 25 Oct falls on Sharad Purnima. Keeping the fast?\" → Yes → her meal becomes the fasting version, a day before the cutoff.",
         "hi": "फ़ोन: \"आपकी JL740 रवि 25 अक्टूबर, शरद पूर्णिमा पर है। व्रत रखेंगी?\" → हाँ → कटऑफ़ से पहले भोजन व्रत वाला।",
         "ja": "スマホ：「10月25日（日）のJL740はシャラド・プールニマです。断食しますか？」→ はい → 締切前に断食食へ。"},
        auto="Answer Yes",
    ),
    Step(
        3, 2, datetime(2026, 10, 24, 11, 30, tzinfo=IST), "/ops/changes",
        {"en": "Chaos Mode: seven late changes", "hi": "केओस मोड: सात देर से आए बदलाव", "ja": "カオスモード：直前の変更7件"},
        {"en": "/ops/changes → Run Chaos Mode: from 24 Oct 11:30 to 25 Oct 06:30, seven late changes land on the ladder, each passenger gets an answer, and the Today column shows what happens now.",
         "hi": "/ops/changes → Run Chaos Mode: 24 अक्टूबर 11:30 से 25 अक्टूबर 06:30 तक सात बदलाव, हर यात्री को जवाब, और आज क्या होता है।",
         "ja": "/ops/changes → カオスモード実行：10月24日11:30〜25日06:30の変更7件がはしごに並び、各乗客へ回答、「現在の運用」列と比較。"},
        auto="Run Chaos Mode",
    ),
    Step(
        4, 3, datetime(2026, 10, 25, 6, 30, tzinfo=IST), "/crew",
        {"en": "In the air: the crew copilot", "hi": "हवा में: क्रू कोपायलट", "ja": "機内：クルーコパイロット"},
        {"en": "iPad /crew: Download → Copilot: Ask seats now; /seat?seat=23C: Yes → 23C confirmed at seat. Airplane mode → seats by strictness, 2A's card in Japanese with her sun timer, the serve list; galley check (27D → backup); 23C: wrong tray red, right tray green.",
         "hi": "iPad /crew: डाउनलोड → कोपायलट: Ask seats now; /seat?seat=23C: हाँ → 23C सीट पर पक्का। एयरप्लेन मोड → सीटें सख़्ती के हिसाब से, 2A का कार्ड और सूर्य टाइमर, परोसने की सूची; 23C: ग़लत ट्रे लाल, सही हरी।",
         "ja": "iPad /crew：ダウンロード → コパイロット：座席に確認する；/seat?seat=23C：はい → 23Cは座席で確認済。機内モード → 座席の厳格度、2Aのカード（日本語）と日の出タイマー、配膳リスト；23C：誤トレイは赤、正しいトレイは緑。"},
        auto="Ask the seats and sync the crew's scans",
    ),
    Step(
        5, 4, datetime(2026, 10, 25, 15, 20, tzinfo=JST), "/ops/changes",
        {"en": "Landed: ThaliBento vs today", "hi": "पहुँच गए: ThaliBento बनाम आज", "ja": "到着：ThaliBentoと現在の運用"},
        {"en": "/ops/changes: hard needs met, meals thrown away, diets known before the cutoff, ThaliBento vs today. Then /ops/load: the reserve that never goes bad and the universal plate.",
         "hi": "/ops/changes: सख़्त ज़रूरतें पूरी, फेंका गया भोजन, कटऑफ़ से पहले पता चले आहार: ThaliBento बनाम आज। फिर /ops/load।",
         "ja": "/ops/changes：厳格な要件の充足、廃棄食、締切前に把握した食事、ThaliBentoと現在の比較。続いて /ops/load。"},
    ),
)

BY_N = {s.n: s for s in STEPS}
