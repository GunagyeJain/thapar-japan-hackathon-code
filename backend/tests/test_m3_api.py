"""m3 endpoints over HTTP: lookup, profiles (C1 + WRONG_CODE) and judge join."""
from concurrent.futures import ThreadPoolExecutor

import pytest

FLIGHT = "JL740-20261025"
PRIYA = {"forbid": ["meat", "seafood", "egg", "onion", "garlic"], "allow": ["dairy"]}
CONSENT = {"this_trip": True, "save_profile": False, "share_with_caterer": True, "cross_border_ack": True}


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def join(client, name, forbid=("meat", "seafood", "egg")):
    return client.post(
        "/api/join",
        json={"display_name": name, "lang": "en", "presets": ["vegetarian"], "forbid": list(forbid), "allow": ["dairy"], "consent": CONSENT},
    )


def test_lookup_priya_is_forgiving_about_case_and_spaces(client):
    res = client.get("/api/passenger/lookup", params={"pnr": " 6xk2qp", "surname": "Sharma "})
    assert res.status_code == 200
    assert res.json()["seat"] == "23C"


def test_lookup_wrong_surname_is_404(client):
    assert client.get("/api/passenger/lookup", params={"pnr": "6XK2QP", "surname": "VERMA"}).status_code == 404


def test_priya_profile_gives_avml_with_note_and_c1(client):
    pid = client.get("/api/passenger/lookup", params={"pnr": "6XK2QP", "surname": "SHARMA"}).json()["id"]
    res = client.post(
        "/api/profiles",
        json={"passenger_id": pid, "lang": "hi", "presets": ["vegetarian", "no_onion_garlic"], **PRIYA, "consent": CONSENT, "chosen_code": "AVML"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["promise"]["code"] == "AVML"
    assert body["promise"]["kitchen_note"] == "NO ONION NO GARLIC"
    assert body["promise"]["checkpoints"]["C1"] == "ok"
    assert body["booking_check"]["ok"] is True
    assert body["profile"]["consent"]["at"]

    rows = client.get(f"/api/flights/{FLIGHT}/passengers", params={"with_promises": "true"}).json()
    priya = next(r for r in rows if r["id"] == pid)
    assert priya["promise"]["code"] == "AVML" and priya["profile_id"] == body["profile"]["id"]


def test_saving_twice_updates_the_same_promise(client):
    pid = client.get("/api/passenger/lookup", params={"pnr": "6XK2QP", "surname": "SHARMA"}).json()["id"]
    payload = {"passenger_id": pid, "presets": ["vegetarian"], **PRIYA, "consent": CONSENT, "chosen_code": "AVML"}
    first = client.post("/api/profiles", json=payload).json()
    second = client.post("/api/profiles", json={**payload, "chosen_code": "VJML"}).json()
    assert second["promise"]["id"] == first["promise"]["id"]
    assert second["profile"]["id"] == first["profile"]["id"]
    assert second["promise"]["code"] == "VJML"


def test_verma_on_hnml_raises_wrong_code(client):
    rows = client.get(f"/api/flights/{FLIGHT}/passengers").json()
    verma = next(r for r in rows if r["surname"] == "VERMA" and r["seat"] == "24A")
    before = client.get(f"/api/flights/{FLIGHT}").json()["counts"]["open_alerts"]
    res = client.post(
        "/api/profiles",
        json={"passenger_id": verma["id"], "presets": ["vegetarian"], "forbid": ["meat", "seafood", "egg"], "allow": ["dairy"], "consent": CONSENT, "chosen_code": "AVML"},
    )
    assert res.status_code == 200, res.text
    check = res.json()["booking_check"]
    assert check["ok"] is False and check["suggested_code"] == "AVML"
    # /api/alerts belongs to m4, so count open alerts through the flight instead.
    assert client.get(f"/api/flights/{FLIGHT}").json()["counts"]["open_alerts"] == before + 1


def test_unsafe_chosen_code_is_refused(client):
    pid = client.get("/api/passenger/lookup", params={"pnr": "6XK2QP", "surname": "SHARMA"}).json()["id"]
    res = client.post("/api/profiles", json={"passenger_id": pid, **PRIYA, "consent": CONSENT, "chosen_code": "HNML"})
    assert res.status_code == 400


def test_no_consent_is_refused(client):
    pid = client.get("/api/passenger/lookup", params={"pnr": "6XK2QP", "surname": "SHARMA"}).json()["id"]
    res = client.post("/api/profiles", json={"passenger_id": pid, **PRIYA, "consent": {**CONSENT, "this_trip": False}, "chosen_code": "AVML"})
    assert res.status_code == 400


def test_two_judges_get_5a_then_5c(client):
    a = join(client, "Judge 1")
    b = join(client, "Judge 2")
    assert a.status_code == 200, a.text
    assert (a.json()["passenger"]["seat"], b.json()["passenger"]["seat"]) == ("5A", "5C")
    assert a.json()["passenger"]["is_judge"] is True
    assert a.json()["promise"]["checkpoints"]["C1"] == "ok"
    assert a.json()["passenger"]["cabin"] == "C"


def test_judges_joining_at_once_never_share_a_seat(client):
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda n: join(client, f"Judge {n}"), range(6)))
    seats = sorted(r.json()["passenger"]["seat"] for r in results)
    assert seats == ["5A", "5C", "5D", "5G", "5H", "5K"]


def test_judges_survive_reset_when_kept(client):
    join(client, "Judge 1")
    client.post("/api/demo/reset", json={"keep_judges": True})
    rows = client.get(f"/api/flights/{FLIGHT}/passengers", params={"with_promises": "true"}).json()
    judge = next(r for r in rows if r["is_judge"])
    assert judge["seat"] == "5A" and judge["promise"]["checkpoints"]["C1"] == "ok"
