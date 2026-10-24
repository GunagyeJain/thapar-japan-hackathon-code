import pytest

from app.modules.m1_rules import engine

PRIYA_ID = "PX-0057"
PRIYA = {"forbid": ["meat", "seafood", "egg", "onion", "garlic"], "allow": ["dairy"]}
CONSENT = {"this_trip": True, "save_profile": False, "share_with_caterer": True, "cross_border_ack": True}


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def test_rules_unchanged_on_an_ordinary_day():
    out = engine.rules_on(PRIYA["forbid"], PRIYA["allow"], ["2026-11-20"], "2026-10-25")
    assert out == {**PRIYA, "fast_day": False}


def test_fast_day_adds_the_vrat_rules():
    out = engine.rules_on(PRIYA["forbid"], PRIYA["allow"], ["2026-11-20"], "2026-11-20")
    assert out["fast_day"]
    assert {"grain", "legume", "alcohol"} <= set(out["forbid"])
    assert {"dairy", "potato", "peanut", "fruit"} <= set(out["allow"])


def test_forbid_wins_on_a_fast_day():
    jain = engine.combine_presets(["jain"])
    out = engine.rules_on(jain["forbid"], jain["allow"], ["2026-11-05"], "2026-11-05")
    assert "potato" not in out["allow"]  # root vegetables stay out for a Jain


def test_fast_days_come_from_the_calendar():
    assert engine.fast_days(["ekadashi"], ["2026-10-25", "2026-11-20"]) == ["2026-11-20"]
    assert engine.fast_days(["navratri"], ["2026-11-20"]) == []


def test_priya_needs_a_profile_first(client):
    out = client.get("/api/days/trips", params={"passenger_id": PRIYA_ID}).json()
    assert not out["has_profile"]
    assert [leg["flight_no"] for leg in out["legs"]] == ["JL740", "JL749"]


def test_priya_return_flight_on_a_fast_day(client):
    client.post("/api/profiles", json={"passenger_id": PRIYA_ID, "lang": "en", "presets": [], **PRIYA,
                                       "consent": CONSENT, "chosen_code": "AVML"})
    out = client.post("/api/days/save", json={"passenger_id": PRIYA_ID, "fast_dates": ["2026-11-20"]}).json()
    outbound, back = out["legs"]
    assert (outbound["code"], outbound["kitchen_note"], outbound["fast_day"]) == ("AVML", "NO ONION NO GARLIC", False)
    assert back["fast_day"] and back["code"] == "AVML"
    assert "NO GRAIN" in back["kitchen_note"] and "NO LENTILS OR BEANS" in back["kitchen_note"]
    assert "穀物" in back["kitchen_note_ja"]
    assert back["usual"] == {"code": "AVML", "kitchen_note": "NO ONION NO GARLIC"}


def test_save_takes_only_own_flight_dates(client):
    res = client.post("/api/days/save", json={"passenger_id": PRIYA_ID, "fast_dates": ["2026-11-21"]})
    assert res.status_code == 422


def test_ops_sees_fast_day_legs_ahead(client):
    out = client.get("/api/days/ahead", params={"days": 30}).json()
    assert [(leg["seat"], leg["date"]) for leg in out["legs"]] == [("24A", "2026-11-05"), ("27D", "2026-11-05"), ("2A", "2026-11-20")]
    assert all(leg["fast_day"] and leg["code"] for leg in out["legs"])
