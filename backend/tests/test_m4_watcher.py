from pathlib import Path

import pytest
from sqlmodel import select

from app.core.db import new_session
from app.core.models import CheckpointEvent, Flight, Passenger
from app.modules.m4_watcher.parser import parse, render_pnl, type_b
from app.modules.m4_watcher.watcher import build_adl

FLIGHT = "JL740-20261025"
PRIYA = "PX-0057"
MESSAGES = Path(__file__).resolve().parents[2] / "shared" / "seed" / "messages"


def fixture(name: str) -> str:
    return (MESSAGES / name).read_text(encoding="utf-8")


@pytest.fixture
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    return client


def priya(client) -> dict:
    return next(p for p in client.get(f"/api/flights/{FLIGHT}/passengers").json() if p["id"] == PRIYA)


def c2_events(passenger_id: str) -> list[CheckpointEvent]:
    with new_session() as s:
        return list(s.exec(select(CheckpointEvent).where(CheckpointEvent.passenger_id == passenger_id,
                                                         CheckpointEvent.checkpoint == "C2")).all())


def test_t1_seeded_pnl_roundtrip(fresh):
    with new_session() as s:
        flight = s.get(Flight, FLIGHT)
        pax = s.exec(select(Passenger).where(Passenger.flight_id == FLIGHT)).all()
        text = render_pnl(flight, pax)
    assert text == fixture("pnl_jl740.txt"), "regenerate shared/seed/messages/pnl_jl740.txt"
    # Families and groups share a PNR, so a row is a PNR plus a name.
    rows = {(r["pnr"], r["surname"], r["given"]): r for r in parse(text, 2026)["rows"]}
    assert len(pax) == len(rows) == 186
    for p in pax:
        r = rows[(p.pnr, type_b(p.surname), type_b(p.given))]
        assert (r["seat"], r["cabin"], r["surname"], r["given"], r["title"], r["inbound"]) == \
            (p.seat, p.cabin, type_b(p.surname), type_b(p.given), p.title, p.inbound)
        assert r["ssr"] == ([{"code": p.ssr_meal, "status": "HK1", "text": p.ssr_note or ""}] if p.ssr_meal else [])


def test_seed_stores_pnl_and_flags_wrong_code(fresh):
    msgs = fresh.get(f"/api/flights/{FLIGHT}/messages").json()
    assert [(m["seq"], m["kind"]) for m in msgs] == [(1, "PNL")]
    open_alerts = fresh.get(f"/api/alerts?flight_id={FLIGHT}&status=open").json()
    assert [(a["type"], a["passenger_id"]) for a in open_alerts] == [("WRONG_CODE", "PX-0063")]
    assert [e.result for e in c2_events("PX-0087")] == ["ok"]
    manifest = fresh.get(f"/api/flights/{FLIGHT}/manifest").json()
    assert manifest["as_of"] == msgs[0]["id"] and len(manifest["passengers"]) == 186


def test_t2_t3_rebook_then_restore(fresh):
    r = fresh.post("/api/feed/messages", json={"text": fixture("adl_rebook_23C.txt")}).json()
    p = priya(fresh)
    assert (p["pnr"], p["ssr_meal"], p["seat"], p["inbound"]["flight"]) == ("8MZ2TN", None, "23C", "6E5102")
    assert {(c["field"], c["before"], c["after"]) for c in r["changes"] if c["field"] in ("pnr", "ssr_meal")} == \
        {("pnr", "6XK2QP", "8MZ2TN"), ("ssr_meal", "AVML", None)}

    lost = fresh.get(f"/api/alerts?flight_id={FLIGHT}&type=LOST_MEAL&status=open").json()
    assert len(lost) == 1
    alert = lost[0]
    assert (alert["passenger_id"], alert["severity"], alert["deadline_at"]) == (PRIYA, "critical", "2026-10-25T00:40:00+05:30")
    ev = alert["evidence"]
    assert (ev["old_pnr"], ev["new_pnr"], ev["code_before"]) == ("6XK2QP", "8MZ2TN", "AVML")
    assert ".R/AVML HK1 NO ONION NO GARLIC" in ev["lines_before"] and "ADD" in ev["lines_after"]
    assert (ev["line_before"], ev["line_after"]) == (".R/AVML HK1 NO ONION NO GARLIC", None)
    assert [e.result for e in c2_events(PRIYA)] == ["fail"]

    fresh.post("/api/feed/messages", json={"text": fixture("adl_restore_23C.txt")})
    p = priya(fresh)
    assert (p["id"], p["pnr"], p["ssr_meal"], p["ssr_note"]) == (PRIYA, "8MZ2TN", "AVML", "NO ONION NO GARLIC")
    assert fresh.get(f"/api/alerts?flight_id={FLIGHT}&type=LOST_MEAL&status=open").json() == []
    assert [e.result for e in c2_events(PRIYA)] == ["fail", "fixed"]


def test_t4_simulate_and_request_again(fresh):
    r = fresh.post("/api/sim/booking-events", json={"type": "rebook_drop_meal", "passenger_id": PRIYA}).json()
    assert r["message"]["text"] == fixture("adl_rebook_23C.txt")
    (alert,) = [a for a in r["alerts"] if a["type"] == "LOST_MEAL"]

    fresh.post(f"/api/alerts/{alert['id']}/actions", json={"action": "acknowledge", "actor": "ops:neha"})
    done = fresh.post(f"/api/alerts/{alert['id']}/actions", json={"action": "request_again", "actor": "ops:neha"}).json()
    assert done["status"] == "resolved"
    assert done["evidence"]["ssr_draft"] == "SSR AVML JL HK1 DELNRT0740Y25OCT-1SHARMA/PRIYAMS.NO ONION NO GARLIC"
    assert [a["action"] for a in done["actions"]] == ["acknowledge", "request_again", "resolve"]
    msgs = fresh.get(f"/api/flights/{FLIGHT}/messages").json()
    assert msgs[-1]["text"] == fixture("adl_restore_23C.txt")
    assert [e.result for e in c2_events(PRIYA)] == ["fail", "fixed"]
    notes = fresh.get(f"/api/notifications?to={PRIYA}").json()
    assert notes[0]["body"] == "Your AVML meal (no onion no garlic) is back on JL740."
    assert fresh.post(f"/api/alerts/{alert['id']}/actions", json={"action": "resolve", "actor": "x"}).status_code == 409


def test_seat_change_fixture(fresh):
    with new_session() as s:
        suzuki = s.exec(select(Passenger).where(Passenger.pnr == "VFTMPK")).one()
        assert build_adl(s, "seat_change", suzuki.id, seat="22F") == fixture("adl_seat_change.txt")
    r = fresh.post("/api/feed/messages", json={"text": fixture("adl_seat_change.txt")}).json()
    assert [(c["field"], c["before"], c["after"]) for c in r["changes"]] == [("seat", "36A", "22F")]
    assert r["alerts"] == []


def test_bad_input_is_400(fresh):
    assert fresh.post("/api/feed/messages", json={"text": "hello"}).status_code == 400
    assert fresh.post("/api/feed/messages", json={"text": fixture("adl_rebook_23C.txt").replace("JL740", "JL999")}).status_code == 400
    assert fresh.post("/api/sim/booking-events", json={"type": "seat_change", "passenger_id": PRIYA}).status_code == 400
