"""Calendar Radar: checks each trip date against a passenger's time rules and asks one tap-to-answer question
before the cutoff: "Your JL740 on Sun 25 Oct falls on Sharad Purnima. Keeping the fast?"

The question is phrased from the public calendar (shared/rules/calendar.json). The passport only says on which
dates the rule may apply, never why. "Yes" confirms the date (the fasting meal is ordered while the special-meal
window is open, else the change router takes it); "No" declines it and the usual meal stays.
"""
import logging
from datetime import date
from typing import Any

from sqlmodel import Session, select

from app.core import clock, outbox
from app.core.ids import new_id
from app.core.models import Flight, Passenger
from app.modules.m1_rules import engine
from app.modules.m16_days.models import TripLeg
from app.modules.m17_passport import service
from app.modules.m17_passport.models import Passport, RadarQuestion

log = logging.getLogger(__name__)

WEEKDAY_NAMES = {
    0: {"en": "Monday", "hi": "सोमवार", "ja": "月曜日"},
    1: {"en": "Tuesday", "hi": "मंगलवार", "ja": "火曜日"},
    2: {"en": "Wednesday", "hi": "बुधवार", "ja": "水曜日"},
    3: {"en": "Thursday", "hi": "गुरुवार", "ja": "木曜日"},
    4: {"en": "Friday", "hi": "शुक्रवार", "ja": "金曜日"},
    5: {"en": "Saturday", "hi": "शनिवार", "ja": "土曜日"},
    6: {"en": "Sunday", "hi": "रविवार", "ja": "日曜日"},
}


LANGS = ("en", "hi", "ja")
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"]
WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
WEEKDAYS_JA = "月火水木金土日"

YES = {
    "vrat": {"en": "Yes, fasting meal", "hi": "हाँ, व्रत का खाना", "ja": "はい、断食用のお食事"},
    "vegetarian": {"en": "Yes, vegetarian meal", "hi": "हाँ, शाकाहारी खाना", "ja": "はい、ベジタリアン食"},
    None: {"en": "Yes, as I told you", "hi": "हाँ, जैसा मैंने बताया", "ja": "はい、伝えたとおりに"},
}
NO = {"en": "No, my usual meal", "hi": "नहीं, मेरा सामान्य खाना", "ja": "いいえ、いつものお食事"}
ASK = {
    "vrat": {"en": "Keeping the fast?", "hi": "क्या आप व्रत रखेंगे?", "ja": "断食されますか？"},
    "vegetarian": {"en": "Vegetarian that day?", "hi": "क्या उस दिन शाकाहारी खाना चाहिए?", "ja": "その日はベジタリアン食にしますか？"},
    None: {"en": "Keeping your rule that day?", "hi": "क्या उस दिन आपका नियम रहेगा?", "ja": "その日の決まりを守られますか？"},
}


def _lang(lang: str | None) -> str:
    return lang if lang in LANGS else "en"


def day_text(iso: str) -> dict[str, str]:
    """"Sun 25 Oct", "रविवार, 25 अक्टूबर", "10月25日（日）"."""
    d = date.fromisoformat(iso)
    return {
        "en": f"{WEEKDAYS_EN[d.weekday()]} {d.day} {MONTHS_EN[d.month - 1]}",
        "hi": f"{WEEKDAY_NAMES[d.weekday()]['hi']}, {d.day} {MONTHS_HI[d.month - 1]}",
        "ja": f"{d.month}月{d.day}日（{WEEKDAYS_JA[d.weekday()]}）",
    }


def _title(flight_no: str) -> dict[str, str]:
    return {"en": f"Meal check · {flight_no}", "hi": f"भोजन की पुष्टि · {flight_no}", "ja": f"お食事の確認 · {flight_no}"}


def calendar_label(iso: str, rule: dict[str, Any]) -> dict[str, str] | None:
    """What the public calendar calls this date ("Sharad Purnima"); the observance whose dates match the rule wins."""
    hits = [(o, d) for o in engine.calendar()["observances"] for d in o["days"] if d["date"] == iso]
    if not hits:
        return None
    rule_dates = set(rule.get("dates", []))
    observance, day = max(hits, key=lambda h: len(rule_dates & {x["date"] for x in h[0]["days"]}))
    name = day["name"]
    return {"en": name["en"], "hi": name.get("hi") or name["en"], "ja": name.get("ja") or observance["labels"].get("ja") or name["en"]}


def trips(session: Session, passenger: Passenger) -> list[dict[str, Any]]:
    """The passenger's flights: the core one (Flight) and any m16 trip legs, one row per flight and date."""
    out: dict[tuple[str, str], bool] = {}
    flight = session.get(Flight, passenger.flight_id)
    if flight is not None:
        out[(flight.flight_no, flight.date)] = True
    for leg in session.exec(select(TripLeg).where(TripLeg.passenger_id == passenger.id)).all():
        out.setdefault((leg.flight_no, leg.date), False)
    return [{"flight_no": no, "date": day, "core": core} for (no, day), core in sorted(out.items(), key=lambda kv: kv[0][1])]


def needs_question(rule: dict[str, Any], iso: str) -> bool:
    if iso in rule.get("confirmed", []) or iso in rule.get("declined", []):
        return False
    if rule["kind"] == "dates":
        return bool(rule.get("confirm")) and iso in rule.get("dates", [])
    if rule["kind"] == "weekday":
        return date.fromisoformat(iso).weekday() in rule.get("weekdays", [])
    return False


def _question_text(trip: dict[str, Any], rule: dict[str, Any], label: dict[str, str] | None) -> dict[str, str]:
    day, no = day_text(trip["date"]), trip["flight_no"]
    ask = ASK.get(rule.get("preset"), ASK[None])
    if label is not None:
        lead = {
            "en": f"Your {no} on {day['en']} falls on {label['en']}.",
            "hi": f"{day['hi']} को आपकी {no} उड़ान {label['hi']} के दिन है।",
            "ja": f"{day['ja']}の{no}便は{label['ja']}にあたります。",
        }
    else:
        weekday = WEEKDAY_NAMES[date.fromisoformat(trip["date"]).weekday()]
        lead = {
            "en": f"Your {no} on {day['en']} is a {weekday['en']}.",
            "hi": f"आपकी {no} उड़ान {day['hi']} को है।",
            "ja": f"{no}便は{day['ja']}です。",
        }
    return {lang: f"{lead[lang]} {ask[lang]}" for lang in LANGS}


def _open_question(session: Session, passenger_id: str, iso: str, rule_id: str) -> bool:
    return session.exec(
        select(RadarQuestion.id).where(
            RadarQuestion.passenger_id == passenger_id, RadarQuestion.date == iso,
            RadarQuestion.rule_id == rule_id, RadarQuestion.status == "asked",
        )
    ).first() is not None


def _ask(session: Session, passport: Passport, passenger: Passenger, trip: dict[str, Any], rule: dict[str, Any]) -> RadarQuestion:
    label = calendar_label(trip["date"], rule)
    shown = label or WEEKDAY_NAMES[date.fromisoformat(trip["date"]).weekday()]
    question = RadarQuestion(id=new_id("RQ"), passenger_id=passenger.id, date=trip["date"], flight_no=trip["flight_no"],
                             rule_id=rule["id"], label=dict(shown), asked_at=clock.now(session=session))
    session.add(question)
    text = _question_text(trip, rule, label)
    yes = YES.get(rule.get("preset"), YES[None])
    lang = _lang(passport.lang)
    outbox.notify(
        "whatsapp", passenger.id, _title(trip["flight_no"])[lang], f"{text[lang]} 1 {yes[lang]} · 2 {NO[lang]}", lang,
        ref={"kind": "radar_question", "question_id": question.id, "date": trip["date"], "flight_no": trip["flight_no"],
             "question": text, "options": [{"id": "yes", "label": yes}, {"id": "no", "label": NO}]},
        session=session,
    )
    return question


def _scan_one(session: Session, passport: Passport, passenger: Passenger, today: str) -> list[dict[str, Any]]:
    asked = []
    for trip in trips(session, passenger):
        if trip["date"] < today:
            continue
        for rule in (passport.rules or {}).get("time_rules", []):
            if not needs_question(rule, trip["date"]) or _open_question(session, passenger.id, trip["date"], rule["id"]):
                continue
            q = _ask(session, passport, passenger, trip, rule)
            asked.append({"question_id": q.id, "passenger_id": passenger.id, "date": q.date, "flight_no": q.flight_no,
                          "label": q.label})
    return asked


def scan(session: Session, *, flight_id: str | None = None, passenger_id: str | None = None) -> dict[str, Any]:
    """Ask every passport holder whose trip dates meet a time rule that hasn't been answered; quiet otherwise."""
    today = clock.now(session=session).date().isoformat()
    query = select(Passport).order_by(Passport.passenger_id)
    if passenger_id:
        query = query.where(Passport.passenger_id == passenger_id)
    asked: list[dict[str, Any]] = []
    quiet = 0
    for passport in session.exec(query).all():
        passenger = session.get(Passenger, passport.passenger_id)
        if passenger is None or (flight_id and passenger.flight_id != flight_id):
            continue
        new = _scan_one(session, passport, passenger, today)
        asked += new
        quiet += 0 if new else 1
    session.flush()
    return {"asked": asked, "quiet": quiet}


# ---------------------------------------------------------------- answers


def _meal_text(session: Session, plan: dict[str, Any]) -> dict[str, str]:
    if plan.get("code"):
        meal = plan["code"] + (f" · {plan['kitchen_note']}" if plan.get("kitchen_note") else "")
        return {lang: meal for lang in LANGS}
    name = service.main_name(session, plan)
    if name:
        return {lang: name.get(lang) or name["en"] for lang in LANGS}
    return {"en": "anything from the trolley", "hi": "ट्रॉली से कुछ भी", "ja": "カートのどのお食事でも"}


def _cutoff(flight: Flight, rules: dict[str, Any]) -> Any:
    """The special-meal line for these rules: 49 h for an allergy (m18's windows), else the flight's 25 h cutoff."""
    try:
        from app.modules.m18_changes.windows import long_lead, ssr_cutoff
    except ImportError:
        return flight.special_meal_cutoff
    return ssr_cutoff(flight, long_lead(rules))


def _submit_change(session: Session, flight: Flight, passenger: Passenger, rules: dict[str, Any], question: RadarQuestion,
                   lang: str, quiet: bool = False) -> Any:
    """Hand the confirmed fast to the change router (m18) when it is installed; it logs the prediction or routes it."""
    try:
        from app.modules.m18_changes.service import submit_change
    except ImportError:
        return None
    try:
        return submit_change(session, flight_id=flight.id, passenger_id=passenger.id, channel="radar", kind="calendar",
                             rules=rules, note=f"Calendar Radar: fast confirmed for {question.date}", lang=lang,
                             quiet=quiet)
    except Exception:  # the passenger's answer is already saved; the change log can be rebuilt by staff
        log.exception("Change router failed for radar question %s", question.id)
        return None


def _dump(change: Any) -> Any:
    if change is None or isinstance(change, dict):
        return change
    return change.model_dump(mode="json") if hasattr(change, "model_dump") else dict(change)


def _reply(session: Session, question: RadarQuestion, option_id: str, plan: dict[str, Any], *, core: bool,
           before_cutoff: bool) -> dict[str, str]:
    day, no = day_text(question.date), question.flight_no
    meal = _meal_text(session, plan)
    if option_id == "no":
        return {
            "en": f"Noted. Your usual meal stays on {no}, {day['en']}: {meal['en']}.",
            "hi": f"ठीक है। {day['hi']} की {no} उड़ान में आपका सामान्य खाना ही रहेगा: {meal['hi']}।",
            "ja": f"承知しました。{day['ja']}の{no}便はいつものお食事のままです：{meal['ja']}",
        }
    if not core:
        return {
            "en": f"Noted for {no} on {day['en']}: we'll plan the fasting version.",
            "hi": f"{day['hi']} की {no} उड़ान के लिए नोट कर लिया: व्रत वाला खाना रहेगा।",
            "ja": f"{day['ja']}の{no}便について承知しました。断食用のお食事を手配します。",
        }
    if before_cutoff:
        return {
            "en": f"Done. Your {no} meal on {day['en']} is now the fasting version: {meal['en']}.",
            "hi": f"हो गया। {day['hi']} की {no} उड़ान में अब आपको व्रत वाला खाना मिलेगा: {meal['hi']}।",
            "ja": f"変更しました。{day['ja']}の{no}便のお食事は断食用になりました：{meal['ja']}",
        }
    return {
        "en": f"Noted. The special-meal list for {no} has closed, so the team on duty will find the best option for "
              f"your fast; you'll get their answer here.",
        "hi": f"नोट कर लिया। {no} की विशेष भोजन सूची बंद हो चुकी है, इसलिए ड्यूटी पर मौजूद टीम आपके व्रत के लिए सबसे अच्छा "
              f"विकल्प ढूँढेगी; उनका जवाब यहीं आएगा।",
        "ja": f"承知しました。{no}便の特別食の受付は締め切られたため、担当チームが断食に合う最善のお食事を探します。結果はこちらでお知らせします。",
    }


class QuestionNotFound(LookupError):
    pass


def answer(session: Session, question_id: str, option_id: str) -> dict[str, Any]:
    """Record a tap. Idempotent: a second tap on an answered question changes nothing (`applied: false`)."""
    question = session.get(RadarQuestion, question_id)
    if question is None:
        raise QuestionNotFound(question_id)
    passenger = session.get(Passenger, question.passenger_id)
    passport = service.get(session, question.passenger_id)
    if passenger is None or passport is None:
        raise QuestionNotFound(question_id)
    if question.status == "answered":
        return {"question_id": question.id, "applied": False, "plan": _plan_out(session, passenger, passport.rules), "change": None}

    now = clock.now(session=session)
    question.status, question.answer, question.answered_at = "answered", option_id, now
    session.add(question)
    rules = passport.rules or {}
    rule = next((r for r in rules.get("time_rules", []) if r["id"] == question.rule_id), None)
    if rule is None:  # the passenger has since changed their rules: nothing left to apply
        return {"question_id": question.id, "applied": False, "plan": _plan_out(session, passenger, rules), "change": None}

    field = "confirmed" if option_id == "yes" else "declined"
    updated = {**rule, field: sorted({*rule.get(field, []), question.date})}
    new_rules = {**rules, "time_rules": [updated if r["id"] == rule["id"] else r for r in rules["time_rules"]]}
    passport.rules = new_rules
    passport.updated_at = now
    session.add(passport)

    flight = session.get(Flight, passenger.flight_id)
    core = flight is not None and flight.date == question.date and flight.flight_no == question.flight_no
    plan = service.plan_for(session, passenger, new_rules)
    before_cutoff = bool(flight) and now < _cutoff(flight, new_rules)
    lang = _lang(passport.lang)
    change = None
    if core and option_id == "yes":
        if before_cutoff:
            service.write_meal(session, passenger, plan, lang=lang, allergens=list(new_rules.get("allergens", [])), source="radar")
            passport.code, passport.kitchen_note = plan["code"], plan["kitchen_note"]
        # Before the cutoff the Radar's own reply is the answer; after it, the router's answer is (one reply per tap).
        change = _submit_change(session, flight, passenger, new_rules, question, lang, quiet=before_cutoff)

    decision = (_dump(change) or {}).get("decision") or {}
    if before_cutoff or not decision.get("ok"):
        text = _reply(session, question, option_id, plan, core=core, before_cutoff=before_cutoff)
        outbox.notify("whatsapp", passenger.id, _title(question.flight_no)[lang], text[lang], lang,
                      ref={"kind": "radar_answer", "question_id": question.id, "option_id": option_id, "text": text},
                      session=session)
    session.flush()
    return {"question_id": question.id, "applied": True, "plan": _plan_out(session, passenger, new_rules, plan),
            "change": _dump(change)}


def _plan_out(session: Session, passenger: Passenger, rules: dict[str, Any], plan: dict[str, Any] | None = None) -> dict[str, Any]:
    plan = plan or service.plan_for(session, passenger, rules)
    return {**plan, "main_pick_name": service.main_name(session, plan)}
