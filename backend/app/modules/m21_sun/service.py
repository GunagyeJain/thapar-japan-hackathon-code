"""Sun events at the aircraft along a flight, and when a passenger with a sun-time rule may eat.

- track(): the aircraft's position, altitude and solar elevation every `step_s` seconds.
- sun_events(): every sunrise, sunset and dawn (-18°) the aircraft meets, with the sunrise line lowered by
  the horizon dip at the aircraft's altitude; the first sunrise is set against sunrise on the ground at the
  origin, on the same local date.
- eat_window(): the first time on board a rule allows eating. When none of it falls in the cabin service
  (after the climb, before the descent), the passenger gets a sealed Sunrise Box at the door instead.
- daylight_seats(): the passengers on a flight with a sun-time rule (from m17's passport), with their window.
"""
import logging
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, tzinfo
from functools import lru_cache
from itertools import pairwise
from typing import Any

from sqlmodel import Session

from app.core.models import Flight, Text
from app.modules.m21_sun import solar
from app.modules.m21_sun.route import CRUISE_ALT_M, Airport, Route, airport

log = logging.getLogger(__name__)

STEP_S = 30
MIN_STEP_S, MAX_STEP_S = 5, 600
MAX_FLIGHT = timedelta(hours=20)
CHART_EVERY = timedelta(minutes=5)
GROUND_STEP = timedelta(minutes=10)
PRECISION = timedelta(seconds=1)
MINUTE = timedelta(minutes=1)
MAX_WAIT_MIN = 180

SUNRISE, SUNSET, DAWN = "sunrise", "sunset", "dawn"
DAYLIGHT, FAST = "daylight", "fast_dawn_to_sunset"
RULE_KINDS = (DAYLIGHT, FAST)
CHAUVIHAR = {"kind": DAYLIGHT, "after_sunrise_min": 48}  # no food or water before sunrise + 48 min (navkarsi)

# Published India → Japan departures: (flight, from, to, departs, arrives, days later).
PRESET_DATE = "2026-10-25"
PRESETS = (
    ("JL740", "DEL", "NRT", time(4, 35), time(15, 20), 0),
    ("JL754", "BLR", "NRT", time(2, 55), time(14, 0), 0),
    ("JL030", "DEL", "HND", time(19, 55), time(6, 30), 1),
)

NOTES: dict[str, Text] = {
    "after_sunrise": {"en": "Serve from {min} min after sunrise at the aircraft.",
                      "hi": "विमान पर सूर्योदय के {min} मिनट बाद से परोसें।",
                      "ja": "機上の日の出から{min}分後に提供。"},
    "at_sunrise": {"en": "Serve from sunrise at the aircraft.", "hi": "विमान पर सूर्योदय से परोसें।",
                   "ja": "機上の日の出から提供。"},
    "sun_up": {"en": "Sun is up at departure: serve as usual.", "hi": "प्रस्थान के समय सूरज निकला है: सामान्य रूप से परोसें।",
               "ja": "出発時に日が出ています。通常どおり提供。"},
    "after_sunset": {"en": "Serve after sunset at the aircraft.", "hi": "विमान पर सूर्यास्त के बाद परोसें।",
                     "ja": "機上の日没後に提供。"},
    "night": {"en": "Dark at departure: serve as usual.", "hi": "प्रस्थान के समय अँधेरा है: सामान्य रूप से परोसें।",
              "ja": "出発時は夜です。通常どおり提供。"},
    "until_sunset": {"en": "Last serve before sunset at the aircraft.",
                     "hi": "विमान पर सूर्यास्त से पहले तक परोसें।", "ja": "機上の日没までに提供。"},
    "until_dawn": {"en": "Last serve before dawn at the aircraft.", "hi": "विमान पर भोर से पहले तक परोसें।",
                   "ja": "機上の夜明けまでに提供。"},
    "box": {"en": "No eating time on board before the descent: sealed Sunrise Box at the door.",
            "hi": "उतरने से पहले खाने का समय नहीं: दरवाज़े पर सीलबंद सनराइज़ बॉक्स दें।",
            "ja": "降下開始までに食事できる時間がありません。搭乗口で密封のサンライズボックスをお渡しください。"},
}
NOTE_SEP = {"en": " ", "hi": " ", "ja": ""}


class RouteError(ValueError):
    """A route the sun can't be computed for: unknown airport, arrival before departure, too long."""


@dataclass(frozen=True)
class Sample:
    at: datetime
    lat: float
    lon: float
    alt_m: float
    elev_deg: float

    @property
    def above_sunrise(self) -> float:
        return self.elev_deg - solar.sunrise_threshold(self.alt_m)

    @property
    def above_dawn(self) -> float:
        return self.elev_deg - solar.FAJR_DEG


@dataclass(frozen=True)
class Crossing:
    kind: str  # sunrise | sunset | dawn
    at: datetime
    lat: float
    lon: float
    alt_m: float


@dataclass(frozen=True)
class SunEvents:
    route: Route
    samples: tuple[Sample, ...]
    crossings: tuple[Crossing, ...]  # at the aircraft, in time order
    sun_up_at_dep: bool  # sun above the sunrise line at the origin when the flight leaves
    fasting_at_dep: bool  # between dawn and sunset when the flight leaves
    sunrise_before_dep: datetime | None  # that morning's sunrise at the origin, when the sun is up at departure
    origin_sunrise: datetime | None  # ground sunrise at the origin on the local date of the first sunrise on board
    minutes_earlier: int | None  # origin_sunrise minus the first sunrise at the aircraft

    def first(self, kind: str) -> Crossing | None:
        return next((c for c in self.crossings if c.kind == kind), None)

    @property
    def sunrise(self) -> Crossing | None:
        return self.first(SUNRISE)

    @property
    def sunset(self) -> Crossing | None:
        return self.first(SUNSET)

    @property
    def fajr(self) -> Crossing | None:
        return self.first(DAWN)


def make_route(origin: str, dest: str, dep: datetime, arr: datetime) -> Route:
    try:
        route = Route(airport(origin), airport(dest), dep, arr)
    except ValueError as err:
        raise RouteError(str(err)) from None
    if route.duration > MAX_FLIGHT:
        raise RouteError(f"Flights up to {MAX_FLIGHT.total_seconds() / 3600:.0f} h only")
    return route


def _round_minute(at: datetime) -> datetime:
    return (at + timedelta(seconds=30)).replace(second=0, microsecond=0)


def _whole_minutes(span: timedelta) -> int:
    return round(span.total_seconds() / 60)


def _root(f: Callable[[datetime], float], lo: datetime, hi: datetime) -> datetime:
    """Where f changes sign between lo and hi, by bisection down to PRECISION."""
    lo_up = f(lo) >= 0
    while hi - lo > PRECISION:
        mid = lo + (hi - lo) / 2
        if (f(mid) >= 0) == lo_up:
            lo = mid
        else:
            hi = mid
    return hi


def _instants(route: Route, step: timedelta) -> Iterator[datetime]:
    at = route.dep
    while at < route.arr:
        yield at
        at += step
    yield route.arr


def _sample(route: Route, at: datetime) -> Sample:
    lat, lon, alt = route.position(at)
    return Sample(at, lat, lon, alt, solar.elevation(at, lat, lon))


def _track(route: Route, step_s: int) -> list[Sample]:
    if not MIN_STEP_S <= step_s <= MAX_STEP_S:
        raise RouteError(f"step_s must be between {MIN_STEP_S} and {MAX_STEP_S}")
    return [_sample(route, at) for at in _instants(route, timedelta(seconds=step_s))]


def track(origin: str, dest: str, dep_utc: datetime, arr_utc: datetime, step_s: int = STEP_S) -> list[Sample]:
    """The aircraft every `step_s` seconds from departure to arrival: (at, lat, lon, alt_m, elev_deg)."""
    return _track(make_route(origin, dest, dep_utc, arr_utc), step_s)


def _margin(route: Route, threshold: Callable[[float], float]) -> Callable[[datetime], float]:
    def above(at: datetime) -> float:
        lat, lon, alt = route.position(at)
        return solar.elevation(at, lat, lon) - threshold(alt)

    return above


def _aircraft_crossings(route: Route, samples: list[Sample]) -> list[Crossing]:
    lines = (
        (SUNRISE, SUNSET, lambda s: s.above_sunrise, _margin(route, solar.sunrise_threshold)),
        (DAWN, None, lambda s: s.above_dawn, _margin(route, lambda _alt: solar.FAJR_DEG)),
    )
    found: list[Crossing] = []
    for up, down, sampled, exact in lines:
        for a, b in pairwise(samples):
            before, after = sampled(a), sampled(b)
            kind = up if before < 0 <= after else down if before >= 0 > after else None
            if kind is None:
                continue
            at = _round_minute(_root(exact, a.at, b.at))
            found.append(Crossing(kind, at, *route.position(at)))
    return sorted(found, key=lambda c: c.at)


def ground_event(place: Airport, day: date, threshold: float, rising: bool) -> datetime | None:
    """When the sun crosses `threshold` (upwards if `rising`) on the ground at `place` on its local `day`."""
    def above(at: datetime) -> float:
        return solar.elevation(at, place.lat, place.lon) - threshold

    lo = datetime.combine(day, time(0), place.tz)
    end, f_lo = lo + timedelta(days=1), above(lo)
    while lo < end:
        hi = min(lo + GROUND_STEP, end)
        f_hi = above(hi)
        if (rising and f_lo < 0 <= f_hi) or (not rising and f_lo >= 0 > f_hi):
            return _round_minute(_root(above, lo, hi))
        lo, f_lo = hi, f_hi
    return None


@lru_cache(maxsize=64)
def sun_events(origin: str, dest: str, dep: datetime, arr: datetime, step_s: int = STEP_S) -> SunEvents:
    route = make_route(origin, dest, dep, arr)
    samples = _track(route, step_s)
    crossings = _aircraft_crossings(route, samples)
    place = route.origin
    elev_dep = solar.elevation(dep, place.lat, place.lon)
    sun_up = elev_dep >= solar.SUNRISE_DEG
    rising = solar.elevation(dep + MINUTE, place.lat, place.lon) > elev_dep
    first_rise = next((c for c in crossings if c.kind == SUNRISE), None)
    day = (first_rise.at if first_rise else dep).astimezone(place.tz).date()
    origin_sunrise = ground_event(place, day, solar.SUNRISE_DEG, rising=True)
    return SunEvents(
        route=route,
        samples=tuple(samples),
        crossings=tuple(crossings),
        sun_up_at_dep=sun_up,
        fasting_at_dep=sun_up or (elev_dep >= solar.FAJR_DEG and rising),
        sunrise_before_dep=ground_event(place, dep.astimezone(place.tz).date(), solar.SUNRISE_DEG, rising=True)
        if sun_up else None,
        origin_sunrise=origin_sunrise,
        minutes_earlier=_whole_minutes(origin_sunrise - first_rise.at) if first_rise and origin_sunrise else None,
    )


# ---------------------------------------------------------------- when a rule allows eating on board

@dataclass(frozen=True)
class Window:
    start: datetime
    end: datetime
    opened_by: str  # sunrise | dep | sunset
    closed_by: str  # sunset | dawn | arr


def _wait(rule: Mapping[str, Any]) -> timedelta:
    minutes = rule.get("after_sunrise_min", 0)
    if not isinstance(minutes, int) or isinstance(minutes, bool) or not 0 <= minutes <= MAX_WAIT_MIN:
        raise ValueError(f"after_sunrise_min must be a whole number from 0 to {MAX_WAIT_MIN}")
    return timedelta(minutes=minutes)


def _daylight_windows(ev: SunEvents, wait: timedelta) -> list[Window]:
    """Eating allowed from sunrise + wait until sunset."""
    dep, arr = ev.route.dep, ev.route.arr
    windows: list[Window] = []
    risen: tuple[datetime, str] | None = None
    if ev.sun_up_at_dep:
        risen = (ev.sunrise_before_dep or dep, "dep")
    for c in ev.crossings:
        if c.kind == SUNRISE and risen is None:
            risen = (c.at, SUNRISE)
        elif c.kind == SUNSET and risen is not None:
            start = max(dep, risen[0] + wait)
            if start < c.at:
                windows.append(Window(start, c.at, risen[1], SUNSET))
            risen = None
    if risen is not None and max(dep, risen[0] + wait) < arr:
        windows.append(Window(max(dep, risen[0] + wait), arr, risen[1], "arr"))
    return windows


def _fasting_windows(ev: SunEvents) -> list[Window]:
    """Fasting from dawn to sunset: eating allowed from sunset until the next dawn."""
    windows: list[Window] = []
    opened: tuple[datetime, str] | None = None if ev.fasting_at_dep else (ev.route.dep, "dep")
    for c in ev.crossings:
        if c.kind == SUNSET and opened is None:
            opened = (c.at, SUNSET)
        elif c.kind == DAWN and opened is not None:
            if opened[0] < c.at:
                windows.append(Window(opened[0], c.at, opened[1], DAWN))
            opened = None
    if opened is not None:
        windows.append(Window(opened[0], ev.route.arr, opened[1], "arr"))
    return windows


def _note(keys: list[str], minutes: int) -> Text:
    return {lang: sep.join(NOTES[k][lang] for k in keys).replace("{min}", str(minutes)) for lang, sep in NOTE_SEP.items()}


def _window_note(w: Window, kind: str, wait: timedelta, dep: datetime) -> Text:
    wait_min = _whole_minutes(wait)
    if kind == FAST:
        first = "after_sunset" if w.opened_by == SUNSET else "night"
    elif w.opened_by == "dep" and w.start == dep:
        first = "sun_up"
    else:
        first = "after_sunrise" if wait_min else "at_sunrise"
    last = {SUNSET: ["until_sunset"], DAWN: ["until_dawn"]}.get(w.closed_by, [])
    return _note([first, *last], wait_min)


def eat_window(events: SunEvents, rule: Mapping[str, Any]) -> dict[str, Any]:
    """{may_eat_from, may_eat_until, sunrise_box, note} for one rule on this flight (times are datetimes).

    rule: {"kind": "daylight", "after_sunrise_min": 48} or {"kind": "fast_dawn_to_sunset"}.
    may_eat_until is None when the window lasts to arrival. sunrise_box is True when no eating time falls
    in the cabin service (after the climb, before the descent).
    """
    kind = rule.get("kind")
    if kind not in RULE_KINDS:
        raise ValueError(f"Unknown sun-time rule {kind!r}: use one of {', '.join(RULE_KINDS)}")
    wait = _wait(rule) if kind == DAYLIGHT else timedelta(0)
    windows = _daylight_windows(events, wait) if kind == DAYLIGHT else _fasting_windows(events)
    serve_from, serve_until = events.route.cruise
    for w in windows:
        if min(w.end, serve_until) > max(w.start, serve_from):
            return {"may_eat_from": w.start, "may_eat_until": None if w.closed_by == "arr" else w.end,
                    "sunrise_box": False, "note": _window_note(w, kind, wait, events.route.dep)}
    return {"may_eat_from": None, "may_eat_until": None, "sunrise_box": True, "note": _note(["box"], 0)}


# ---------------------------------------------------------------- JSON for the endpoints

def iso(at: datetime | None, tz: tzinfo) -> str | None:
    return None if at is None else at.astimezone(tz).isoformat(timespec="seconds")


def _window_json(window: dict[str, Any], tz: tzinfo) -> dict[str, Any]:
    return {**window, "may_eat_from": iso(window["may_eat_from"], tz), "may_eat_until": iso(window["may_eat_until"], tz)}


def _event_json(c: Crossing | None, place: Airport, threshold: float, rising: bool) -> dict[str, Any] | None:
    if c is None:
        return None
    on_ground = ground_event(place, c.at.astimezone(place.tz).date(), threshold, rising)
    return {
        "at_aircraft": iso(c.at, place.tz),
        "at_origin": iso(on_ground, place.tz),
        "minutes_earlier": _whole_minutes(on_ground - c.at) if on_ground else None,
        "lat": round(c.lat, 3),
        "lon": round(c.lon, 3),
        "alt_m": round(c.alt_m),
    }


def _chart(ev: SunEvents) -> list[dict[str, Any]]:
    """Every CHART_EVERY from departure, plus arrival."""
    place, dep = ev.route.origin, ev.route.dep
    points = [s for s in ev.samples if (s.at - dep) % CHART_EVERY == timedelta(0) or s.at == ev.route.arr]
    return [
        {"at": iso(s.at, place.tz), "lat": round(s.lat, 3), "lon": round(s.lon, 3), "alt_m": round(s.alt_m),
         "elev": round(s.elev_deg, 2), "elev_origin": round(solar.elevation(s.at, place.lat, place.lon), 2)}
        for s in points
    ]


def summary(origin: str, dest: str, dep: datetime, arr: datetime, *, with_track: bool = True,
            flight_id: str | None = None, flight_no: str | None = None) -> dict[str, Any]:
    """The /api/sun/flight and /api/sun/route shape (and, without the track, one row of /api/sun/presets)."""
    ev = sun_events(origin, dest, dep, arr)
    place = ev.route.origin
    chauvihar = {"rule": CHAUVIHAR, **_window_json(eat_window(ev, CHAUVIHAR), place.tz)}
    out: dict[str, Any] = {
        "flight_id": flight_id,
        "flight_no": flight_no,
        "origin": place.code,
        "dest": ev.route.dest.code,
        "dep": iso(dep, place.tz),
        "arr": iso(arr, ev.route.dest.tz),
        "threshold_cruise": round(solar.sunrise_threshold(CRUISE_ALT_M), 2),
        "sunrise": _event_json(ev.sunrise, place, solar.SUNRISE_DEG, rising=True),
        "sunset": _event_json(ev.sunset, place, solar.SUNRISE_DEG, rising=False),
        "fajr": _event_json(ev.fajr, place, solar.FAJR_DEG, rising=True),
        "chauvihar": chauvihar,
    }
    return {**out, "track": _chart(ev)} if with_track else out


def flight_times(flight: Flight) -> tuple[datetime, datetime]:
    """Scheduled times moved by any delay m4 has recorded."""
    late = timedelta(minutes=flight.delay_min or 0)
    return flight.std + late, flight.sta + late


def presets(day: date) -> list[dict[str, Any]]:
    rows = []
    for flight_no, origin, dest, departs, arrives, days_later in PRESETS:
        dep = datetime.combine(day, departs, airport(origin).tz)
        arr = datetime.combine(day + timedelta(days=days_later), arrives, airport(dest).tz)
        rows.append(summary(origin, dest, dep, arr, with_track=False, flight_no=flight_no))
    return rows


# ---------------------------------------------------------------- passengers with a sun-time rule (m17)

def _valid_rule(row: Any) -> bool:
    if not isinstance(row, Mapping) or not isinstance(row.get("seat"), str) or not isinstance(row.get("passenger_id"), str):
        return False
    rule = row.get("rule")
    if not isinstance(rule, Mapping) or rule.get("kind") not in RULE_KINDS:
        return False
    if rule["kind"] == DAYLIGHT:  # the wait only matters for the daylight rule
        try:
            _wait(rule)
        except ValueError:
            return False
    return True


def _m17_rules(session: Session, flight_id: str) -> list[Mapping[str, Any]]:
    try:
        from app.modules.m17_passport.service import daylight_rules
    except ImportError:
        return []  # m17 isn't on this branch yet: nobody has a sun-time rule
    try:
        rows = daylight_rules(session, flight_id)
    except Exception:  # m17 is built in parallel: its failure must not take this page down
        log.exception("m17 daylight_rules failed for %s", flight_id)
        return []
    good = [r for r in rows if _valid_rule(r)]
    if len(good) != len(rows):
        log.warning("m21: skipped %d malformed sun-time rules from m17 for %s", len(rows) - len(good), flight_id)
    return good


def _seat_order(seat: str) -> tuple[int, str]:
    row = "".join(ch for ch in seat if ch.isdigit())
    return (int(row) if row else 0, seat)


def daylight_seats(session: Session, flight_id: str) -> list[dict[str, Any]]:
    """[{seat, passenger_id, rule, may_eat_from, may_eat_until, sunrise_box, note}] for one flight, by seat."""
    flight = session.get(Flight, flight_id)
    rules = _m17_rules(session, flight_id) if flight else []
    if not flight or not rules:
        return []
    dep, arr = flight_times(flight)
    events = sun_events(flight.origin, flight.dest, dep, arr)
    tz = events.route.origin.tz
    rows = [{"seat": r["seat"], "passenger_id": r["passenger_id"], "rule": dict(r["rule"]),
             **_window_json(eat_window(events, r["rule"]), tz)} for r in rules]
    return sorted(rows, key=lambda r: _seat_order(r["seat"]))
