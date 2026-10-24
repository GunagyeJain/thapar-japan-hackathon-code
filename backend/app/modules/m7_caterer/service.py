"""Meal lists for the caterer: cut a version, diff it, hash it, acknowledge it (C3), print its labels."""
import hashlib
import json
import threading
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core import clock, events, outbox
from app.core.db import use_session
from app.core.ids import new_id
from app.core.models import Flight, MealItem, MealPromise, Passenger, Profile
from app.modules.m1_rules import engine
from app.modules.m7_caterer.models import MealListVersion

LINE_FIELDS = ("name", "pnr", "code", "note", "item_id")
_cut_lock = threading.Lock()  # two cuts at once must not both become v3


def build_lines(session: Session, flight_id: str) -> list[dict[str, Any]]:
    """Every passenger whose booking has a meal SSR, with their assigned special meal. By code, then name."""
    passengers = session.exec(select(Passenger).where(Passenger.flight_id == flight_id, Passenger.ssr_meal != None)).all()  # noqa: E711
    specials = {
        i.assigned_passenger_id: i.id
        for i in session.exec(select(MealItem).where(MealItem.flight_id == flight_id, MealItem.kind == "special")).all()
        if i.assigned_passenger_id
    }
    lines = [
        {
            "passenger_id": p.id,
            "name": f"{p.surname}/{p.given} {p.title}",
            "pnr": p.pnr,
            "code": p.ssr_meal,
            "note": p.ssr_note,
            "item_id": specials.get(p.id),
        }
        for p in passengers
    ]
    return sorted(lines, key=lambda line: (line["code"], line["name"]))


def sha256_of(lines: list[dict[str, Any]]) -> str:
    canonical = json.dumps(lines, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def diff_lines(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> dict[str, Any]:
    """added / removed / changed, matched by passenger_id. changed lists each field that moved."""
    old = {line["passenger_id"]: line for line in before}
    new = {line["passenger_id"]: line for line in after}
    changed = []
    for pid in new.keys() & old.keys():
        fields = [{"field": f, "before": old[pid][f], "after": new[pid][f]} for f in LINE_FIELDS if old[pid][f] != new[pid][f]]
        if fields:
            changed.append({"passenger_id": pid, "name": new[pid]["name"], "fields": fields, "before": old[pid], "after": new[pid]})
    return {
        "added": [new[pid] for pid in new if pid not in old],
        "removed": [old[pid] for pid in old if pid not in new],
        "changed": sorted(changed, key=lambda c: c["name"]),
    }


def latest(session: Session, flight_id: str) -> MealListVersion | None:
    return session.exec(
        select(MealListVersion).where(MealListVersion.flight_id == flight_id).order_by(MealListVersion.version.desc())  # type: ignore[attr-defined]
    ).first()


def cut_version(flight_id: str, *, at: datetime | None = None, session: Session | None = None) -> MealListVersion:
    """Cut the next version from the current bookings. Nothing changed since the latest: return that one."""
    with _cut_lock, use_session(session) as s:
        if s.get(Flight, flight_id) is None:
            raise LookupError(f"No flight {flight_id}")
        lines = build_lines(s, flight_id)
        digest = sha256_of(lines)
        prev = latest(s, flight_id)
        if prev and prev.sha256 == digest:
            return prev
        version = MealListVersion(
            id=new_id("ML"),
            flight_id=flight_id,
            version=(prev.version + 1) if prev else 1,
            created_at=at or clock.now(session=s),
            sha256=digest,
            lines=lines,
            diff=diff_lines(prev.lines if prev else [], lines),
        )
        s.add(version)
        changes = sum(len(version.diff[k]) for k in ("added", "removed", "changed"))
        outbox.notify(
            "caterer", "caterer", f"Meal list v{version.version} received {version.created_at.astimezone(clock.IST):%H:%M}",
            f"{len(lines)} special meals · {changes} change{'s' if changes != 1 else ''} since v{version.version - 1}"
            if prev else f"{len(lines)} special meals",
            ref={"meal_list_id": version.id, "version": version.version}, session=s,
        )
        return version


def ack(version_id: str, by: str, *, session: Session | None = None) -> MealListVersion:
    """The kitchen acknowledges a version: C3 for every promise on it. Acknowledging again changes nothing."""
    with use_session(session) as s:
        version = s.get(MealListVersion, version_id)
        if version is None:
            raise LookupError(f"No meal list {version_id}")
        if version.ack_at:
            return version
        version.ack_at = clock.now(session=s)
        version.ack_by = by
        s.add(version)
        on_list = {line["passenger_id"]: line for line in version.lines}
        promises = s.exec(select(MealPromise).where(MealPromise.flight_id == version.flight_id)).all()
        for promise in promises:
            line = on_list.get(promise.passenger_id)
            if not line:
                continue
            events.record_checkpoint(
                promise.id, promise.passenger_id, version.flight_id, "C3", "ok", "caterer",
                f"Meal list v{version.version} acknowledged · {by}",
                data={"meal_list_id": version.id, "version": version.version, "sha256": version.sha256[:12], "item_id": line["item_id"]},
                key=f"c3:{version.id}:{promise.id}", session=s,
            )
        return version


def labels(session: Session, flight_id: str, version_no: int | None = None) -> list[dict[str, Any]]:
    """One label per line with a meal item. The QR carries only the item id; no seat is printed."""
    query = select(MealListVersion).where(MealListVersion.flight_id == flight_id)
    if version_no is not None:
        query = query.where(MealListVersion.version == version_no)
    version = session.exec(query.order_by(MealListVersion.version.desc())).first()  # type: ignore[attr-defined]
    if version is None:
        raise LookupError(f"No meal list for {flight_id}" + (f" v{version_no}" if version_no else ""))
    flight = session.get(Flight, flight_id)
    promises = {p.passenger_id: p for p in session.exec(select(MealPromise).where(MealPromise.flight_id == flight_id)).all()}
    out = []
    for line in version.lines:
        if not line["item_id"]:
            continue
        mark = _mark(session, promises.get(line["passenger_id"]), line)
        out.append(
            {
                "item_id": line["item_id"],
                "qr": line["item_id"],
                "mark": mark,
                "name": line["name"],
                "pnr": line["pnr"],
                "flight_no": flight.flight_no,
                "date": flight.date,
                "code": line["code"],
                "note": line["note"],
                "version": version.version,
            }
        )
    return out


def _mark(session: Session, promise: MealPromise | None, line: dict[str, Any]) -> dict[str, str]:
    """The passenger's own food rules when we have them (m1 label_mark), else what the booked code excludes."""
    profile = session.get(Profile, promise.profile_id) if promise else None
    if profile and profile.forbid:
        return engine.label_mark(profile.forbid, profile.allow)
    if promise and promise.label_mark:
        return promise.label_mark
    return _mark_from_code(line["code"], line["note"])


def _mark_from_code(code: str, note: str | None) -> dict[str, str]:
    """No promise (booked by an agent): the mark says what the booked code and its note exclude.

    Only diet families count (meat, fish, egg, dairy, onion family, root vegetables…, and the halal and
    beef/pork markers); a code's side guarantees such as "no alcohol" would just clutter the tray.
    """
    rules = engine.rules()
    families = set(rules.preference_groups) | {t for base in rules.label_bases for t in base["requires"]} | {"beef", "pork"}
    excludes = [t for t in rules.codes.get(code, {}).get("excludes", []) if t in families]
    from_note = [tag for tag, phrase in rules.note_phrases.items() if note and phrase in note.upper()]
    forbid = list(dict.fromkeys([*excludes, *from_note]))
    return engine.label_mark(forbid) if forbid else {"en": code, "ja": code, "hi": code}


def version_payload(version: MealListVersion) -> dict[str, Any]:
    return {**version.model_dump(), "short_hash": version.sha256[:12]}
