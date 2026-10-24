"""The whole demo story by API alone, twice."""
from sqlmodel import select

from app.core.db import new_session
from app.core.models import MealItem, MealPromise, Passenger

FLIGHT = "JL740-20261025"
GREEN = {"ok", "fixed"}


def run_story(client) -> list[list[str]]:
    log = []
    for n in range(9):
        res = client.post("/api/demo/step", json={"n": n, "auto": True})
        assert res.status_code == 200, (n, res.text)
        log.append(res.json()["did"])
    return log


def by_seat(s, seat):
    return s.exec(select(Passenger).where(Passenger.flight_id == FLIGHT, Passenger.seat == seat)).one()


def test_story_ends_with_priya_green_and_27d_on_the_backup(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    run_story(client)
    with new_session() as s:
        priya = by_seat(s, "23C")
        promise = s.exec(select(MealPromise).where(MealPromise.passenger_id == priya.id)).one()
        assert {k: promise.checkpoints[k] in GREEN for k in ("C1", "C2", "C3", "C4", "C5")} == dict.fromkeys(
            ("C1", "C2", "C3", "C4", "C5"), True
        ), promise.checkpoints
        assert promise.checkpoints["C2"] == "fixed"
        shah = by_seat(s, "27D")
        tray = s.exec(select(MealItem).where(MealItem.assigned_passenger_id == shah.id, MealItem.status == "served")).one()
        assert tray.kind == "backup"
        mehta = by_seat(s, "31K")
        assert s.exec(select(MealItem).where(MealItem.assigned_passenger_id == mehta.id)).one().spec_id == "SPEC-VJML"
    scenario = client.get("/api/demo/scenario").json()
    assert scenario["current"] == 8 and all(step["done"] for step in scenario["steps"])


def test_each_step_is_idempotent(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    run_story(client)
    for n in range(1, 9):
        assert client.post("/api/demo/step", json={"n": n, "auto": True}).status_code == 200
    with new_session() as s:
        shah = by_seat(s, "27D")
        assert len(s.exec(select(MealItem).where(MealItem.assigned_passenger_id == shah.id, MealItem.kind == "backup")).all()) == 1


def test_step_zero_resets_and_sets_the_clock(client):
    client.post("/api/demo/step", json={"n": 5, "auto": True})
    res = client.post("/api/demo/step", json={"n": 0}).json()
    assert res["clock"].startswith("2026-10-23T18:00")
    again = client.post("/api/demo/step", json={"n": 0}).json()
    assert again["did"] == ["Already reset; nothing has happened since."]
    assert client.post("/api/demo/step", json={"n": 9}).status_code == 422
