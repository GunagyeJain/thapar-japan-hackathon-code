"""The v2 demo story by API alone (docs/plan/v2.md): passport, Radar, Chaos Mode, crew, landing."""
from sqlmodel import select

from app.core.db import new_session
from app.core.models import MealItem, MealPromise, Passenger
from app.modules.m11_story.steps import STEPS

FLIGHT = "JL740-20261025"
LAST = len(STEPS) - 1


def run_story(client) -> list[list[str]]:
    log = []
    for n in range(len(STEPS)):
        res = client.post("/api/demo/step", json={"n": n, "auto": True})
        assert res.status_code == 200, (n, res.text)
        log.append(res.json()["did"])
    return log


def by_seat(s, seat):
    return s.exec(select(Passenger).where(Passenger.flight_id == FLIGHT, Passenger.seat == seat)).one()


def test_story_runs_end_to_end(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    run_story(client)
    passport = client.get("/api/passport/PX-0057").json()
    assert passport["plan"]["code"] == "AVML" and "NO GRAIN" in passport["plan"]["kitchen_note"]
    changes = client.get(f"/api/changes?flight_id={FLIGHT}").json()["events"]
    assert len([e for e in changes if e["channel"] != "radar"]) >= 7
    metrics = client.get(f"/api/changes/metrics?flight_id={FLIGHT}").json()
    assert metrics["ours"]["hard_met"] == metrics["ours"]["hard_total"] > metrics["today"]["hard_met"]
    with new_session() as s:
        mehta = by_seat(s, "31K")
        assert s.exec(select(MealItem).where(MealItem.assigned_passenger_id == mehta.id)).first().spec_id == "SPEC-VJML"
        priya = by_seat(s, "23C")
        promise = s.exec(select(MealPromise).where(MealPromise.passenger_id == priya.id)).one()
        assert promise.checkpoints["C2"] == "fixed"
    scenario = client.get("/api/demo/scenario").json()
    assert scenario["current"] == LAST and all(step["done"] for step in scenario["steps"])


def test_each_step_is_idempotent(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    run_story(client)
    before = len(client.get(f"/api/changes?flight_id={FLIGHT}").json()["events"])
    for n in range(1, len(STEPS)):
        assert client.post("/api/demo/step", json={"n": n, "auto": True}).status_code == 200
    assert len(client.get(f"/api/changes?flight_id={FLIGHT}").json()["events"]) == before


def test_step_zero_resets_and_sets_the_clock(client):
    client.post("/api/demo/step", json={"n": 3, "auto": True})
    res = client.post("/api/demo/step", json={"n": 0}).json()
    assert res["clock"].startswith("2026-10-23T18:00")
    again = client.post("/api/demo/step", json={"n": 0}).json()
    assert again["did"] == ["Already reset; nothing has happened since."]
    assert client.post("/api/demo/step", json={"n": len(STEPS)}).status_code == 422
