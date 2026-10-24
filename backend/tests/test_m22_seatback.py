import pytest
from sqlmodel import Session, select

from app.core.db import engine as db
from app.core.models import CheckpointEvent, MealItem
from app.modules.m18_changes.rungs import released_on

FLIGHT = "JL740-20261025"
IN_FLIGHT = "2026-10-25T05:50:00+05:30"


@pytest.fixture(autouse=True)
def fresh(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    client.post("/api/clock", json={"now": IN_FLIGHT})


def _ask(client):
    res = client.post("/api/seatback/ask", json={"flight_id": FLIGHT})
    assert res.status_code == 200, res.text
    return res.json()


def _answer(client, seat, answer, item_id=None):
    return client.post("/api/seatback/answer", json={"flight_id": FLIGHT, "seat": seat, "answer": answer, "item_id": item_id})


def _seat(client, seat):
    res = client.get(f"/api/seatback/{FLIGHT}/seats/{seat}")
    assert res.status_code == 200, res.text
    return res.json()


def _holder(item_id):
    with Session(db) as s:
        return s.get(MealItem, item_id).assigned_passenger_id


def test_ask_reaches_every_seat_with_a_special_or_held_meal(client):
    out = _ask(client)
    seats = {s["seat"]: s for s in out["seats"]}
    assert out["round"] == 1 and out["counts"]["asked"] == len(seats) > 20
    assert seats["23C"]["held"] == "special" and seats["23C"]["item_id"] == "TB-7K2Q9F"
    assert any(s["held"] == "main" for s in seats.values())  # a main course held by a passport plan counts too
    crew = client.get("/api/notifications?to=crew:JL740").json()
    assert any(n["ref"].get("kind") == "seatback" for n in crew)


def test_seat_screen_shows_initials_only_and_the_meal_after_a_tap(client):
    before = _seat(client, "23C")
    assert before["occupied"] and before["ask"] is None
    _ask(client)
    view = _seat(client, "23C")
    assert view["initials"] == "P. S." and "Sharma" not in str(view) and "SHARMA" not in str(view)
    assert view["ask"]["status"] == "asked" and view["ask"]["meal"]["item_id"] == "TB-7K2Q9F"
    assert "garlic" in view["ask"]["meal"]["mark"]["en"].lower()
    assert not _seat(client, "5A")["occupied"]  # the judges' row is empty after a reset without judges


def test_yes_confirms_at_the_seat_and_keeps_the_tray_scan_as_the_check(client):
    _ask(client)
    res = _answer(client, "23C", "yes")
    assert res.status_code == 200, res.text
    assert res.json()["ask"]["status"] == "confirmed"
    status = client.get(f"/api/seatback/{FLIGHT}").json()
    assert next(s for s in status["seats"] if s["seat"] == "23C")["status"] == "confirmed"
    assert status["counts"]["confirmed"] == 1
    assert _holder("TB-7K2Q9F") == "PX-0057"
    with Session(db) as s:
        lines = s.exec(select(CheckpointEvent).where(CheckpointEvent.passenger_id == "PX-0057",
                                                     CheckpointEvent.source == "seat screen")).all()
    assert [(e.checkpoint, e.result) for e in lines] == [("C5", "info")]  # an info line never sets the checkpoint
    crew = client.get("/api/notifications?to=crew:JL740").json()
    assert any("confirmed at seat" in n["title"] for n in crew)


def test_no_frees_the_tray_for_the_next_request_on_board(client):
    _ask(client)
    assert _answer(client, "23C", "no").json()["ask"]["status"] == "skipped"
    assert _holder("TB-7K2Q9F") is None
    with Session(db) as s:
        assert ("23C", "TB-7K2Q9F", "seat") in [(seat, item.id, how) for seat, item, how in released_on(s, FLIGHT)]
    # "No" by mistake: Yes takes the tray back while nobody else holds it.
    assert _answer(client, "23C", "yes").json()["ask"]["status"] == "confirmed"
    assert _holder("TB-7K2Q9F") == "PX-0057"
    with Session(db) as s:
        assert not released_on(s, FLIGHT)


def test_change_offers_only_what_fits_and_moves_the_tray(client):
    _ask(client)
    seat, option = None, None
    for row in client.get(f"/api/seatback/{FLIGHT}").json()["seats"]:
        opts = client.get(f"/api/seatback/{FLIGHT}/seats/{row['seat']}/options").json()["options"]
        if opts and row["item_id"]:
            seat, option, old = row["seat"], opts[0], row["item_id"]
            break
    assert seat, "some seat with a held tray should have an alternative on board"
    view = _answer(client, seat, "change", option["item_id"]).json()
    assert view["ask"]["status"] == "changed" and view["ask"]["choice"]["item_id"] == option["item_id"]
    pid = next(s for s in client.get(f"/api/seatback/{FLIGHT}").json()["seats"] if s["seat"] == seat)["passenger_id"]
    assert _holder(option["item_id"]) == pid and _holder(old) is None
    # Taken items aren't offered again; an item that isn't on the list is refused.
    assert _answer(client, seat, "change", "TB-NOPE00").status_code == 422


def test_change_reads_rules_the_router_learned_at_the_gate(client):
    # 31K asks for a Jain meal at the gate in Chaos Mode: no passport, so the rules come from that change.
    assert client.post("/api/chaos/run", json={"flight_id": FLIGHT}).status_code == 200
    out = client.get(f"/api/seatback/{FLIGHT}/seats/31K/options").json()
    assert out["rules_known"] and not any("Chicken" in o["name"]["en"] for o in out["options"])


def test_no_answer_after_ten_minutes_means_ask_in_person(client):
    _ask(client)
    client.post("/api/clock", json={"now": "2026-10-25T06:01:00+05:30"})
    assert _seat(client, "23C")["ask"]["status"] == "no_answer"
    assert client.get(f"/api/seatback/{FLIGHT}").json()["counts"]["no_answer"] > 0


def test_asking_again_keeps_answers(client):
    _ask(client)
    _answer(client, "23C", "yes")
    again = _ask(client)
    assert again["round"] == 2
    assert next(s for s in again["seats"] if s["seat"] == "23C")["status"] == "confirmed"


@pytest.mark.parametrize("seat,status", [("23C", 409), ("5A", 404)])
def test_answers_need_a_question_and_a_passenger(client, seat, status):
    assert _answer(client, seat, "yes").status_code == status


def test_bad_input(client):
    assert _answer(client, "ZZ", "yes").status_code == 422
    assert _answer(client, "23C", "maybe").status_code == 422
    assert client.get(f"/api/seatback/{FLIGHT}/seats/23Z").status_code == 422
    assert client.get("/api/seatback/JL000-20990101").status_code == 404


def test_demo_step_4_asks_the_seats_before_the_scans(client):
    for n in range(4):
        assert client.post("/api/demo/step", json={"n": n, "auto": True}).status_code == 200
    out = client.post("/api/demo/step", json={"n": 4, "auto": True}).json()
    assert any("Yes on the seat screen" in line for line in out["did"])
    seats = {s["seat"]: s for s in client.get(f"/api/seatback/{FLIGHT}").json()["seats"]}
    assert seats["23C"]["status"] == "confirmed"
    again = client.post("/api/demo/step", json={"n": 4, "auto": True}).json()
    assert any("already answered" in line for line in again["did"])
