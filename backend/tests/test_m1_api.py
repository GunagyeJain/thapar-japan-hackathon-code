"""m1 endpoints over HTTP, shapes as in shared/api.md."""


def test_get_rules(client):
    body = client.get("/api/rules").json()
    assert set(body) >= {"version", "taxonomy", "diets", "presets", "codes", "picker_groups"}
    assert len(body["presets"]) == 10


def test_evaluate_jain_vs_paneer_onion_garlic(client):
    jain = next(p for p in client.get("/api/rules").json()["presets"] if p["id"] == "jain")
    res = client.post("/api/rules/evaluate", json={"forbid": jain["forbid"], "spec_tags": ["paneer", "tomato", "onion", "garlic"]})
    assert res.status_code == 200
    body = res.json()
    assert body["verdict"] == "UNSAFE"
    assert [f["via"].split(" → ")[0] for f in body["fired"]] == ["onion", "garlic"]


def test_evaluate_by_profile_and_spec(client):
    res = client.post("/api/rules/evaluate", json={"profile_id": "PF-0087", "spec_id": "SPEC-Y-PANEER"})
    assert res.status_code == 200 and res.json()["verdict"] == "UNSAFE"
    assert client.post("/api/rules/evaluate", json={"profile_id": "PF-0087", "spec_id": "SPEC-NOPE"}).status_code == 404


def test_evaluate_rejects_bad_input(client):
    assert client.post("/api/rules/evaluate", json={"forbid": ["meat"]}).status_code == 422
    assert client.post("/api/rules/evaluate", json={"forbid": ["nope"], "spec_tags": ["rice"]}).status_code == 400


def test_code_options_priya(client):
    res = client.post("/api/rules/code-options", json={"forbid": ["meat", "seafood", "egg", "onion", "garlic"], "allow": ["dairy"]})
    options = res.json()["options"]
    assert [o["code"] for o in options[:2]] == ["AVML", "VJML"]
    assert options[0]["kitchen_note"] == "NO ONION NO GARLIC"


def test_check_booking_verma(client):
    res = client.post("/api/rules/check-booking", json={"forbid": ["meat", "seafood", "egg"], "booked_code": "HNML"})
    body = res.json()
    assert body["ok"] is False and body["suggested_code"] == "AVML"
    assert body["problem"]["contains"] == ["chicken", "fish"]
