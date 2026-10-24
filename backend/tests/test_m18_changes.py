import pytest
from sqlmodel import Session

from app.core.db import engine as db
from app.core.models import MealSpec
from app.modules.m1_rules import engine

FLIGHT = "JL740-20261025"
V2_RUNGS = ["caterer_add", "caterer_add", "standby_uplift", "onboard_spare", "noshow_release", "reserve_pouch", "flex_swap"]
TODAY_OK = [False, False, False, True, False, False, False]
VRAT = engine.combine_presets(["vrat"])["forbid"]
# What m19 turns SPEC-BACKUP into (the retort universal plate); used only while the seed still has the old backup.
UNIVERSAL_TAGS = ["buckwheat", "vegetable", "tomato", "cumin", "salt"]


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def _backup_fits_a_fast() -> bool:
    with Session(db) as s:
        spec = s.get(MealSpec, "SPEC-BACKUP")
        return engine.evaluate(VRAT, engine.spec_tags(spec.tags, spec.certified))["verdict"] == engine.SAFE


@pytest.fixture
def universal_plate():
    if not _backup_fits_a_fast():
        with Session(db) as s:
            spec = s.get(MealSpec, "SPEC-BACKUP")
            spec.tags = UNIVERSAL_TAGS
            s.add(spec)
            s.commit()


def _run(client):
    res = client.post("/api/chaos/run", json={"flight_id": FLIGHT})
    assert res.status_code == 200, res.text
    return res.json()


def _spec(spec_id):
    with Session(db) as s:
        return s.get(MealSpec, spec_id)


def _safe(forbid, spec_id) -> bool:
    spec = _spec(spec_id)
    return engine.evaluate(forbid, engine.spec_tags(spec.tags, spec.certified))["verdict"] == engine.SAFE


def test_chaos_events_land_on_the_v2_rungs(client, universal_plate):
    events = _run(client)["events"]
    assert [e["decision"]["rung"] for e in events] == V2_RUNGS
    assert all(e["decision"]["ok"] for e in events)
    assert [e["seat"] for e in events][1:4] == ["23C", "30C", "31K"]
    assert [e["window"] for e in events] == ["caterer_list", "caterer_list", "standby_uplift", "airport", "onboard",
                                             "inflight", "inflight"]
    mehta = events[3]["decision"]
    assert mehta["code"] == "VJML" and mehta["galley"] == "G2"
    assert mehta["steps_tried"] == ["lounge", "airside_partner", "onboard_spare"]
    assert "closed at 02:50" in mehta["reason"]["en"]
    assert events[2]["decision"]["code"] == "DBML" and events[2]["request"]["tier"] == "firm"
    run_out = events[6]["decision"]
    assert [a["rung"] for a in run_out["also"]] == ["onboard_spare", "noshow_release"]
    assert run_out["swap"]["miles"] == 300
    for e in events:
        if e["kind"] == "no_show":
            assert e["message"] is None
            continue
        assert set(e["message"]) == {"en", "hi", "ja"}
        assert next(iter(e["message"])) == e["request"]["lang"]  # the passenger's language first


def test_the_fast_on_board_is_never_met_with_grains(client):
    events = _run(client)["events"]
    fast = events[5]
    expected = "reserve_pouch" if _backup_fits_a_fast() else "unmet"
    assert fast["decision"]["rung"] == expected
    assert fast["decision"]["ok"] == (expected != "unmet")
    assert not fast["today"]["ok"]


def test_today_column_follows_todays_process(client, universal_plate):
    events = _run(client)["events"]
    assert [e["today"]["ok"] for e in events] == TODAY_OK
    assert "luck" in events[3]["today"]["outcome"]["en"]  # Mehta: the spare VJML, unchecked
    assert "too late" in events[2]["today"]["outcome"]["en"]
    assert events[4]["today"]["wasted"] == 1  # the no-show's AVML goes in the bin
    assert all(set(e["today"]["outcome"]) == {"en", "hi", "ja"} for e in events)


def test_metrics_compare_with_today(client, universal_plate):
    _run(client)
    m = client.get(f"/api/changes/metrics?flight_id={FLIGHT}").json()
    ours, today = m["ours"], m["today"]
    assert ours["events"] == today["events"] == 7
    assert ours["hard_total"] == ours["hard_met"] == 5
    assert ours["firm_total"] == ours["firm_met"] == 1
    assert today["hard_met"] < ours["hard_met"] and today["firm_met"] == 0
    assert ours["meals_wasted"] < today["meals_wasted"]
    assert ours["known_before_cutoff"] > today["known_before_cutoff"]
    assert ours["passengers"] == today["passengers"] == 186


def test_hard_needs_only_get_items_the_rules_call_safe(client):
    for e in _run(client)["events"]:
        d, req = e["decision"], e["request"]
        strict = [t for t in req["forbid"] if req["tiers"][t] in ("hard", "firm")]
        if d["ok"] and d["spec_id"]:
            assert _safe(strict, d["spec_id"]), (e["seat"], d["spec_id"])
        for extra in d.get("also", []):
            passport = client.get(f"/api/passport/{extra['passenger_id']}").json()
            assert _safe(passport["rules"]["forbid"], extra["spec_id"]), extra["seat"]
        if d.get("swap"):
            passport = client.get(f"/api/passport/{d['swap']['passenger_id']}").json()
            assert _safe(passport["rules"]["forbid"], d["swap"]["spec_id"])


def test_running_twice_adds_nothing(client):
    first = _run(client)
    sent = len(client.get("/api/notifications").json())
    second = _run(client)
    assert [e["id"] for e in first["events"]] == [e["id"] for e in second["events"]]
    assert len(client.get(f"/api/changes?flight_id={FLIGHT}").json()["events"]) == 7
    assert len(client.get("/api/notifications").json()) == sent


def test_check_in_after_the_final_list_gets_a_standby_meal(client):
    client.post("/api/clock", json={"now": "2026-10-25T01:30:00+05:30"})
    res = client.post("/api/changes", json={
        "flight_id": FLIGHT, "passenger_id": "PX-0122", "channel": "checkin", "kind": "new_need", "lang": "hi",
        "rules": engine.combine_presets(["jain"])})
    assert res.status_code == 200, res.text
    ev = res.json()
    assert ev["window"] == "standby_uplift"
    assert ev["decision"]["rung"] == "standby_uplift" and ev["decision"]["code"] == "VJML"
    assert ev["decision"]["galley"] == "G2"
    assert next(iter(ev["message"])) == "hi"
    caterer = client.get("/api/notifications?to=caterer").json()
    assert any(n["ref"].get("change_id") == ev["id"] for n in caterer)
    chat = client.get("/api/notifications?to=PX-0122").json()
    assert any(n["ref"].get("change_id") == ev["id"] and n["channel"] == "whatsapp" for n in chat)


def test_before_the_cutoff_a_proper_special_meal_is_booked(client):
    res = client.post("/api/changes", json={
        "flight_id": FLIGHT, "passenger_id": "PX-0109", "channel": "chat", "kind": "new_need",
        "rules": {"forbid": ["sugar", "honey"], "tiers": {"sugar": "firm", "honey": "firm"}}})
    ev = res.json()
    assert ev["window"] == "ssr" and ev["decision"]["rung"] == "ssr_change" and ev["today"]["ok"]
    pax = next(p for p in client.get(f"/api/flights/{FLIGHT}/passengers?with_promises=true").json() if p["id"] == "PX-0109")
    assert pax["ssr_meal"] == "DBML" and pax["promise"]["code"] == "DBML"


PEANUT = {"forbid": ["peanut"], "allergens": ["peanut"]}


def _new_need(client, rules, note=None, passenger_id="PX-0109"):
    res = client.post("/api/changes", json={"flight_id": FLIGHT, "passenger_id": passenger_id, "channel": "chat",
                                            "kind": "new_need", "rules": rules, "note": note})
    assert res.status_code == 200, res.text
    return res.json()


def test_an_allergy_after_the_49_h_line_goes_to_the_caterers_list(client):
    # 23 Oct 18:00 after a reset: past JAL's 49 h line for minimal-allergen meals, before the 25 h line for the rest.
    ev = _new_need(client, PEANUT)
    assert ev["window"] == "caterer_list" and ev["request"]["long_lead"]
    assert ev["decision"]["steps_tried"] == ["ssr_change", "caterer_add"]
    assert ev["decision"]["rung"] == "caterer_add" and ev["decision"]["ok"]
    skipped = ev["decision"]["steps"][0]
    assert not skipped["ok"] and "49 h" in skipped["reason"]["en"] and "23 Oct 03:35" in skipped["reason"]["en"]
    assert not ev["today"]["ok"] and "49 h" in ev["today"]["outcome"]["en"]


def test_a_kosher_note_has_the_49_h_line_too(client):
    ev = _new_need(client, {"forbid": ["pork", "shellfish"]}, note="Kosher meal")
    assert ev["window"] == "caterer_list" and ev["decision"]["steps_tried"][0] == "ssr_change"
    plain = _new_need(client, {"forbid": ["pork", "shellfish"]}, passenger_id="PX-0122")
    assert plain["window"] == "ssr" and plain["decision"]["rung"] == "ssr_change"


def test_before_the_49_h_line_an_allergy_is_still_a_special_meal(client):
    client.post("/api/clock", json={"now": "2026-10-22T12:00:00+05:30"})
    ev = _new_need(client, PEANUT)
    assert ev["window"] == "ssr" and ev["decision"]["rung"] == "ssr_change" and ev["today"]["ok"]


def test_change_log_carries_the_49_h_line(client):
    line = client.get(f"/api/changes?flight_id={FLIGHT}").json()["long_lead"]
    assert line["at"].startswith("2026-10-23T03:35") and line["hours"] == 49


def test_caterer_add_is_on_the_next_meal_list(client):
    events = _run(client)["events"]
    lists = client.get(f"/api/flights/{FLIGHT}/meal-lists").json()
    final = lists[0]
    assert final["created_at"].startswith("2026-10-25T00:40")
    lines = {line["passenger_id"]: line for line in final["lines"]}
    for ev in events[:2]:
        assert lines[ev["passenger_id"]]["item_id"] == ev["decision"]["item_id"]
        assert lines[ev["passenger_id"]]["code"] == ev["decision"]["code"]


def test_lost_request_goes_through_m4_request_again(client):
    events = _run(client)["events"]
    alerts = client.get(f"/api/alerts?flight_id={FLIGHT}&type=LOST_MEAL").json()
    priya = [a for a in alerts if a["passenger_id"] == events[1]["passenger_id"]]
    assert priya and priya[0]["status"] == "resolved"
    assert any(a["action"] == "request_again" for a in priya[0]["actions"])
    assert "ssr_draft" in priya[0]["evidence"]


def test_assignments_serve_list(client):
    _run(client)
    rows = client.get(f"/api/changes/assignments?flight_id={FLIGHT}").json()["assignments"]
    assert [r["order"] for r in rows] == list(range(1, len(rows) + 1))
    mehta = next(r for r in rows if r["seat"] == "31K")
    assert mehta["code"] == "VJML" and mehta["galley"] == "G2" and mehta["rung"] == "onboard_spare"
    cabins = ["C" if int(r["seat"][:-1]) <= 5 else "Y" for r in rows]
    assert cabins == sorted(cabins)  # business first
    assert not any(r["seat"] == "36K" for r in rows)  # the no-show isn't served
    assert any(r["source"] == "main_pick" for r in rows)


def test_change_log_shows_windows_in_order(client):
    out = client.get(f"/api/changes?flight_id={FLIGHT}").json()
    assert [w["window"] for w in out["windows"]] == ["ssr", "caterer_list", "standby_uplift", "airport", "onboard", "inflight"]
    assert out["window"] == "ssr" and out["events"] == []
    assert out["windows"][3]["rungs"][:2] == ["lounge", "airside_partner"]


@pytest.mark.parametrize("body,status", [
    ({"flight_id": "JL000-20990101", "passenger_id": "PX-0122", "channel": "gate", "kind": "new_need",
      "rules": {"forbid": ["meat"]}}, 404),
    ({"flight_id": FLIGHT, "passenger_id": "PX-9999", "channel": "gate", "kind": "new_need",
      "rules": {"forbid": ["meat"]}}, 404),
    ({"flight_id": FLIGHT, "passenger_id": "PX-0122", "channel": "gate", "kind": "new_need",
      "rules": {"forbid": ["unicorn"]}}, 422),
    ({"flight_id": FLIGHT, "passenger_id": "PX-0122", "channel": "fax", "kind": "new_need"}, 422),
    ({"flight_id": FLIGHT, "passenger_id": "PX-0122", "channel": "gate", "kind": "new_need"}, 422),  # no rules known
])
def test_bad_input(client, body, status):
    assert client.post("/api/changes", json=body).status_code == status


def test_chaos_reset_clears_the_log(client):
    _run(client)
    assert client.post("/api/chaos/reset", json={"flight_id": FLIGHT}).json()["ok"]
    assert client.get(f"/api/changes?flight_id={FLIGHT}").json()["events"] == []
