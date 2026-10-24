"""Every sentence m18 writes for people, in English, Hindi and Japanese. Food rules only, never a diet's name.

`txt(key, **values)` fills one template per language; a value that is itself a Text ({en, hi, ja}) is read in
the same language, so spec names and label marks come out in the reader's language.
"""
from typing import Any

Text = dict[str, str]
LANGS = ("en", "hi", "ja")

RUNG_LABEL: dict[str, Text] = {
    "ssr_change": {"en": "Special meal booked", "hi": "विशेष भोजन बुक", "ja": "特別食を予約"},
    "caterer_add": {"en": "On the kitchen's final list", "hi": "रसोई की अंतिम सूची में", "ja": "厨房の最終リストに追加"},
    "standby_uplift": {"en": "Caterer's standby stock", "hi": "कैटरर का स्टैंडबाय स्टॉक", "ja": "ケータリングの予備在庫"},
    "lounge": {"en": "Lounge meal", "hi": "लाउंज में भोजन", "ja": "ラウンジでのお食事"},
    "airside_partner": {"en": "Airside partner", "hi": "एयरसाइड पार्टनर", "ja": "空港内の提携店"},
    "onboard_spare": {"en": "Spare on board", "hi": "विमान में अतिरिक्त भोजन", "ja": "機内の予備食"},
    "noshow_release": {"en": "Freed by a no-show", "hi": "न आए यात्री का भोजन", "ja": "未搭乗の方の食事"},
    "reserve_pouch": {"en": "Universal plate (reserve)", "hi": "यूनिवर्सल प्लेट (रिज़र्व)", "ja": "ユニバーサルプレート（備蓄）"},
    "flex_swap": {"en": "Flex swap", "hi": "फ्लेक्स अदला-बदली", "ja": "フレックス交換"},
    "sunrise_box": {"en": "Sunrise Box", "hi": "सनराइज़ बॉक्स", "ja": "サンライズボックス"},
    "unmet": {"en": "Not met", "hi": "पूरा नहीं हुआ", "ja": "対応できず"},
}

TEXTS: dict[str, tuple[str, str, str]] = {
    # ---- why a rung was chosen
    "why.ssr_change": (
        "Before the special-meal cutoff: {code}{note} is booked as a proper special meal.",
        "स्पेशल-मील कटऑफ़ से पहले: {code}{note} सही विशेष भोजन के रूप में बुक है।",
        "特別食の締切前：{code}{note}を正式な特別食として予約しました。"),
    "why.caterer_add": (
        "Before the caterer's final list at {time}: {code}{note} goes on the next meal-list version.",
        "{time} की कैटरर की अंतिम सूची से पहले: {code}{note} अगली भोजन-सूची में जाएगा।",
        "{time}のケータリング最終リストの前：{code}{note}を次のミールリストに載せます。"),
    "why.caterer_add_lost": (
        "The rebooking dropped {code}{note}; staff requested it again before the final list at {time}. "
        "The passport travels with the passenger.",
        "री-बुकिंग में {code}{note} छूट गया; स्टाफ़ ने {time} की अंतिम सूची से पहले इसे फिर से माँगा। "
        "पासपोर्ट यात्री के साथ रहता है।",
        "予約変更で{code}{note}が消えたため、{time}の最終リストの前に再リクエストしました。パスポートはお客様と一緒に移ります。"),
    "why.standby_uplift": (
        "After the final list, before the trucks leave at {time}: one {code} from the standby stock at {caterer} "
        "({left} left after this; the stock is an assumption).",
        "अंतिम सूची के बाद, {time} पर ट्रक निकलने से पहले: {caterer} के स्टैंडबाय स्टॉक से एक {code} "
        "(इसके बाद {left} बचे; स्टॉक एक अनुमान है)।",
        "最終リストの後、{time}のトラック出発前：{caterer}の予備在庫から{code}を1食（残り{left}食。在庫数は仮定です）。"),
    "why.lounge": (
        "{lounge} serves business passengers around the clock: a {mark} meal before boarding.",
        "{lounge} बिज़नेस यात्रियों के लिए चौबीसों घंटे खुला है: बोर्डिंग से पहले {mark} भोजन।",
        "{lounge}はビジネスクラスのお客様に24時間対応：搭乗前に{mark}のお食事。"),
    "why.airside_partner": (
        "{partner} is open at {time}: a sealed {mark} meal to collect at the gate.",
        "{partner} {time} पर खुला है: गेट पर लेने के लिए सीलबंद {mark} भोजन।",
        "{partner}は{time}に営業中：ゲートで受け取る密封の{mark}のお食事。"),
    "why.onboard_spare": (
        "{spec} ({item}, galley {galley}) is free and fits: no hard or firm rule fired.",
        "{spec} ({item}, गैली {galley}) खाली है और सही है: कोई सख़्त या ज़रूरी नियम लागू नहीं हुआ।",
        "{spec}（{item}、ギャレー{galley}）は空いていて適合：厳格・必須の規則に該当なし。"),
    "why.held": (
        "Already holds {spec} ({item}, galley {galley}), which fits: no hard or firm rule fired.",
        "पहले से {spec} ({item}, गैली {galley}) है, जो सही है: कोई सख़्त या ज़रूरी नियम लागू नहीं हुआ।",
        "すでに{spec}（{item}、ギャレー{galley}）を確保済みで適合：厳格・必須の規則に該当なし。"),
    "why.noshow_release": (
        "{spec} ({item}, galley {galley}) was freed by the no-show in {seat} and fits: no hard or firm rule fired.",
        "{seat} के यात्री के न आने से {spec} ({item}, गैली {galley}) खाली हुआ और सही है: कोई सख़्त या ज़रूरी नियम लागू नहीं हुआ।",
        "{seat}の未搭乗で空いた{spec}（{item}、ギャレー{galley}）が適合：厳格・必須の規則に該当なし。"),
    "why.seat_release": (
        "{spec} ({item}, galley {galley}) was skipped on the seat screen at {seat} and fits: no hard or firm rule fired.",
        "{seat} की सीट-स्क्रीन पर छोड़ा गया {spec} ({item}, गैली {galley}) सही है: कोई सख़्त या ज़रूरी नियम लागू नहीं हुआ।",
        "{seat}の座席モニターで辞退された{spec}（{item}、ギャレー{galley}）が適合：厳格・必須の規則に該当なし。"),
    "why.reserve_pouch": (
        "Sealed universal plate {spec} ({item}, galley {galley}) fits: no hard or firm rule fired. Heat and serve.",
        "सीलबंद यूनिवर्सल प्लेट {spec} ({item}, गैली {galley}) सही है: कोई सख़्त या ज़रूरी नियम लागू नहीं हुआ। गरम करके परोसें।",
        "密封のユニバーサルプレート{spec}（{item}、ギャレー{galley}）が適合：厳格・必須の規則に該当なし。温めて提供。"),
    "why.flex_swap": (
        "{flex_seat} opted into flex and takes the {alt} (+{miles} miles), so {seat} gets the {spec} ({item}, galley {galley}).",
        "{flex_seat} ने फ्लेक्स चुना है और {alt} लेंगे (+{miles} मील), इसलिए {seat} को {spec} ({item}, गैली {galley}) मिलेगा।",
        "{flex_seat}はフレックスに同意し{alt}を選択（+{miles}マイル）。{seat}に{spec}（{item}、ギャレー{galley}）を提供。"),
    "why.sunrise_box": (
        "Under the daylight rule there is no time to eat on board: a sealed Sunrise Box to eat later.",
        "दिन के उजाले के नियम से विमान में खाने का समय नहीं है: बाद में खाने के लिए सीलबंद सनराइज़ बॉक्स।",
        "日中のみの規則では機内で食べる時間がありません：後で召し上がる密封のサンライズボックス。"),
    "why.unmet_voucher": (
        "Nothing still possible fits these rules: a ₹600 voucher for the airside outlets, told before boarding.",
        "अब संभव कोई भी भोजन इन नियमों के अनुरूप नहीं: एयरसाइड दुकानों के लिए ₹600 का वाउचर, बोर्डिंग से पहले बताया गया।",
        "今から用意できる食事に適合するものがありません：搭乗前にお知らせし、空港内店舗の₹600バウチャーを発行。"),
    "why.unmet_inflight": (
        "Nothing on board fits these rules: the crew tell the passenger honestly and offer only what is safe.",
        "विमान में कुछ भी इन नियमों के अनुरूप नहीं: क्रू यात्री को सच बताता है और केवल सुरक्षित चीज़ें देता है।",
        "機内に適合する食事がありません：クルーが正直にお伝えし、安全なものだけをお出しします。"),
    "why.no_show": (
        "{seat} did not board: {spec} ({item}, galley {galley}) is free for the next request instead of the bin.",
        "{seat} के यात्री नहीं आए: {spec} ({item}, गैली {galley}) फेंकने के बजाय अगले अनुरोध के लिए खाली है।",
        "{seat}のお客様は未搭乗：{spec}（{item}、ギャレー{galley}）は廃棄せず次のリクエストに回します。"),
    "why.no_show_empty": (
        "{seat} did not board; no meal was held for them.",
        "{seat} के यात्री नहीं आए; उनके लिए कोई भोजन नहीं रखा गया था।",
        "{seat}のお客様は未搭乗。確保していた食事はありません。"),
    "why.no_rules": (
        "No food rules: any main course suits.",
        "खाने का कोई नियम नहीं: कोई भी मुख्य भोजन चलेगा।",
        "食事の制限なし：どのメインでも大丈夫です。"),
    "why.dry_run": (
        "Possible now for these rules; nothing is held until a passenger is named.",
        "इन नियमों के लिए अभी संभव; यात्री का नाम मिलने तक कुछ नहीं रखा गया।",
        "この規則なら現在対応可能。お客様が特定されるまで何も確保しません。"),
    # ---- why a rung was skipped
    "skip.lounge_cabin": (
        "The DEL lounge serves business (C) passengers only; {seat} is in economy.",
        "DEL लाउंज केवल बिज़नेस (C) यात्रियों के लिए है; {seat} इकोनॉमी में है।",
        "DELのラウンジはビジネスクラス（C）専用。{seat}はエコノミーです。"),
    "skip.lounge_none": (
        "No partner lounge at {airport}.", "{airport} पर कोई पार्टनर लाउंज नहीं।", "{airport}に提携ラウンジはありません。"),
    "skip.partner_closed": (
        "Delhi airside partners are closed at {time} (closed 00:00–05:00).",
        "दिल्ली के एयरसाइड पार्टनर {time} पर बंद हैं (00:00–05:00 बंद)।",
        "デリーの空港内提携店は{time}は閉店中（00:00〜05:00は閉店）。"),
    "skip.partner_none": (
        "No airside partner at {airport}.", "{airport} पर कोई एयरसाइड पार्टनर नहीं।", "{airport}に空港内の提携店はありません。"),
    "skip.standby_none": (
        "The standby stock has nothing that fits (left: {stock}; the stock is an assumption).",
        "स्टैंडबाय स्टॉक में कुछ भी सही नहीं (बचा: {stock}; स्टॉक एक अनुमान है)।",
        "予備在庫に適合するものがありません（残り：{stock}。在庫数は仮定です）。"),
    "skip.spare_none": (
        "No free spare meal on board fits these rules.",
        "विमान में कोई खाली अतिरिक्त भोजन इन नियमों के अनुरूप नहीं।",
        "機内の空いている予備食に、この規則に適合するものがありません。"),
    "skip.spare_runout": (
        "No free spare special meal fits, and the main course is what ran out.",
        "कोई खाली अतिरिक्त विशेष भोजन सही नहीं, और मुख्य भोजन ही ख़त्म हुआ है।",
        "適合する予備の特別食がなく、不足しているのはメインそのものです。"),
    "skip.release_none": (
        "No meal has been freed by a no-show.",
        "किसी न आए यात्री का कोई भोजन खाली नहीं हुआ।",
        "未搭乗で空いた食事はありません。"),
    "skip.release_unsafe": (
        "The meal freed in {seat} doesn't fit: {fired}.",
        "{seat} में खाली हुआ भोजन सही नहीं: {fired}।",
        "{seat}で空いた食事は不適合：{fired}。"),
    "skip.reserve_none": (
        "No free universal plate: the last {n} stay for galley contingencies.",
        "कोई खाली यूनिवर्सल प्लेट नहीं: आख़िरी {n} गैली की आपात स्थिति के लिए हैं।",
        "空いているユニバーサルプレートがありません：最後の{n}食はギャレーの非常用です。"),
    "skip.reserve_unsafe": (
        "The reserve plate ({spec}) doesn't fit: {fired}.",
        "रिज़र्व प्लेट ({spec}) सही नहीं: {fired}।",
        "備蓄プレート（{spec}）は不適合：{fired}。"),
    "skip.flex_no_main": (
        "No main-course dish fits these rules: {fired}.",
        "कोई भी मुख्य व्यंजन इन नियमों के अनुरूप नहीं: {fired}।",
        "この規則に適合するメインがありません：{fired}。"),
    "skip.flex_none": (
        "No flex passenger in reach can switch.",
        "पास में कोई फ्लेक्स यात्री बदल नहीं सकता।",
        "交換できるフレックスのお客様が近くにいません。"),
    "skip.sun_no_rule": (
        "No daylight-only rule.", "केवल दिन में खाने का कोई नियम नहीं।", "日中のみの規則はありません。"),
    "skip.sun_unknown": (
        "Sun times at the aircraft aren't available.", "विमान पर सूर्य का समय उपलब्ध नहीं।", "機体位置での日の出時刻を取得できません。"),
    "skip.sun_can_eat": (
        "There is time to eat on board from {time}.", "{time} से विमान में खाने का समय है।", "{time}から機内で食べられます。"),
    "skip.long_lead": (
        "JAL takes minimal-allergen and kosher meals until 49 h before departure ({when} IST); that line has passed.",
        "JAL न्यूनतम-एलर्जन और कोशर भोजन प्रस्थान से 49 घंटे पहले ({when} IST) तक ही लेता है; वह समय निकल चुका है।",
        "JALの低アレルゲン食とコーシャ食の受付は出発の49時間前（{when} IST）までで、すでに締め切られています。"),
    "skipped": (" Skipped: ", " छोड़े गए: ", "見送り："),
    # ---- what the passenger is told
    "msg.ssr_change": (
        "Done: your {code} meal ({mark}) is booked on {flight}.",
        "हो गया: {flight} पर आपका {code} भोजन ({mark}) बुक है।",
        "完了：{flight}で{code}のお食事（{mark}）を予約しました。"),
    "msg.caterer_add": (
        "Added to the kitchen's final list at {time}: your {code} meal ({mark}) on {flight}.",
        "{time} की रसोई की अंतिम सूची में जोड़ा गया: {flight} पर आपका {code} भोजन ({mark})।",
        "{time}の厨房最終リストに追加しました：{flight}の{code}のお食事（{mark}）。"),
    "msg.caterer_add_lost": (
        "Your meal request dropped off your booking when your connection was rebooked. We asked for it again: "
        "your {code} meal ({mark}) is on the kitchen's final list at {time}.",
        "कनेक्शन री-बुक होने पर आपका भोजन अनुरोध बुकिंग से हट गया था। हमने फिर से माँगा है: "
        "आपका {code} भोजन ({mark}) {time} की रसोई की अंतिम सूची में है।",
        "乗り継ぎ便の変更でお食事のリクエストが予約から消えていました。再リクエスト済みです："
        "{code}のお食事（{mark}）は{time}の厨房最終リストに載っています。"),
    "msg.standby_uplift": (
        "The kitchen is sending a {code_name} ({mark}) from its standby stock to {flight}. "
        "The crew will have it for you in galley {galley}.",
        "रसोई अपने स्टैंडबाय स्टॉक से {flight} पर {code_name} ({mark}) भेज रही है। क्रू इसे गैली {galley} में आपके लिए रखेगा।",
        "厨房が予備在庫から{code_name}（{mark}）を{flight}に積み込みます。ギャレー{galley}でクルーがご用意します。"),
    "msg.lounge": (
        "Your {mark} meal is ready at {lounge} before boarding. Show this message at the desk.",
        "बोर्डिंग से पहले {lounge} में आपका {mark} भोजन तैयार है। डेस्क पर यह संदेश दिखाएँ।",
        "搭乗前に{lounge}で{mark}のお食事をご用意しています。受付でこのメッセージをお見せください。"),
    "msg.airside_partner": (
        "A sealed {mark} meal is waiting for you at {partner}. Collect it before boarding.",
        "{partner} पर आपके लिए सीलबंद {mark} भोजन तैयार है। बोर्डिंग से पहले ले लें।",
        "{partner}で密封の{mark}のお食事をご用意しています。搭乗前にお受け取りください。"),
    "msg.onboard": (
        "Held for you on board: {spec} (galley {galley}). It fits your food rules: {mark}.",
        "विमान में आपके लिए रखा है: {spec} (गैली {galley})। यह आपके खाने के नियमों के अनुरूप है: {mark}।",
        "機内で{spec}を確保しました（ギャレー{galley}）。お食事の規則に適合しています：{mark}。"),
    "msg.reserve_pouch": (
        "A sealed meal that fits your food rules ({mark}) is held for you on board: {spec}. The crew will heat it for you.",
        "विमान में आपके लिए आपके नियमों ({mark}) के अनुरूप सीलबंद भोजन रखा है: {spec}। क्रू इसे गरम करेगा।",
        "お食事の規則（{mark}）に適合する密封のお食事を機内で確保しました：{spec}。クルーが温めます。"),
    "msg.flex_requester": (
        "The crew will bring you the {spec}. It fits your food rules: {mark}.",
        "क्रू आपके लिए {spec} लाएगा। यह आपके खाने के नियमों के अनुरूप है: {mark}।",
        "クルーが{spec}をお持ちします。お食事の規則に適合しています：{mark}。"),
    "msg.flex_giver": (
        "Thank you for taking the {alt} today, so another passenger could have a meal that fits their food rules. "
        "+{miles} miles have been added to your account.",
        "आज {alt} लेने के लिए धन्यवाद, ताकि दूसरे यात्री को उनके नियमों के अनुरूप भोजन मिल सके। "
        "आपके खाते में +{miles} मील जोड़ दिए गए हैं।",
        "本日{alt}をお選びいただきありがとうございます。おかげで他のお客様が規則に合うお食事を召し上がれました。"
        "+{miles}マイルを加算しました。"),
    "msg.sunrise_box": (
        "The crew will hand you a sealed Sunrise Box that fits your food rules ({mark}), to eat when your rule allows.",
        "क्रू आपको आपके नियमों ({mark}) के अनुरूप सीलबंद सनराइज़ बॉक्स देगा, जिसे आप अपने नियम के अनुसार खा सकें।",
        "お食事の規則（{mark}）に適合する密封のサンライズボックスをお渡しします。規則で許される時間にお召し上がりください。"),
    "msg.unmet_voucher": (
        "We're sorry: no meal still possible fits your food rules ({mark}). Here is a ₹600 voucher {voucher} "
        "for the airside outlets at DEL T3; please eat before you board.",
        "क्षमा करें: अब संभव कोई भोजन आपके नियमों ({mark}) के अनुरूप नहीं है। DEL T3 एयरसाइड दुकानों के लिए "
        "₹600 का वाउचर {voucher}; कृपया बोर्डिंग से पहले खा लें।",
        "申し訳ありません。今から用意できる食事でお食事の規則（{mark}）に合うものがありません。"
        "DEL T3空港内店舗で使える₹600のバウチャー{voucher}をお送りします。搭乗前にお召し上がりください。"),
    "msg.unmet_inflight": (
        "We're sorry: nothing on board fits your food rules ({mark}). The crew will tell you honestly what on board is safe for you.",
        "क्षमा करें: विमान में कुछ भी आपके नियमों ({mark}) के अनुरूप नहीं है। क्रू आपको सच-सच बताएगा कि क्या सुरक्षित है।",
        "申し訳ありません。機内にお食事の規則（{mark}）に合うものがありません。安全なものをクルーが正直にお伝えします。"),
    # ---- what today's process does with the same event
    "today.no_rules": (
        "No food rules: any main course suits.",
        "खाने का कोई नियम नहीं: कोई भी मुख्य भोजन चलेगा।",
        "食事の制限なし：どのメインでも大丈夫です。"),
    "today.before_cutoff": (
        "Before the cutoff a special-meal request works today too.",
        "कटऑफ़ से पहले आज भी विशेष भोजन का अनुरोध काम करता है।",
        "締切前なら現在の運用でも特別食のリクエストは通ります。"),
    "today.long_lead": (
        "Minimal-allergen and kosher meals close 49 h before departure: the website won't take it any more.",
        "न्यूनतम-एलर्जन और कोशर भोजन प्रस्थान से 49 घंटे पहले बंद हो जाते हैं: वेबसाइट अब इसे नहीं लेती।",
        "低アレルゲン食とコーシャ食は出発の49時間前に締め切られ、ウェブサイトではもう受け付けられません。"),
    "today.no_channel": (
        "No channel after the 25 h cutoff: the request goes nowhere.",
        "25 घंटे के कटऑफ़ के बाद कोई रास्ता नहीं: अनुरोध कहीं नहीं जाता।",
        "25時間前の締切後は窓口がなく、リクエストはどこにも届きません。"),
    "today.too_late": (
        "Check-in: \"too late to order a special meal\".",
        "चेक-इन: \"विशेष भोजन के लिए बहुत देर हो चुकी है\"।",
        "チェックイン：「特別食の手配には間に合いません」。"),
    "today.lounge": (
        "The lounge can't order a meal for the flight.",
        "लाउंज उड़ान के लिए भोजन ऑर्डर नहीं कर सकता।",
        "ラウンジから機内食は手配できません。"),
    "today.lost": (
        "Nobody notices the dropped request: no special meal on board.",
        "छूटे हुए अनुरोध पर किसी का ध्यान नहीं जाता: विमान में कोई विशेष भोजन नहीं।",
        "消えたリクエストに誰も気づかず、機内に特別食はありません。"),
    "today.thrown": (
        "Their {code} meal is thrown away.",
        "उनका {code} भोजन फेंक दिया जाता है।",
        "その{code}のお食事は廃棄されます。"),
    "today.nothing_held": (
        "No meal was held for them: nothing to throw away.",
        "उनके लिए कोई भोजन नहीं रखा था: फेंकने को कुछ नहीं।",
        "確保していた食事はなく、廃棄もありません。"),
    "today.run_out": (
        "Run-out: the paneer is gone before {seats}; nothing else on board is checked for them.",
        "भोजन ख़त्म: {seats} तक पहुँचने से पहले पनीर ख़त्म; उनके लिए और कुछ जाँचा नहीं जाता।",
        "品切れ：{seats}の前でパニールがなくなり、ほかに確認された食事はありません。"),
    "today.fast": (
        "The veg main has grains and lentils; nothing on board fits a fast.",
        "शाकाहारी मुख्य भोजन में अनाज और दालें हैं; विमान में कुछ भी व्रत के अनुरूप नहीं।",
        "ベジのメインには穀物と豆が入っており、機内に断食に合う食事はありません。"),
    "today.luck": (
        "Met by luck: the crew happened to have a spare {code}; nobody checked it against the rules.",
        "किस्मत से मिला: क्रू के पास संयोग से अतिरिक्त {code} था; किसी ने नियमों से जाँचा नहीं।",
        "偶然対応：たまたま予備の{code}がありましたが、規則との照合は誰もしていません。"),
    "today.unchecked_unsafe": (
        "The crew hand over a spare {code} without a check: {fired}.",
        "क्रू बिना जाँचे अतिरिक्त {code} दे देता है: {fired}।",
        "クルーが確認せずに予備の{code}を渡します：{fired}。"),
    "today.no_spare": (
        "The crew have no spare {code}; nothing else on board is checked for these rules.",
        "क्रू के पास अतिरिक्त {code} नहीं; इन नियमों के लिए और कुछ जाँचा नहीं जाता।",
        "予備の{code}はなく、この規則に合うか確認された食事もありません。"),
}


def pick(value: Any, lang: str) -> Any:
    """A Text read in one language (English if that language is missing); anything else as it is."""
    if isinstance(value, dict):
        return value.get(lang) or value.get("en") or ""
    return value


def txt(key: str, **values: Any) -> Text:
    return {lang: tpl.format(**{k: pick(v, lang) for k, v in values.items()}) for lang, tpl in zip(LANGS, TEXTS[key])}


def join(*parts: Text) -> Text:
    return {lang: "".join(p.get(lang, "") for p in parts) for lang in LANGS}


def first(text: Text | None, lang: str) -> Text | None:
    """The same Text with the passenger's language first (the order the chat shows them)."""
    if text is None:
        return None
    return {lang: text[lang], **{k: v for k, v in text.items() if k != lang}} if lang in text else text


def note_suffix(note: str | None) -> str:
    return f" + {note}" if note else ""
