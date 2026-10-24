"""Late-request matcher: check every meal on board against one person's rules, pick a safe one.

Tiers: spare special meal → main-menu meal → sealed backup → airside voucher.
`match()` is a dry run; `reserve()` assigns the meal and tells crew and passenger.
"""
from sqlmodel import Session, select

from app.core import alerts, clock, events, outbox
from app.core.ids import new_id
from app.core.models import MealItem, MealPromise, Passenger, Profile
from app.modules.m1_rules import engine
from app.modules.m6_matcher.inventory import TIER_COST, Inventory, item_payload, load, menu_cabin
from app.modules.m6_matcher.models import LateRequest
from app.modules.m6_matcher.solver import Candidate, Donor, solve

VOUCHER = {
    "value_inr": 600,
    "outlets": [
        {"name": "Vegetarian thali counter (illustrative)", "terminal": "DEL T3 airside, near gate 12", "open": "24 h"},
        {"name": "South Indian café (illustrative)", "terminal": "DEL T3 airside, food court", "open": "24 h"},
        {"name": "Fruit and juice bar (illustrative)", "terminal": "DEL T3 airside, near gate 18", "open": "05:00–01:00"},
    ],
    "illustrative": True,
}
TIER_LABEL = {
    "spare_special": {"en": "Spare special meal", "hi": "अतिरिक्त विशेष भोजन", "ja": "予備の特別食"},
    "main_menu": {"en": "Main-menu meal", "hi": "मुख्य मेन्यू भोजन", "ja": "通常メニュー"},
    "backup": {"en": "Sealed backup", "hi": "सीलबंद बैकअप भोजन", "ja": "密封予備食"},
    "swap": {"en": "Special meal freed by a swap", "hi": "अदला-बदली से मिला विशेष भोजन", "ja": "交換で確保した特別食"},
}
NOTE_RESERVE = {"en": "Held for galley contingencies", "hi": "गैली आपात स्थिति के लिए रखा", "ja": "ギャレー非常用に保留"}
NOTE_CABIN = {"en": "Business menu: business passengers only", "hi": "बिज़नेस मेन्यू: केवल बिज़नेस यात्री", "ja": "ビジネスクラス専用"}
NOTE_NONE_FREE = {"en": "All owed to passengers", "hi": "सभी यात्रियों के लिए", "ja": "すべて割当済み"}


def _cabin_ok(item: MealItem, cabin: str) -> bool:
    menu = menu_cabin(item.spec_id)
    return menu is None or menu == cabin or cabin == "C"


def _verdicts(inv: Inventory, forbid: list[str]) -> dict:
    """spec_id -> evaluate() result, computed once per spec."""
    return {
        sid: engine.evaluate(forbid, engine.spec_tags(spec.tags, spec.certified)) for sid, spec in inv.specs.items()
    }


def _profile_forbid(session: Session, passenger: Passenger) -> list[str] | None:
    profile = session.get(Profile, passenger.profile_id) if passenger.profile_id else None
    profile = profile or session.exec(select(Profile).where(Profile.passenger_id == passenger.id)).first()
    return profile.forbid if profile else None


def _candidate(inv: Inventory, item: MealItem, rank: int) -> Candidate:
    pool = menu_cabin(item.spec_id) if item.kind == "main" else None
    return Candidate(item.id, TIER_COST[inv.tier(item)], rank, pool)


def _donors(session, inv, verdicts, requester_id, cabin, free_items, ranks) -> list[Donor]:
    """Same-cabin passengers holding a special meal that is safe for the requester, who could move to a free meal.

    Same cabin only, so one crew team handles the swap.
    """
    donors = []
    for pid, held in inv.holder_of().items():
        if pid == requester_id or held.kind not in ("special", "spare") or verdicts[held.spec_id]["verdict"] != engine.SAFE:
            continue
        passenger = inv.passengers.get(pid)
        if passenger is None or passenger.cabin != cabin:
            continue
        forbid = _profile_forbid(session, passenger)
        if not forbid:
            continue
        theirs = _verdicts(inv, forbid)
        can_take = tuple(
            i.id for i in free_items if _cabin_ok(i, passenger.cabin) and theirs[i.spec_id]["verdict"] == engine.SAFE
        )
        if can_take:
            donors.append(Donor(pid, held.id, can_take))
    return sorted(donors, key=lambda d: ranks[d.own_item])


def _considered(inv, verdicts, cabin, chosen_id) -> list[dict]:
    """One line per (meal, tier) on board that a late request could ever use, with why it fits or fails."""
    groups: dict = {}
    for item in inv.items:
        tier = inv.tier(item)
        if tier is None or item.assigned_passenger_id or item.status not in ("planned", "loaded"):
            continue
        key = (item.spec_id, tier)
        if key not in groups or item.id == chosen_id:
            groups[key] = item
    rows = []
    for item in groups.values():
        note = None
        if not _cabin_ok(item, cabin):
            note = NOTE_CABIN
        elif item.id in inv.reserve_ids:
            note = NOTE_RESERVE
        elif item.id not in inv.free_ids:
            note = NOTE_NONE_FREE
        v = verdicts[item.spec_id]
        rows.append(
            {
                "item_id": item.id,
                "spec_name": inv.specs[item.spec_id].name,
                "tier": inv.tier(item),
                "galley": item.galley,
                "verdict": v["verdict"],
                "fired": v["fired"],
                "note": note,
                "chosen": item.id == chosen_id,
            }
        )
    return sorted(rows, key=lambda r: (not r["chosen"], r["note"] is not None, TIER_COST[r["tier"]]))


def _explanation(inv: Inventory, item: MealItem | None, considered: list[dict], swaps: list[dict]) -> dict:
    ruled_out = sum(1 for r in considered if not r["chosen"])
    if item is None:
        return {
            "en": f"No safe meal on board after checking {len(considered)} options. Give an airside meal voucher (₹600).",
            "hi": f"{len(considered)} विकल्प जाँचे, विमान में कोई सुरक्षित भोजन नहीं। हवाई अड्डे का भोजन वाउचर (₹600) दें।",
            "ja": f"{len(considered)}件を確認しましたが、機内に安全な食事はありません。空港内のミールバウチャー（₹600）を発行します。",
        }
    tier, name = TIER_LABEL[inv.tier(item) or "swap"], inv.specs[item.spec_id].name
    where = f"galley {item.galley[-1]}, {item.position}"
    swap = f" One passenger's meal moves to keep everyone safe ({len(swaps)} swap)." if swaps else ""
    return {
        "en": f"{tier['en']}: {name['en']} ({where}). Safe: no rule fired. {ruled_out} other options checked.{swap}",
        "hi": f"{tier['hi']}: {name.get('hi') or name['en']} ({where})। सुरक्षित: कोई नियम लागू नहीं। {ruled_out} अन्य विकल्प जाँचे।",
        "ja": f"{tier['ja']}：{name.get('ja') or name['en']}（{where}）。安全：該当する規則なし。他に{ruled_out}件を確認。",
    }


def match(session: Session, flight_id: str, forbid, allow=None, passenger_id: str | None = None, source: str = "gate") -> dict:
    """Dry run: which meal would this person get, and why every other one fails."""
    forbid = engine.check_tags(forbid)
    engine.check_tags(allow)
    inv = load(session, flight_id)
    requester = inv.passengers.get(passenger_id) if passenger_id else None
    cabin = requester.cabin if requester else "Y"
    verdicts = _verdicts(inv, forbid)
    ranks = {i.id: n for n, i in enumerate(inv.items)}
    free_items = [i for i in inv.items if i.id in inv.free_ids]
    allowed = [i for i in free_items if _cabin_ok(i, cabin)]
    safe_free = [_candidate(inv, i, ranks[i.id]) for i in allowed if verdicts[i.spec_id]["verdict"] == engine.SAFE]
    donors = _donors(session, inv, verdicts, passenger_id, cabin, free_items, ranks)
    solution = solve(safe_free, [_candidate(inv, i, ranks[i.id]) for i in free_items], inv.main_pool, donors)

    item = next((i for i in inv.items if i.id == solution.item_id), None)
    considered = _considered(inv, verdicts, cabin, solution.item_id)
    tier = (inv.tier(item) or "spare_special") if item else "voucher"
    result = {
        "status": "matched" if item else "voucher",
        "tier": tier,
        "item": item_payload(inv, item) if item else None,
        "explanation": _explanation(inv, item, considered, solution.swaps),
        "considered": considered,
        "solver": {"engine": solution.engine, "ms": solution.ms, "swaps": solution.swaps},
        "label_mark": engine.label_mark(forbid),
        "source": source,
    }
    if not item:
        result["voucher"] = {"code": "PREVIEW", **VOUCHER}
    return result


def _apply(session: Session, inv: Inventory, passenger_id: str, item_id: str, swaps: list[dict]) -> MealItem:
    items = {i.id: i for i in inv.items}
    for s in swaps:
        moved = items[s["to_item_id"]]
        moved.assigned_passenger_id = s["passenger_id"]
        session.add(moved)
    item = items[item_id]
    item.assigned_passenger_id = passenger_id
    session.add(item)
    return item


def _active(session: Session, passenger_id: str) -> LateRequest | None:
    for lr in session.exec(select(LateRequest).where(LateRequest.passenger_id == passenger_id)).all():
        item = session.get(MealItem, lr.item_id) if lr.item_id else None
        if lr.status == "voucher" or (item and item.assigned_passenger_id == passenger_id):
            return lr
    return None


def reserve(session: Session, flight_id: str, passenger_id: str, forbid, allow=None, source: str = "gate") -> LateRequest:
    """Reserve the matched meal (or issue a voucher), write LATE, alert crew, message the passenger.

    Asking again for someone who already has a reservation returns that reservation.
    """
    passenger = session.get(Passenger, passenger_id)
    if passenger is None or passenger.flight_id != flight_id:
        raise LookupError(f"No passenger {passenger_id} on {flight_id}")
    existing = _active(session, passenger_id)
    if existing:
        return existing

    result = match(session, flight_id, forbid, allow, passenger_id, source)
    lr_id = new_id("LR")
    item = None
    if result["status"] == "matched":
        item = _apply(session, load(session, flight_id), passenger_id, result["item"]["id"], result["solver"]["swaps"])
        result["item"]["assigned_passenger_id"] = passenger_id
    else:
        result["voucher"] = {**result["voucher"], "code": new_id("VCH", 6)}
    lr = LateRequest(
        id=lr_id,
        flight_id=flight_id,
        passenger_id=passenger_id,
        at=clock.now(session=session),
        source=source,
        status="reserved" if item else "voucher",
        forbid=engine.check_tags(forbid),
        allow=engine.check_tags(allow),
        item_id=item.id if item else None,
        match=result,
    )
    session.add(lr)
    _tell_everyone(session, passenger, lr, result, item)
    return lr


def _tell_everyone(session: Session, passenger: Passenger, lr: LateRequest, result: dict, item: MealItem | None) -> None:
    promise = session.exec(select(MealPromise).where(MealPromise.passenger_id == passenger.id)).first()
    promise_id = promise.id if promise else None
    mark = result["label_mark"]["en"]
    if item:
        spec_name = result["item"]["spec"]["name"]["en"]
        where = f"galley {item.galley[-1]} ({item.position})"
        title = f"{passenger.seat}: late meal reserved, {spec_name}"
        crew_body = f"{passenger.seat} {passenger.surname}: {mark}. Serve {item.id} from {where}."
        pax_title = f"Your meal is reserved ({mark})"
        pax_body = f"It'll be in galley {item.galley[-1]}. Show this message to the crew if you need to."
    else:
        code = result["voucher"]["code"]
        title = f"{passenger.seat}: no safe meal on board, voucher {code}"
        crew_body = f"{passenger.seat} {passenger.surname}: {mark}. Nothing on board is safe; voucher {code} (₹600) issued."
        pax_title = "Your meal voucher"
        pax_body = f"Nothing on board fits your food rules, so here is a ₹600 voucher ({code}) for the airside outlets at DEL T3."
    data = {"late_request_id": lr.id, "item_id": lr.item_id, "tier": result["tier"]}
    events.record_checkpoint(
        promise_id, passenger.id, lr.flight_id, "LATE", "ok" if item else "info",
        source=f"m6:{lr.source}", detail=crew_body, data=data, key=f"late:{lr.id}", session=session,
    )
    alerts.raise_alert(
        lr.flight_id, "LATE_REQUEST", "info", title, crew_body,
        passenger_id=passenger.id, promise_id=promise_id, evidence=data, session=session,
    )
    outbox.notify("crew", f"crew:{lr.flight_id.split('-')[0]}", title, crew_body, ref=data, session=session)
    outbox.notify("sms", passenger.id, pax_title, pax_body, ref=data, session=session)
