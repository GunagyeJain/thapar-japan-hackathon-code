import sys
import types
from datetime import date, datetime, timedelta

import pytest

from app.modules.m21_sun import service, solar
from app.modules.m21_sun.route import AIRPORTS, IST, JST, Airport

FLIGHT_ID = "JL740-20261025"
JL740 = ("DEL", "NRT", datetime(2026, 10, 25, 4, 35, tzinfo=IST), datetime(2026, 10, 25, 15, 20, tzinfo=JST))
JL030 = ("DEL", "HND", datetime(2026, 10, 25, 19, 55, tzinfo=IST), datetime(2026, 10, 26, 6, 30, tzinfo=JST))
NIGHT_HOP = ("DEL", "BLR", datetime(2026, 10, 25, 22, 0, tzinfo=IST), datetime(2026, 10, 26, 0, 45, tzinfo=IST))
DAYLIGHT_48 = {"kind": "daylight", "after_sunrise_min": 48}
FAST = {"kind": "fast_dawn_to_sunset"}
M17 = "app.modules.m17_passport"

# Published sunrise times (sunrise-sunset.org, city centres): New Delhi 25 Oct 2026 06:28:02 IST,
# Tokyo 26 Oct 2026 05:56:47 JST, Bengaluru 25 Oct 2026 06:11:28 IST.
PUBLISHED = [
    (Airport("NDL", 28.6139, 77.2090, IST), date(2026, 10, 25), datetime(2026, 10, 25, 6, 28, 2, tzinfo=IST)),
    (Airport("TYO", 35.6895, 139.6917, JST), date(2026, 10, 26), datetime(2026, 10, 26, 5, 56, 47, tzinfo=JST)),
    (Airport("BLC", 12.9716, 77.5946, IST), date(2026, 10, 25), datetime(2026, 10, 25, 6, 11, 28, tzinfo=IST)),
]
FLIGHT_KEYS = {"flight_id", "flight_no", "origin", "dest", "dep", "arr", "track", "threshold_cruise", "sunrise", "sunset", "fajr"}
EVENT_KEYS = {"at_aircraft", "at_origin", "minutes_earlier", "lat", "lon", "alt_m"}
WINDOW_KEYS = {"may_eat_from", "may_eat_until", "sunrise_box", "note"}


@pytest.fixture
def reset(client):
    client.post("/api/demo/reset", json={"keep_judges": False})


def minutes_apart(a: datetime, b: datetime) -> float:
    return abs((a - b).total_seconds()) / 60


@pytest.mark.parametrize(("place", "day", "published"), PUBLISHED)
def test_ground_sunrise_matches_published_times(place, day, published):
    assert minutes_apart(service.ground_event(place, day, solar.SUNRISE_DEG, rising=True), published) <= 2


def test_delhi_airport_sunrise_on_the_demo_day():
    rise = service.ground_event(AIRPORTS["DEL"], date(2026, 10, 25), solar.SUNRISE_DEG, rising=True)
    assert minutes_apart(rise, datetime(2026, 10, 25, 6, 28, tzinfo=IST)) <= 3


def test_horizon_dip_lowers_the_sunrise_line_at_altitude():
    assert solar.dip_deg(0) == 0
    assert solar.sunrise_threshold(0) == pytest.approx(-0.833)
    assert solar.sunrise_threshold(11_000) == pytest.approx(-3.91, abs=0.01)


def test_track_climbs_cruises_and_descends():
    samples = service.track(*JL740)
    assert samples[0].at == JL740[2] and samples[-1].at == JL740[3]
    assert samples[1].at - samples[0].at == timedelta(seconds=30)
    by_minute = {int(gone.total_seconds()) // 60: s for s in samples if (gone := s.at - JL740[2]).seconds % 60 == 0}
    assert by_minute[0].alt_m == 0 and samples[-1].alt_m == 0
    assert by_minute[25].alt_m == pytest.approx(11_000) and by_minute[200].alt_m == pytest.approx(11_000)
    middle = by_minute[218]
    assert 28 < middle.lat < 45 and 77 < middle.lon < 141  # on the way, north of both ends (great circle)


def test_jl740_meets_the_sunrise_before_delhi_does():
    ev = service.sun_events(*JL740)
    assert ev.sunrise is not None and ev.sunrise.alt_m == pytest.approx(11_000)
    assert ev.sunrise.lon > 80  # already well east of Delhi
    assert ev.origin_sunrise is not None and ev.sunrise.at < ev.origin_sunrise
    assert ev.minutes_earlier == round((ev.origin_sunrise - ev.sunrise.at).total_seconds() / 60)
    assert 30 <= ev.minutes_earlier <= 70
    assert ev.sunset is None  # lands in Tokyo before sunset


def test_jl740_daylight_rule_waits_48_minutes_after_sunrise_at_the_aircraft():
    ev = service.sun_events(*JL740)
    window = service.eat_window(ev, DAYLIGHT_48)
    assert window["sunrise_box"] is False
    assert window["may_eat_from"] == ev.sunrise.at + timedelta(minutes=48)
    assert window["may_eat_from"] < ev.origin_sunrise + timedelta(minutes=48)
    assert window["may_eat_until"] is None
    assert "48 min after sunrise" in window["note"]["en"] and window["note"]["hi"] and window["note"]["ja"]
    assert service.eat_window(ev, {"kind": "daylight", "after_sunrise_min": 0})["may_eat_from"] == ev.sunrise.at


def test_pure_night_flight_gets_a_sunrise_box():
    ev = service.sun_events(*NIGHT_HOP)
    assert ev.sunrise is None
    window = service.eat_window(ev, DAYLIGHT_48)
    assert window == {"may_eat_from": None, "may_eat_until": None, "sunrise_box": True, "note": window["note"]}
    assert "Sunrise Box" in window["note"]["en"]


def test_overnight_jl030_is_a_sunrise_box_for_the_daylight_rule():
    window = service.eat_window(service.sun_events(*JL030), DAYLIGHT_48)
    assert window["sunrise_box"] is True


def test_dawn_to_sunset_fast():
    jl740 = service.sun_events(*JL740)
    assert jl740.fajr is not None and jl740.fajr.at < jl740.sunrise.at
    assert service.eat_window(jl740, FAST)["sunrise_box"] is True  # dawn comes during the climb, sunset after landing
    night = service.eat_window(service.sun_events(*NIGHT_HOP), FAST)
    assert night["sunrise_box"] is False and night["may_eat_from"] == NIGHT_HOP[2]
    jl030 = service.sun_events(*JL030)
    overnight = service.eat_window(jl030, FAST)
    assert overnight["may_eat_from"] == JL030[2] and overnight["may_eat_until"] == jl030.fajr.at


def test_unknown_rule_is_refused():
    with pytest.raises(ValueError):
        service.eat_window(service.sun_events(*JL740), {"kind": "moonlight"})


def test_flight_endpoint(client, reset):
    res = client.get(f"/api/sun/flight/{FLIGHT_ID}")
    assert res.status_code == 200
    out = res.json()
    assert FLIGHT_KEYS <= set(out)
    assert (out["flight_id"], out["flight_no"], out["origin"], out["dest"]) == (FLIGHT_ID, "JL740", "DEL", "NRT")
    assert out["dep"] == "2026-10-25T04:35:00+05:30" and out["arr"] == "2026-10-25T15:20:00+09:00"
    assert out["threshold_cruise"] == pytest.approx(-3.91, abs=0.01)
    assert set(out["sunrise"]) == EVENT_KEYS and out["sunset"] is None and set(out["fajr"]) == EVENT_KEYS
    sunrise = out["sunrise"]
    assert sunrise["at_aircraft"] < sunrise["at_origin"] and sunrise["minutes_earlier"] > 30
    assert out["chauvihar"]["rule"] == DAYLIGHT_48 and out["chauvihar"]["sunrise_box"] is False
    eat_from = datetime.fromisoformat(out["chauvihar"]["may_eat_from"])
    assert eat_from == datetime.fromisoformat(sunrise["at_aircraft"]) + timedelta(minutes=48)
    assert {"at", "lat", "lon", "alt_m", "elev"} <= set(out["track"][0])
    steps = {datetime.fromisoformat(b["at"]) - datetime.fromisoformat(a["at"]) for a, b in zip(out["track"], out["track"][1:-1])}
    assert steps == {timedelta(minutes=5)}
    assert out["track"][-1]["at"] == "2026-10-25T11:50:00+05:30"  # arrival (15:20 JST), in the origin's zone


def test_flight_endpoint_follows_a_delay(client, reset):
    before = client.get(f"/api/sun/flight/{FLIGHT_ID}").json()
    client.post("/api/sim/booking-events", json={"type": "delay", "params": {"minutes": 60, "flight_id": FLIGHT_ID}})
    after = client.get(f"/api/sun/flight/{FLIGHT_ID}").json()
    assert after["delay_min"] == 60 and after["dep"] == "2026-10-25T05:35:00+05:30"
    assert after["sunrise"]["at_aircraft"] != before["sunrise"]["at_aircraft"]


def test_unknown_flight_is_404(client):
    assert client.get("/api/sun/flight/JL999-20261025").status_code == 404
    assert client.get("/api/sun/seats/JL999-20261025").status_code == 404


def test_route_endpoint(client):
    params = {"from": "DEL", "to": "NRT", "dep": "2026-10-25T04:35:00+05:30", "arr": "2026-10-25T15:20:00+09:00",
              "flight_no": "JL740"}
    res = client.get("/api/sun/route", params=params)
    assert res.status_code == 200
    out = res.json()
    assert FLIGHT_KEYS <= set(out) and out["flight_id"] is None and out["flight_no"] == "JL740"
    expected = service.sun_events(*JL740)
    assert datetime.fromisoformat(out["sunrise"]["at_aircraft"]) == expected.sunrise.at


@pytest.mark.parametrize("params", [
    {"from": "XXX", "to": "NRT", "dep": "2026-10-25T04:35:00+05:30", "arr": "2026-10-25T15:20:00+09:00"},
    {"from": "DEL", "to": "NRT", "dep": "2026-10-25T15:20:00+05:30", "arr": "2026-10-25T04:35:00+05:30"},
    {"from": "DEL", "to": "NRT", "dep": "2026-10-25T04:35:00", "arr": "2026-10-25T15:20:00+09:00"},
    {"from": "DEL", "to": "DEL", "dep": "2026-10-25T04:35:00+05:30", "arr": "2026-10-25T15:20:00+05:30"},
    {"from": "DEL", "to": "NRT", "dep": "2026-10-25T04:35:00+05:30", "arr": "2026-10-27T04:35:00+05:30"},
    {"from": "DEL", "to": "NRT", "dep": "yesterday-morning", "arr": "2026-10-25T15:20:00+09:00"},
])
def test_route_endpoint_refuses_bad_input(client, params):
    assert client.get("/api/sun/route", params=params).status_code == 422


def test_presets_endpoint(client):
    res = client.get("/api/sun/presets")
    assert res.status_code == 200
    out = res.json()
    assert out["date"] == "2026-10-25"
    flights = {f["flight_no"]: f for f in out["flights"]}
    assert list(flights) == ["JL740", "JL754", "JL030"]
    for f in flights.values():
        assert FLIGHT_KEYS - {"track"} <= set(f) and WINDOW_KEYS <= set(f["chauvihar"])
        assert f["chauvihar"]["rule"] == DAYLIGHT_48
    assert flights["JL754"]["origin"] == "BLR" and flights["JL030"]["arr"] == "2026-10-26T06:30:00+09:00"
    assert flights["JL740"]["chauvihar"]["sunrise_box"] is False
    assert flights["JL740"]["chauvihar"]["may_eat_from"].startswith("2026-10-25T06:")
    assert flights["JL030"]["chauvihar"]["sunrise_box"] is True
    assert client.get("/api/sun/presets", params={"date": "2026-02-30"}).status_code == 422


def test_seats_are_empty_without_m17(client, monkeypatch):
    monkeypatch.setitem(sys.modules, f"{M17}.service", None)  # makes the import fail, as when m17 isn't merged
    res = client.get(f"/api/sun/seats/{FLIGHT_ID}")
    assert res.status_code == 200
    assert res.json() == {"flight_id": FLIGHT_ID, "seats": []}


def test_seats_use_m17_rules(client, reset, monkeypatch):
    rows = [
        {"seat": "31K", "passenger_id": "PX-0101", "rule": DAYLIGHT_48},
        {"seat": "18C", "passenger_id": "PX-0102", "rule": {**FAST, "after_sunrise_min": None}},
        {"seat": "40A", "passenger_id": "PX-0103", "rule": {"kind": "moonlight"}},  # malformed: skipped
        {"seat": "40C", "passenger_id": "PX-0104", "rule": {"kind": "daylight", "after_sunrise_min": "48"}},  # skipped
    ]
    package, module = types.ModuleType(M17), types.ModuleType(f"{M17}.service")
    module.daylight_rules = lambda _session, flight_id: rows if flight_id == FLIGHT_ID else []
    monkeypatch.setitem(sys.modules, M17, package)
    monkeypatch.setitem(sys.modules, f"{M17}.service", module)
    out = client.get(f"/api/sun/seats/{FLIGHT_ID}").json()
    assert [s["seat"] for s in out["seats"]] == ["18C", "31K"]
    fast, daylight = out["seats"]
    assert WINDOW_KEYS | {"seat", "passenger_id", "rule"} <= set(daylight)
    sunrise = service.sun_events(*JL740).sunrise.at
    assert datetime.fromisoformat(daylight["may_eat_from"]) == sunrise + timedelta(minutes=48)
    assert daylight["sunrise_box"] is False and fast["sunrise_box"] is True and fast["may_eat_from"] is None
