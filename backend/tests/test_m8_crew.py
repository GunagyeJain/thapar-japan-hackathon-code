import json

FLIGHT = "JL740-20261025"
PRIYA_TRAY = "TB-7K2Q9F"


def _package(client):
    return client.get(f"/api/flights/{FLIGHT}/crew-package")


def test_package_is_small_and_complete(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    r = _package(client)
    assert len(r.content) < 300_000, len(r.content)
    pkg = r.json()
    assert len(pkg["passengers"]) == 186
    assert PRIYA_TRAY in pkg["expected_specials"]
    assert pkg["seed_epoch"] >= 1
    priya = next(p for p in pkg["passengers"] if p["seat"] == "23C")
    spare_avml = next(i for i in pkg["items"] if i["kind"] == "spare" and i["spec_id"] == "SPEC-AVML")
    # Priya has no profile yet at reset: her booked AVML + NO ONION NO GARLIC still rules out the onion spare.
    assert pkg["verdicts"][priya["id"]][spare_avml["id"]] == "UNSAFE"
    assert pkg["verdicts"][priya["id"]][PRIYA_TRAY] == "SAFE"


def _events(client, epoch, events):
    return client.post(f"/api/flights/{FLIGHT}/crew-events", json={"seed_epoch": epoch, "events": events})


def test_galley_swap_and_replay(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    pkg = _package(client).json()
    epoch = pkg["seed_epoch"]
    shah = next(p for p in pkg["passengers"] if p["seat"] == "27D")
    shah_tray = next(i for i in pkg["items"] if i["assigned_passenger_id"] == shah["id"])
    backup = next(i for i in pkg["items"] if i["kind"] == "backup")
    evs = [
        {"client_id": "t-1", "type": "galley_found", "item_id": PRIYA_TRAY, "at": "2026-10-25T05:05:00+05:30"},
        {"client_id": "t-2", "type": "galley_missing", "item_id": shah_tray["id"], "at": "2026-10-25T05:06:00+05:30"},
        {"client_id": "t-3", "type": "swap_backup", "item_id": backup["id"], "passenger_id": shah["id"],
         "at": "2026-10-25T05:07:00+05:30"},
    ]
    assert _events(client, epoch, evs).json() == {"accepted": 3, "duplicates": 0, "ignored_old_epoch": 0}
    assert _events(client, epoch, evs).json() == {"accepted": 0, "duplicates": 3, "ignored_old_epoch": 0}
    assert _events(client, epoch - 1, evs).json()["ignored_old_epoch"] == 3

    after = _package(client).json()
    swapped = next(i for i in after["items"] if i["id"] == backup["id"])
    assert swapped["assigned_passenger_id"] == shah["id"]
    shah_promise = next(p for p in after["promises"] if p["passenger_id"] == shah["id"])
    assert shah_promise["checkpoints"]["C4"] == "fixed"


def test_red_scan_raises_alert(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    pkg = _package(client).json()
    spare_avml = next(i for i in pkg["items"] if i["kind"] == "spare" and i["spec_id"] == "SPEC-AVML")
    r = _events(client, pkg["seed_epoch"], [
        {"client_id": "s-1", "type": "seat_scan", "item_id": spare_avml["id"], "seat": "23C", "verdict": "UNSAFE",
         "reason": "contains onion", "at": "2026-10-25T05:20:00+05:30"},
        {"client_id": "s-2", "type": "seat_scan", "item_id": PRIYA_TRAY, "seat": "23C", "verdict": "SAFE",
         "at": "2026-10-25T05:21:00+05:30"},
    ])
    assert r.json()["accepted"] == 2
    notes = client.get("/api/notifications?to=crew:JL740").json()
    assert "contains onion" in json.dumps(notes)


def test_same_events_from_two_syncs_at_once_count_as_duplicates(client, monkeypatch):
    """Two syncs with the same events race: the one that saves second must not fail with a 500."""
    import importlib

    from sqlalchemy.exc import IntegrityError

    from app.core.db import new_session
    from app.core.models import Flight

    crew_router = importlib.import_module("app.modules.m8_crew.router")  # the module, not the APIRouter

    client.post("/api/demo/reset", json={"keep_judges": False})
    epoch = _package(client).json()["seed_epoch"]
    real = crew_router.apply_events
    raced = []

    def other_sync_saves_first(session, flight, body):
        if not raced:
            raced.append(True)
            with new_session() as other:
                real(other, other.get(Flight, flight.id), body)
                other.commit()
            raise IntegrityError("INSERT INTO creweventlog", {}, Exception("UNIQUE constraint failed"))
        return real(session, flight, body)

    monkeypatch.setattr(crew_router, "apply_events", other_sync_saves_first)
    ev = {"client_id": "race-1", "type": "galley_found", "item_id": PRIYA_TRAY, "at": "2026-10-25T05:05:00+05:30"}
    r = _events(client, epoch, [ev])
    assert r.status_code == 200
    assert r.json() == {"accepted": 0, "duplicates": 1, "ignored_old_epoch": 0}
