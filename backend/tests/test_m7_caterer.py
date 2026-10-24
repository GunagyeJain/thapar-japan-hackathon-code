"""Caterer meal lists: versions, diff, hash, acknowledge (C3), labels."""
import pytest

FLIGHT = "JL740-20261025"


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def lists(client):
    return client.get(f"/api/flights/{FLIGHT}/meal-lists").json()


def priya_rebooked_and_fixed(client):
    for n in (1, 2, 3):
        assert client.post("/api/demo/step", json={"n": n, "auto": True}).status_code == 200


def test_seed_has_v1_and_v2_acknowledged(client):
    v2, v1 = lists(client)
    assert (v2["version"], v1["version"]) == (2, 1)
    assert v1["ack_at"] and v2["ack_at"] and len(v2["short_hash"]) == 12
    note = v2["diff"]["changed"][0]
    assert note["name"].startswith("JAIN/SUSHILA") and note["fields"] == [{"field": "note", "before": None, "after": "DIABETIC"}]
    codes = [line["code"] for line in v2["lines"]]
    assert codes == sorted(codes)


def test_cut_without_changes_returns_the_latest(client):
    assert client.post(f"/api/flights/{FLIGHT}/meal-lists").json()["version"] == 2


def test_v3_after_rebooking_shows_priyas_new_pnr_and_ack_writes_c3(client):
    priya_rebooked_and_fixed(client)
    v3 = client.post(f"/api/flights/{FLIGHT}/meal-lists").json()
    assert v3["version"] == 3 and v3["ack_at"] is None
    change = next(c for c in v3["diff"]["changed"] if c["name"].startswith("SHARMA/PRIYA"))
    assert change["fields"] == [{"field": "pnr", "before": "6XK2QP", "after": "8MZ2TN"}]
    assert change["after"]["code"] == "AVML"
    acked = client.post(f"/api/meal-lists/{v3['id']}/ack", json={"by": "Skyline Flight Kitchens · shift lead"}).json()
    assert acked["ack_at"] and acked["ack_by"].startswith("Skyline")
    again = client.post(f"/api/meal-lists/{v3['id']}/ack", json={"by": "someone else"}).json()
    assert again["ack_by"].startswith("Skyline")
    rows = client.get(f"/api/flights/{FLIGHT}/passengers", params={"with_promises": "true"}).json()
    priya = next(p for p in rows if p["seat"] == "23C")
    assert priya["promise"]["checkpoints"]["C3"] == "ok"
    notes = client.get("/api/notifications", params={"to": "caterer"}).json()
    assert notes[0]["title"].startswith("Meal list v3 received")


def test_labels_carry_the_item_id_and_no_seat(client):
    priya_rebooked_and_fixed(client)
    client.post(f"/api/flights/{FLIGHT}/meal-lists")
    labels = client.get(f"/api/flights/{FLIGHT}/labels").json()
    assert labels and all(lab["qr"] == lab["item_id"] and lab["item_id"].startswith("TB-") for lab in labels)
    assert all("seat" not in lab for lab in labels)
    priya = next(lab for lab in labels if lab["name"].startswith("SHARMA/PRIYA"))
    assert priya["mark"]["en"] == "VEG · no onion, no garlic" and priya["pnr"] == "8MZ2TN" and priya["version"] == 3
    verma = next(lab for lab in labels if lab["name"].startswith("VERMA"))
    assert verma["code"] == "HNML"
    assert client.get(f"/api/flights/{FLIGHT}/labels", params={"version": 1}).json()[0]["version"] == 1


def test_errors(client):
    assert client.get("/api/flights/XX/meal-lists").status_code == 404
    assert client.post("/api/meal-lists/ML-NOPE/ack", json={"by": "x"}).status_code == 404
    assert client.post("/api/meal-lists/ML-JL740-V1/ack", json={"by": ""}).status_code == 422
    assert client.get(f"/api/flights/{FLIGHT}/labels", params={"version": 9}).status_code == 404
