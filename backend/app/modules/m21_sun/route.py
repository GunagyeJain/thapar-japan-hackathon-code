"""Where the aircraft is: on the great circle between two airports, with a simple altitude profile.

Progress along the great circle is linear in time from departure to arrival. Altitude climbs linearly
to cruise in the first 25 minutes, holds, and comes down to the ground in the last 30 minutes.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import acos, atan2, cos, degrees, radians, sin, sqrt

IST = timezone(timedelta(hours=5, minutes=30), "IST")
JST = timezone(timedelta(hours=9), "JST")

CRUISE_ALT_M = 11_000.0
CLIMB = timedelta(minutes=25)
DESCENT = timedelta(minutes=30)
EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True)
class Airport:
    code: str
    lat: float
    lon: float
    tz: timezone


AIRPORTS: dict[str, Airport] = {
    a.code: a
    for a in (
        Airport("DEL", 28.5562, 77.1000, IST),
        Airport("BLR", 13.1986, 77.7066, IST),
        Airport("NRT", 35.7720, 140.3929, JST),
        Airport("HND", 35.5494, 139.7798, JST),
    )
}


def airport(code: str) -> Airport:
    found = AIRPORTS.get(code.strip().upper())
    if found is None:
        raise ValueError(f"Unknown airport {code!r}: use one of {', '.join(AIRPORTS)}")
    return found


def _unit(lat: float, lon: float) -> tuple[float, float, float]:
    phi, lam = radians(lat), radians(lon)
    return cos(phi) * cos(lam), cos(phi) * sin(lam), sin(phi)


def central_angle(a: Airport, b: Airport) -> float:
    """Angle between two airports seen from the Earth's centre, in radians."""
    dot = sum(p * q for p, q in zip(_unit(a.lat, a.lon), _unit(b.lat, b.lon), strict=True))
    return acos(max(-1.0, min(1.0, dot)))


def distance_km(a: Airport, b: Airport) -> float:
    return EARTH_RADIUS_KM * central_angle(a, b)


def great_circle_point(a: Airport, b: Airport, fraction: float) -> tuple[float, float]:
    """(lat, lon) a `fraction` of the way from a to b along the great circle (spherical interpolation)."""
    angle = central_angle(a, b)
    if angle < 1e-12:
        return a.lat, a.lon
    ka, kb = sin((1 - fraction) * angle) / sin(angle), sin(fraction * angle) / sin(angle)
    x, y, z = (ka * p + kb * q for p, q in zip(_unit(a.lat, a.lon), _unit(b.lat, b.lon), strict=True))
    return degrees(atan2(z, sqrt(x * x + y * y))), degrees(atan2(y, x))


def altitude_m(elapsed: timedelta, total: timedelta) -> float:
    """Climb to cruise in CLIMB, hold, come down in DESCENT (a short hop never reaches cruise)."""
    climbing = CRUISE_ALT_M * (elapsed / CLIMB)
    descending = CRUISE_ALT_M * ((total - elapsed) / DESCENT)
    return max(0.0, min(CRUISE_ALT_M, climbing, descending))


@dataclass(frozen=True)
class Route:
    origin: Airport
    dest: Airport
    dep: datetime
    arr: datetime

    def __post_init__(self) -> None:
        if self.dep.tzinfo is None or self.arr.tzinfo is None:
            raise ValueError("departure and arrival must carry an offset")
        if self.arr <= self.dep:
            raise ValueError("arrival must be after departure")
        if self.origin == self.dest:
            raise ValueError("origin and destination must differ")

    @property
    def duration(self) -> timedelta:
        return self.arr - self.dep

    @property
    def cruise(self) -> tuple[datetime, datetime]:
        """The part of the flight where the cabin can serve: after the climb, before the descent."""
        return self.dep + CLIMB, self.arr - DESCENT

    def position(self, at: datetime) -> tuple[float, float, float]:
        """(lat, lon, alt_m) at `at`, clamped to the flight's own time span."""
        elapsed = min(max(at - self.dep, timedelta(0)), self.duration)
        lat, lon = great_circle_point(self.origin, self.dest, elapsed / self.duration)
        return lat, lon, altitude_m(elapsed, self.duration)
