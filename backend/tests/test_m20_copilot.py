"""m20 · crew copilot: the package's copilot block (with and without m18 / m21) and the eaten / refused / swapped taps."""
import sys
import types

import pytest

FLIGHT = "JL740-20261025"
PRIYA_TRAY = "TB-7K2Q9F"
TIER_RANK = {"hard": 0, "firm": 1, "soft": 2, "none": 3}


def _package(client):
    r = client.get(f"/api/flights/{FLIGHT}/crew-package")
    assert r.status_code == 200, r.text
    return r.json()


def _seats(pkg):
    return {s["seat"]: s for s in pkg["copilot"]["seats"]}


def _events(client, epoch, events):
    return client.post(f"/api/flights/{FLIGHT}/crew-events", json={"seed_epoch": epoch, "events": events})


@pytest.fixture
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    return client


def _fake_module(monkeypatch, name: str, **attrs):
    """Puts a stand-in for a module built in parallel (m18, m21) on the import path for one test."""
    package, _, child = name.rpartition(".")
    parent = types.ModuleType(package)
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    setattr(parent, child, module)
    monkeypatch.setitem(sys.modules, package, parent)
    monkeypatch.setitem(sys.modules, name, module)


def test_package_keeps_v1_fields_and_adds_copilot(fresh):
    raw = fresh.get(f"/api/flights/{FLIGHT}/crew-package")
    assert len(raw.content) < 300_000, len(raw.content)
    pkg = raw.json()
    for key in ("flight", "passengers", "promises", "items", "specs", "verdicts", "forbid", "expected_specials",
                "rules_version", "seed_epoch", "generated_at"):
        assert key in pkg
    assert len(pkg["passengers"]) == 186
    copilot = pkg["copilot"]
    assert set(copilot) >= {"seats", "serve_order", "taps"}
    seat = copilot["seats"][0]
    assert set(seat) >= {"seat", "passenger_id", "tier", "flex", "card", "may_eat_from", "sunrise_box", "assigned"}
    assert set(seat["card"]) == {"ja", "en", "hi"}


def test_tiers_cards_and_trays_without_router_or_sun(fresh, monkeypatch):
    from app.modules.m8_crew import copilot as copilot_module

    monkeypatch.setattr(copilot_module, "_router_rows", lambda *a, **k: None)
    monkeypatch.setattr(copilot_module, "_sun_rows", lambda *a, **k: None)
    pkg = _package(fresh)
    copilot = pkg["copilot"]
    assert copilot["sources"] == {"trays": "meal items", "sun": None}
    seats = _seats(pkg)

    # 2A keeps chauvihar: strict, card in Japanese first, her own special tray; no sun time without m21.
    sushila = seats["2A"]
    assert sushila["tier"] == "hard"
    assert "日の出48分後" in sushila["card"]["ja"] and "48 min after sunrise" in sushila["card"]["en"]
    assert sushila["sun_rule"] == "daylight"
    assert sushila["may_eat_from"] is None and sushila["sunrise_box"] is False
    assert sushila["assigned"]["rung"] == "ssr_change"

    # Priya has no passport at reset: her booked AVML + NO ONION NO GARLIC still makes her strict, on her tray.
    priya = seats["23C"]
    assert priya["tier"] == "hard"
    assert priya["assigned"] == {"item_id": PRIYA_TRAY, "spec_id": "SPEC-AVML-NOG",
                                 "spec_name": priya["assigned"]["spec_name"], "rung": "ssr_change"}
    assert priya["galley"] == "G1"

    # 29H keeps a fast on the flight date: today's rules (no grains) are on her card.
    assert seats["29H"]["fast_today"] is True
    assert "no grains" in seats["29H"]["card"]["en"]

    # Exactly one main fits a vegetarian in economy: that main is held for them, from a real tray.
    held = [s for s in copilot["seats"] if (s["assigned"] or {}).get("rung") == "held_main"]
    assert held
    items = {i["id"]: i for i in pkg["items"]}
    assert all(items[s["assigned"]["item_id"]]["kind"] == "main" for s in held)
    assert len({s["assigned"]["item_id"] for s in held}) == len(held)

    # Mehta told nobody anything yet: not on the copilot until he asks at the gate.
    assert "31K" not in seats


def test_serve_order_business_first_then_front_to_back_strictest_first(fresh):
    pkg = _package(fresh)
    copilot = pkg["copilot"]
    seats = _seats(pkg)
    order = copilot["serve_order"]
    cabin = {p["seat"]: p["cabin"] for p in pkg["passengers"]}
    keys = [(0 if cabin[s] == "C" else 1, int(s[:-1]), TIER_RANK[seats[s]["tier"]]) for s in order]
    assert keys == sorted(keys)
    assert "23C" in order and "27D" in order
    assert all(seats[s]["assigned"] or seats[s].get("needs_tray") or seats[s].get("sun_rule") for s in order)


def test_router_assignments_win_and_sun_times_come_from_m21(fresh, monkeypatch):
    pkg = _package(fresh)
    mehta = next(p for p in pkg["passengers"] if p["seat"] == "31K")
    spare = next(i for i in pkg["items"] if i["kind"] == "spare" and i["spec_id"] == "SPEC-VJML")

    def assignments(session, flight_id):
        assert flight_id == FLIGHT
        return {"assignments": [{"seat": "31K", "passenger_id": mehta["id"], "item_id": spare["id"],
                                 "spec_id": "SPEC-VJML", "spec_name": {"en": "Jain meal", "ja": "ジャイナ食"},
                                 "rung": "onboard_spare", "tier": "hard", "order": 1}]}

    def daylight_seats(session, flight_id):
        return [{"seat": "2A", "passenger_id": "PX-0007", "rule": {"kind": "daylight", "after_sunrise_min": 48},
                 "may_eat_from": "2026-10-25T06:41:00+05:30", "may_eat_until": None, "sunrise_box": False,
                 "note": {"en": "Serve from 48 min after sunrise at the aircraft.", "ja": "機上の日の出から48分後に提供。"}},
                {"seat": "33D", "passenger_id": "PX-0133", "rule": {"kind": "daylight", "after_sunrise_min": 48},
                 "may_eat_from": None, "may_eat_until": None, "sunrise_box": True, "note": None}]

    _fake_module(monkeypatch, "app.modules.m18_changes.service", assignments=assignments)
    _fake_module(monkeypatch, "app.modules.m21_sun.service", daylight_seats=daylight_seats)
    pkg = _package(fresh)
    copilot = pkg["copilot"]
    assert copilot["sources"] == {"trays": "m18", "sun": "m21"}
    seats = _seats(pkg)
    assert seats["31K"]["assigned"] == {"item_id": spare["id"], "spec_id": "SPEC-VJML",
                                        "spec_name": {"en": "Jain meal", "ja": "ジャイナ食"}, "rung": "onboard_spare"}
    assert seats["31K"]["galley"] == "G2"
    assert "31K" in copilot["serve_order"]
    assert seats["2A"]["may_eat_from"] == "2026-10-25T06:41:00+05:30"
    assert seats["2A"]["sun_note"]["ja"].startswith("機上の日の出")
    assert seats["33D"]["sunrise_box"] is True
    # Passengers m18 doesn't cover keep their tray from the meal items.
    assert seats["23C"]["assigned"]["item_id"] == PRIYA_TRAY


def test_router_may_return_a_plain_list(fresh, monkeypatch):
    pkg = _package(fresh)
    priya = next(p for p in pkg["passengers"] if p["seat"] == "23C")
    backup = next(i for i in pkg["items"] if i["kind"] == "backup")
    rows = [{"seat": "23C", "passenger_id": priya["id"], "item_id": backup["id"], "spec_id": backup["spec_id"],
             "spec_name": {"en": "Universal plate"}, "rung": "reserve_pouch", "tier": "hard", "order": 1}]
    _fake_module(monkeypatch, "app.modules.m18_changes.service", assignments=lambda session, flight_id: rows)
    seats = _seats(_package(fresh))
    assert seats["23C"]["assigned"]["rung"] == "reserve_pouch"
    assert seats["23C"]["assigned"]["item_id"] == backup["id"]


def test_a_failing_router_or_sun_never_breaks_the_package(fresh, monkeypatch):
    def broken(session, flight_id):
        raise RuntimeError("built in parallel, not ready")

    _fake_module(monkeypatch, "app.modules.m18_changes.service", assignments=broken)
    _fake_module(monkeypatch, "app.modules.m21_sun.service", daylight_seats=broken)
    pkg = _package(fresh)
    assert pkg["copilot"]["sources"] == {"trays": "meal items", "sun": None}
    assert _seats(pkg)["23C"]["assigned"]["item_id"] == PRIYA_TRAY


def test_eaten_refused_swapped_sync_and_come_back_in_the_package(fresh):
    pkg = _package(fresh)
    epoch = pkg["seed_epoch"]
    shah = next(p for p in pkg["passengers"] if p["seat"] == "27D")
    shah_tray = next(i for i in pkg["items"] if i["assigned_passenger_id"] == shah["id"])
    evs = [
        {"client_id": "tap-1", "type": "eaten", "item_id": shah_tray["id"], "passenger_id": shah["id"], "seat": "27D",
         "at": "2026-10-25T06:10:00+05:30"},
        {"client_id": "tap-2", "type": "refused", "seat": "23C", "at": "2026-10-25T06:11:00+05:30"},
        {"client_id": "tap-3", "type": "swapped", "passenger_id": "PX-0007", "at": "2026-10-25T06:12:00+05:30"},
    ]
    assert _events(fresh, epoch, evs).json() == {"accepted": 3, "duplicates": 0, "ignored_old_epoch": 0}
    assert _events(fresh, epoch, evs).json() == {"accepted": 0, "duplicates": 3, "ignored_old_epoch": 0}

    after = _package(fresh)
    taps = after["copilot"]["taps"]
    assert [(t["client_id"], t["type"], t["seat"]) for t in taps] == [
        ("tap-1", "eaten", "27D"), ("tap-2", "refused", "23C"), ("tap-3", "swapped", "2A")]
    assert taps[1]["passenger_id"] == "PX-0057" and taps[2]["seat"] == "2A"

    promise = next(p for p in after["promises"] if p["passenger_id"] == shah["id"])
    timeline = fresh.get(f"/api/promises/{promise['id']}/timeline").json()["events"]
    assert any(e["checkpoint"] == "C5" and "eaten" in e["detail"] for e in timeline)
    # An info event never changes the checkpoint state.
    assert promise["checkpoints"]["C5"] == "pending"


def test_a_tap_needs_a_passenger_on_the_flight(fresh):
    epoch = _package(fresh)["seed_epoch"]
    r = _events(fresh, epoch, [{"client_id": "tap-x", "type": "eaten", "seat": "99Z", "at": "2026-10-25T06:10:00+05:30"}])
    assert r.status_code == 422
    r = _events(fresh, epoch, [{"client_id": "tap-y", "type": "eaten", "seat": "23C", "item_id": "TB-NOPE00",
                                "at": "2026-10-25T06:10:00+05:30"}])
    assert r.status_code == 422
