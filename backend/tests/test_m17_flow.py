"""m17 passport flow over the API: save (promise + C1) → Radar question → yes / no."""
import pytest

FLIGHT = "JL740-20261025"
PRIYA = "PX-0057"
PRIYA_RULES = {
    "forbid": ["meat", "seafood", "egg", "gelatin", "onion", "garlic"],
    "allow": ["dairy"],
    "allergens": [],
    "tiers": {},
    "flex": False,
    "time_rules": [{"id": "TR-1", "kind": "dates", "dates": ["2026-10-25"], "preset": "vrat", "confirm": True}],
}
NO_BEEF_PORK = {"forbid": ["beef", "pork"], "allow": [], "allergens": [], "tiers": {}, "flex": False, "time_rules": []}


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def save(client, passenger_id: str, rules: dict, lang: str = "en") -> dict:
    res = client.post("/api/passport", json={"passenger_id": passenger_id, "lang": lang, "rules": rules, "source": "form"})
    assert res.status_code == 200, res.text
    return res.json()


def promise_of(client, seat: str) -> dict | None:
    rows = client.get(f"/api/flights/{FLIGHT}/passengers", params={"with_promises": "true"}).json()
    return next(r for r in rows if r["seat"] == seat).get("promise")


def questions(client, passenger_id: str) -> list[dict]:
    notes = client.get("/api/notifications", params={"to": passenger_id}).json()
    return [n for n in notes if n["channel"] == "whatsapp" and n["ref"].get("kind") == "radar_question"]


def test_priya_saves_her_passport_and_gets_avml(client):
    out = save(client, PRIYA, PRIYA_RULES, lang="hi")
    assert out["plan"]["code"] == "AVML" and out["plan"]["kitchen_note"] == "NO ONION NO GARLIC"
    assert out["promise"]["code"] == "AVML" and out["promise"]["checkpoints"]["C1"] == "ok"
    assert out["passport"]["id"] == "PP-0057" and out["passport"]["source"] == "form"
    stored = out["passport"]["rules"]["time_rules"][0]
    assert "label" not in stored and "via" not in stored and stored["confirm"] is True
    assert promise_of(client, "23C")["kitchen_note"] == "NO ONION NO GARLIC"
    timeline = client.get(f"/api/promises/{out['promise']['id']}/timeline").json()
    assert any(e["checkpoint"] == "C1" for e in timeline["events"])


def test_a_main_menu_dish_needs_no_promise(client):
    out = save(client, "PX-0122", NO_BEEF_PORK)
    assert out["plan"]["main_pick"] and out["plan"]["code"] is None and out["promise"] is None
    assert out["plan"]["main_pick_name"]["en"]


def test_save_rejects_unknown_tags(client):
    rules = {"forbid": ["dragon"], "allow": [], "allergens": [], "tiers": {}, "flex": False, "time_rules": []}
    res = client.post("/api/passport", json={"passenger_id": PRIYA, "lang": "en", "rules": rules, "source": "form"})
    assert res.status_code == 422
    rules["forbid"] = ["meat"]
    assert client.post("/api/passport", json={"passenger_id": "PX-9999", "lang": "en", "rules": rules}).status_code == 404


def test_flex_is_dropped_when_a_rule_is_hard(client):
    rules = {"forbid": ["meat"], "allow": [], "allergens": [], "tiers": {}, "flex": True, "time_rules": []}
    out = client.post("/api/passport", json={"passenger_id": "PX-0122", "lang": "en", "rules": rules}).json()
    assert out["passport"]["rules"]["flex"] is False and out["passport"]["rules"]["tiers"] == {"meat": "hard"}


def test_booking_lists_the_others_on_the_pnr(client):
    rows = client.get(f"/api/flights/{FLIGHT}/passengers").json()
    group = [r for r in rows if r["pnr"] == "LM39H6"]
    out = client.get(f"/api/passport/booking/{group[0]['id']}").json()
    assert out["pnr"] == "LM39H6" and out["passenger"]["passenger_id"] == group[0]["id"]
    assert {p["passenger_id"] for p in out["passengers"]} == {r["id"] for r in group[1:]}
    assert client.get(f"/api/passport/booking/{PRIYA}").json()["passengers"] == []
    assert client.get("/api/passport/booking/PX-9999").status_code == 404


def test_radar_asks_about_sharad_purnima_and_yes_orders_the_fasting_meal(client):
    save(client, PRIYA, PRIYA_RULES)
    (question,) = questions(client, PRIYA)
    ref = question["ref"]
    assert ref["date"] == "2026-10-25" and ref["flight_no"] == "JL740"
    assert "Sharad Purnima" in question["body"] and "Sun 25 Oct" in question["body"]
    assert [o["id"] for o in ref["options"]] == ["yes", "no"]
    assert client.post("/api/radar/scan", json={"passenger_id": PRIYA}).json()["asked"] == []  # one open question only

    out = client.post("/api/radar/answer", json={"question_id": ref["question_id"], "option_id": "yes"}).json()
    assert out["applied"] is True and out["plan"]["code"] == "AVML"
    assert "NO GRAIN" in out["plan"]["kitchen_note"] and "NO ONION" in out["plan"]["kitchen_note"]
    promise = promise_of(client, "23C")
    assert promise["code"] == "AVML" and "NO GRAIN" in promise["kitchen_note"]
    passport = client.get(f"/api/passport/{PRIYA}").json()
    assert passport["rules"]["time_rules"][0]["confirmed"] == ["2026-10-25"]
    assert passport["plan"]["time_rules_active"] == ["TR-1"]
    replies = [n for n in client.get("/api/notifications", params={"to": PRIYA}).json() if n["ref"].get("kind") == "radar_answer"]
    assert len(replies) == 1 and "fasting version" in replies[0]["ref"]["text"]["en"]

    again = client.post("/api/radar/answer", json={"question_id": ref["question_id"], "option_id": "no"}).json()
    assert again["applied"] is False
    assert promise_of(client, "23C")["kitchen_note"] == promise["kitchen_note"]


def test_radar_no_keeps_the_usual_meal(client):
    save(client, PRIYA, PRIYA_RULES)
    (question,) = questions(client, PRIYA)
    out = client.post("/api/radar/answer", json={"question_id": question["ref"]["question_id"], "option_id": "no"}).json()
    assert out["applied"] is True and out["plan"]["kitchen_note"] == "NO ONION NO GARLIC"
    assert promise_of(client, "23C")["kitchen_note"] == "NO ONION NO GARLIC"
    rule = client.get(f"/api/passport/{PRIYA}").json()["rules"]["time_rules"][0]
    assert rule["declined"] == ["2026-10-25"] and "confirmed" not in rule
    assert client.post("/api/radar/scan", json={"passenger_id": PRIYA}).json()["asked"] == []


def test_after_the_cutoff_yes_goes_to_the_change_router(client):
    save(client, PRIYA, PRIYA_RULES)
    (question,) = questions(client, PRIYA)
    client.post("/api/clock", json={"now": "2026-10-24T12:00:00+05:30"})
    out = client.post("/api/radar/answer", json={"question_id": question["ref"]["question_id"], "option_id": "yes"}).json()
    assert out["applied"] is True and "NO GRAIN" in out["plan"]["kitchen_note"]
    # The special-meal window has closed, so the change router takes it: still on the kitchen's final list.
    assert out["change"]["channel"] == "radar" and out["change"]["decision"]["rung"] == "caterer_add"
    assert "NO GRAIN" in promise_of(client, "23C")["kitchen_note"]
    notes = client.get("/api/notifications", params={"to": PRIYA}).json()
    kinds = [n["ref"].get("kind") for n in notes]
    assert "radar_answer" not in kinds and kinds.count("change") == 1  # one reply to one tap


def test_radar_scan_answers_unknown_question_with_404(client):
    assert client.post("/api/radar/answer", json={"question_id": "RQ-NOPE", "option_id": "yes"}).status_code == 404
    assert client.post("/api/radar/answer", json={"question_id": "RQ-NOPE", "option_id": "maybe"}).status_code == 422
    assert client.post("/api/radar/scan", json={"flight_id": "XX-1"}).status_code == 404


def test_radar_scan_of_the_flight_asks_the_sunday_vow_and_stays_quiet_otherwise(client):
    out = client.post("/api/radar/scan", json={"flight_id": FLIGHT}).json()
    assert out["quiet"] > 50
    assert all(q["date"] == "2026-10-25" for q in out["asked"])
    assert client.post("/api/radar/scan", json={"flight_id": FLIGHT}).json()["asked"] == []


def test_seeded_fast_without_confirm_still_applies(client):
    out = client.get("/api/passport/PX-0106").json()  # 29H: a fast typed as a date applies directly
    assert out["plan"]["code"] == "AVML" and "NO GRAIN" in out["plan"]["kitchen_note"]


def test_passport_never_stores_diet_names(client):
    save(client, PRIYA, PRIYA_RULES)
    stored = client.get(f"/api/passport/{PRIYA}").json()
    text = str(stored["rules"]).lower() + str(stored["label_mark"]).lower()
    for word in ("purnima", "jain", "halal", "sharad"):
        assert word not in text
