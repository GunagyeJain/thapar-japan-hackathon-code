"""The demo story: nine steps over the sim clock, each with the presenter's cue."""
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
        {"en": "Reset: 23 Oct, 18:00 in Delhi", "hi": "रीसेट: 23 अक्टूबर, 18:00 दिल्ली", "ja": "リセット：10月23日 18:00（デリー）"},
        {"en": "Show the boarding pass. Invite the judges now: scan the QR to join JL740.",
         "hi": "बोर्डिंग पास दिखाएँ। जजों को अभी बुलाएँ: QR स्कैन करके JL740 से जुड़ें।",
         "ja": "搭乗券を見せ、審査員にQRでJL740への参加を案内します。"},
    ),
    Step(
        1, 1, datetime(2026, 10, 23, 18, 10, tzinfo=IST), "/p",
        {"en": "Priya tells us her food rules", "hi": "प्रिया अपने खाने के नियम बताती हैं", "ja": "プリヤが食事の規則を登録"},
        {"en": "Phone, /p: Priya (6XK2QP, SHARMA) ticks Vegetarian + No onion, no garlic → AVML with NO ONION NO GARLIC. Then /ops shows WRONG_CODE for 24A.",
         "hi": "फ़ोन, /p: प्रिया शाकाहारी + बिना प्याज़-लहसुन चुनती हैं → AVML। फिर /ops पर 24A का WRONG_CODE।",
         "ja": "スマホ /p：プリヤがベジ＋玉ねぎ・にんにくなしを選択 → AVML。/opsで24AのWRONG_CODEを表示。"},
        auto="Save Priya's profile",
    ),
    Step(
        2, 2, datetime(2026, 10, 24, 23, 2, tzinfo=IST), "/ops",
        {"en": "Priya's inbound is rebooked; her meal drops", "hi": "प्रिया की उड़ान बदली, भोजन छूट गया", "ja": "乗継便の変更で特別食が消える"},
        {"en": "/ops: the LOST_MEAL alert for 23C, the ADL evidence, and the countdown to the caterer's final list (1 h 38 m).",
         "hi": "/ops: 23C का LOST_MEAL अलर्ट, ADL सबूत, और कैटरर की अंतिम सूची तक उलटी गिनती।",
         "ja": "/ops：23CのLOST_MEALアラート、ADLの証拠、ケータリング最終リストまでのカウントダウン。"},
    ),
    Step(
        3, 2, datetime(2026, 10, 24, 23, 9, tzinfo=IST), "/ops",
        {"en": "Ops requests the meal again", "hi": "ऑप्स भोजन फिर से माँगता है", "ja": "オペレーションが再リクエスト"},
        {"en": "/ops: open the alert → Request again. C2 turns from red to fixed.",
         "hi": "/ops: अलर्ट खोलें → फिर से माँगें। C2 लाल से ठीक हो जाता है।",
         "ja": "/ops：アラートを開き「再リクエスト」。C2が赤から修正済みに。"},
        auto="Request again",
    ),
    Step(
        4, 3, datetime(2026, 10, 25, 0, 40, tzinfo=IST), "/caterer",
        {"en": "Caterer gets meal list v3", "hi": "कैटरर को भोजन सूची v3 मिली", "ja": "ケータリングがミールリストv3を受領"},
        {"en": "/caterer: the diff (6XK2QP → 8MZ2TN), Acknowledge, then the labels.",
         "hi": "/caterer: बदलाव (6XK2QP → 8MZ2TN), स्वीकार करें, फिर लेबल।",
         "ja": "/caterer：差分（6XK2QP → 8MZ2TN）、受領確認、ラベル。"},
        auto="Acknowledge v3",
    ),
    Step(
        5, 4, datetime(2026, 10, 25, 2, 50, tzinfo=IST), "/ops/late",
        {"en": "Mehta asks for a Jain meal at the gate", "hi": "मेहता गेट पर जैन भोजन माँगते हैं", "ja": "メータがゲートでジャイナ食を依頼"},
        {"en": "/ops/late: find 31K MEHTA, tick Jain, Find a safe meal → spare VJML in galley 2. Reserve.",
         "hi": "/ops/late: 31K मेहता, जैन चुनें, सुरक्षित भोजन खोजें → गैली 2 का VJML। आरक्षित करें।",
         "ja": "/ops/late：31Kメータ、ジャイナを選び検索 → ギャレー2の予備VJML。確保。"},
        auto="Reserve for 31K",
    ),
    Step(
        6, 5, datetime(2026, 10, 25, 3, 35, tzinfo=IST), "/crew",
        {"en": "Boarding: crew download the flight", "hi": "बोर्डिंग: क्रू उड़ान डाउनलोड करता है", "ja": "搭乗：クルーがフライトをダウンロード"},
        {"en": "/crew: download for JL740. Boarding alerts, Mehta's reserved meal and the judges' seats are there.",
         "hi": "/crew: JL740 डाउनलोड करें। बोर्डिंग अलर्ट, मेहता का भोजन और जजों की सीटें।",
         "ja": "/crew：JL740をダウンロード。搭乗アラート、メータの確保食、審査員の座席。"},
    ),
    Step(
        7, 5, datetime(2026, 10, 25, 5, 20, tzinfo=IST), "/crew",
        {"en": "In the air, offline: galley check and seat scans", "hi": "उड़ान में, ऑफ़लाइन: गैली जाँच और सीट स्कैन", "ja": "機内オフライン：ギャレー確認と座席スキャン"},
        {"en": "Tablet offline: galley check 7 of 8, 27D's tray is missing → backup from galley 2. Scan 23C: green.",
         "hi": "टैबलेट ऑफ़लाइन: गैली जाँच 8 में 7, 27D की ट्रे गायब → गैली 2 से बैकअप। 23C स्कैन: हरा।",
         "ja": "オフライン：ギャレー確認8件中7件、27Dのトレイ不足 → ギャレー2の予備食。23Cをスキャン：緑。"},
        auto="Sync the crew's scans",
    ),
    Step(
        8, 6, datetime(2026, 10, 25, 15, 20, tzinfo=JST), "/insights",
        {"en": "Landed in Tokyo: the promise held", "hi": "टोक्यो पहुँचे: वादा निभा", "ja": "東京着：約束は守られた"},
        {"en": "/insights: Priya's timeline, C1 to C5, and the backup numbers.",
         "hi": "/insights: प्रिया की टाइमलाइन, C1 से C5, और बैकअप के आँकड़े।",
         "ja": "/insights：プリヤのタイムライン（C1〜C5）と予備食の数字。"},
    ),
)

BY_N = {s.n: s for s in STEPS}
