import pytest

FLIGHT = "JL740-20261025"


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def test_cabin_knows_about_half(client):
    out = client.get(f"/api/passport/cabin/{FLIGHT}").json()
    assert out["total"] == 186
    assert 90 <= out["known"] <= 115
    seats = {p["seat"]: p for p in out["passengers"]}
    assert not seats["23C"]["known"] and not seats["31K"]["known"] and not seats["30C"]["known"]
    assert seats["2A"]["tier"] == "hard"


def test_no_diet_names_stored(client):
    out = client.get(f"/api/passport/cabin/{FLIGHT}").json()
    # Tag ids like non_halal_meat are food rules; a diet or festival name on its own is not.
    text = str([p["rules"] for p in out["passengers"]]).lower().replace("non_halal_meat", "").replace("halal_certified", "")
    for word in ("jain", "halal", "hindu", "muslim", "purnima", "ekadashi", "navratri"):
        assert word not in text


def test_fast_on_the_flight_date_changes_the_plan(client):
    out = client.get("/api/passport/PX-0106").json()  # 29H keeps a fast on 25 Oct
    assert out["plan"]["code"] == "AVML"
    assert "NO GRAIN" in out["plan"]["kitchen_note"]


def test_priya_has_no_passport_yet(client):
    assert client.get("/api/passport/PX-0057").status_code == 404
