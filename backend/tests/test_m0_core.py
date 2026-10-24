from app.core import alerts, events, outbox
from app.core.db import new_session
from app.core.models import MealPromise

FLIGHT = "JL740-20261025"


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_flight_counts(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    f = client.get(f"/api/flights/{FLIGHT}").json()
    assert f["counts"]["passengers"] == 186
    assert f["counts"]["special_meals"] >= 22
    assert f["std"] == "2026-10-25T04:35:00+05:30"


def test_clock_set_and_reset(client):
    r = client.post("/api/clock", json={"now": "2026-10-24T23:02:00+05:30"})
    assert r.json()["now"].startswith("2026-10-24T23:02")
    assert client.get("/api/clock").json()["now"].startswith("2026-10-24T23:0")
    assert client.post("/api/clock", json={"now": "2026-10-24T23:02:00"}).status_code == 422
    first = client.post("/api/demo/reset", json={}).json()["seed_epoch"]
    assert client.post("/api/demo/reset").json()["seed_epoch"] == first + 1
    assert client.get("/api/clock").json()["now"].startswith("2026-10-23T18:00")


def test_passengers_with_promises(client):
    rows = client.get(f"/api/flights/{FLIGHT}/passengers?with_promises=true").json()
    priya = next(p for p in rows if p["seat"] == "23C")
    anil = next(p for p in rows if p["seat"] == "24A")
    assert priya["pnr"] == "6XK2QP" and "promise" not in priya
    assert anil["ssr_meal"] == "HNML" and anil["promise"]["code"] == "AVML"


def test_helpers(client):
    client.post("/api/demo/reset", json={"keep_judges": False})
    with new_session() as s:
        promise = s.get(MealPromise, "MP-0063")
        events.record_checkpoint(promise.id, promise.passenger_id, FLIGHT, "C2", "fail", "test", "lost",
                                 key="t1", session=s)
        events.record_checkpoint(promise.id, promise.passenger_id, FLIGHT, "C2", "fail", "test", "again",
                                 key="t1", session=s)
        a1 = alerts.raise_alert(FLIGHT, "WRONG_CODE", "warning", "t", "b", passenger_id="PX-0063", session=s)
        a2 = alerts.raise_alert(FLIGHT, "WRONG_CODE", "warning", "t", "b", passenger_id="PX-0063", session=s)
        outbox.notify("sms", "PX-0063", "Hello", "Body", session=s)
        s.commit()
        assert a1.id == a2.id
        s.refresh(promise)
        assert promise.checkpoints["C2"] == "fail" and promise.status == "broken"
    assert client.get("/api/notifications?to=PX-0063").json()[0]["title"] == "Hello"


def test_at_wall_uses_the_clock_setting_in_effect_then(client, monkeypatch):
    from datetime import datetime, timedelta, timezone

    from app.core import clock

    t0 = datetime(2026, 10, 24, 16, 0, tzinfo=timezone.utc)
    boarding = datetime(2026, 10, 25, 3, 35, tzinfo=clock.IST)
    in_the_air = datetime(2026, 10, 25, 5, 20, tzinfo=clock.IST)
    monkeypatch.setattr(clock, "_wall", lambda: t0)
    clock.set(boarding)
    monkeypatch.setattr(clock, "_wall", lambda: t0 + timedelta(minutes=10))
    clock.set(in_the_air)
    assert clock.at_wall(t0 + timedelta(minutes=5)) == boarding + timedelta(minutes=5)
    assert clock.at_wall(t0 + timedelta(minutes=12)) == in_the_air + timedelta(minutes=2)
