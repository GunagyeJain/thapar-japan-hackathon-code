"""Where the sun is in the sky, for any moment and place (NOAA solar position algorithm).

Pure functions, standard library only. The formulas are NOAA's "General Solar Position Calculations"
(declination, equation of time, hour angle), the same ones as NOAA's solar calculator spreadsheet:
about a minute of accuracy for sunrise and sunset between 72°N and 72°S.

Elevation here is geometric (no refraction). Sunrise and sunset are the moments the sun's centre
crosses -0.833°: 34' of refraction plus half the sun's disc. Above the ground the horizon drops by
the dip, so the sun comes up earlier: threshold = -0.833° - 1.76'·√h (h in metres).
"""
from datetime import datetime, timezone
from math import asin, cos, degrees, radians, sin, sqrt, tan

J2000 = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)  # Julian day 2451545.0
DAYS_PER_CENTURY = 36525
MINUTES_PER_DAY = 1440

SUNRISE_DEG = -0.833  # sun's centre at sunrise and sunset on the ground
FAJR_DEG = -18.0  # dawn (astronomical twilight): suhoor ends
DIP_ARCMIN_PER_SQRT_M = 1.76  # horizon dip with standard terrestrial refraction


def julian_century(at: datetime) -> float:
    """Julian centuries since J2000.0 (UT; the ~1 min difference to TT is below this method's accuracy)."""
    if at.tzinfo is None:
        raise ValueError("time must carry an offset, e.g. 2026-10-25T04:35:00+05:30")
    return (at - J2000).total_seconds() / 86400 / DAYS_PER_CENTURY


def declination_and_eot(at: datetime) -> tuple[float, float]:
    """The sun's declination (degrees) and the equation of time (minutes) at `at`."""
    t = julian_century(at)
    mean_long = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
    mean_anom = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    ecc = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    m = radians(mean_anom)
    centre = sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin(2 * m) * (0.019993 - 0.000101 * t) \
        + sin(3 * m) * 0.000289
    omega = radians(125.04 - 1934.136 * t)
    app_long = radians(mean_long + centre - 0.00569 - 0.00478 * sin(omega))
    mean_obliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    obliq = radians(mean_obliq + 0.00256 * cos(omega))
    decl = degrees(asin(sin(obliq) * sin(app_long)))

    y = tan(obliq / 2) ** 2
    l0 = radians(mean_long)
    eot = 4 * degrees(
        y * sin(2 * l0) - 2 * ecc * sin(m) + 4 * ecc * y * sin(m) * cos(2 * l0)
        - 0.5 * y * y * sin(4 * l0) - 1.25 * ecc * ecc * sin(2 * m)
    )
    return decl, eot


def elevation(at: datetime, lat: float, lon: float) -> float:
    """Geometric solar elevation in degrees at `at` for latitude/longitude in degrees (east positive)."""
    decl, eot = declination_and_eot(at)
    utc = at.astimezone(timezone.utc)
    minutes = utc.hour * 60 + utc.minute + (utc.second + utc.microsecond / 1e6) / 60
    true_solar = (minutes + eot + 4 * lon) % MINUTES_PER_DAY
    hour_angle = radians(true_solar / 4 - 180)
    phi, d = radians(lat), radians(decl)
    sin_elev = sin(phi) * sin(d) + cos(phi) * cos(d) * cos(hour_angle)
    return degrees(asin(max(-1.0, min(1.0, sin_elev))))


def dip_deg(alt_m: float) -> float:
    """How far the horizon drops below level for an observer `alt_m` metres up."""
    return DIP_ARCMIN_PER_SQRT_M * sqrt(max(alt_m, 0.0)) / 60


def sunrise_threshold(alt_m: float) -> float:
    """Elevation of the sun's centre at sunrise or sunset for an observer `alt_m` metres up."""
    return SUNRISE_DEG - dip_deg(alt_m)
