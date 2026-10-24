"""Judges can tick any combination, and change their answers without taking a second seat."""

FLIGHT = "JL740-20261025"
CONSENT = {"this_trip": True, "save_profile": False, "share_with_caterer": True, "cross_border_ack": True}
EVERYTHING = ["meat", "seafood", "egg", "onion", "garlic", "root_veg", "dairy", "honey", "alcohol",
              "wheat", "buckwheat", "peanut", "shrimp", "crab", "walnut"]


def _join(client, forbid, **extra):
    return client.post("/api/join", json={"display_name": "Judge 1", "lang": "en", "forbid": forbid, "allow": [],
                                          "consent": CONSENT, **extra})


def test_no_code_fits_falls_back_to_spml_with_a_note(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    res = _join(client, EVERYTHING)
    assert res.status_code == 200, res.text
    promise = res.json()["promise"]
    assert promise["code"] == "SPML"
    assert promise["kitchen_note"].startswith("NO ")
    assert len(promise["kitchen_note"]) <= 60
    opts = client.post("/api/passenger/meal-options", json={"forbid": EVERYTHING}).json()["options"]
    assert [o["code"] for o in opts] == ["SPML"]


def test_nothing_ticked_says_so(client):
    res = _join(client, [])
    assert res.status_code == 400
    assert "food you don't eat" in res.json()["detail"]


def test_changing_answers_keeps_the_seat_and_frees_the_old_meal(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    first = _join(client, ["meat", "seafood", "egg"]).json()
    pid, seat = first["passenger"]["id"], first["passenger"]["seat"]
    late = {"flight_id": FLIGHT, "passenger_id": pid, "forbid": ["meat", "seafood", "egg"], "allow": [], "source": "join"}
    item1 = client.post("/api/late-requests", json=late).json()["match"]["item"]["id"]

    again = _join(client, ["wheat"], passenger_id=pid).json()
    assert again["passenger"]["id"] == pid and again["passenger"]["seat"] == seat
    assert again["profile"]["forbid"] == ["wheat"]
    pax = client.get(f"/api/flights/{FLIGHT}/passengers").json()
    assert sum(1 for p in pax if p["is_judge"]) == 1

    inv = client.get(f"/api/flights/{FLIGHT}/inventory").json()["items"]
    assert next(i for i in inv if i["id"] == item1)["assigned_passenger_id"] is None
    second = client.post("/api/late-requests", json={**late, "forbid": ["wheat"]}).json()
    assert second["match"]["status"] in ("matched", "voucher")


def test_changing_answers_after_a_reset_asks_to_join_again(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    res = _join(client, ["egg"], passenger_id="PX-9999")
    assert res.status_code == 404
