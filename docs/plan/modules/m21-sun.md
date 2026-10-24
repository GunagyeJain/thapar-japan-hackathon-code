# m21: sun at the aircraft

**Owner:** Gunagye · **Branch:** `gunagye/m21-sun` · **Phase:** late add, 25 Oct before the 11:00 final
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Some passengers eat by the sun. Many who keep chauvihar eat and drink nothing between sunset and sunrise, and wait a further 48 minutes after sunrise (navkarsi). Those fasting in Ramadan eat before dawn and break the fast at sunset. A meal code can't carry a time, and the Delhi clock gives the wrong one: flying east at cruise height, the aircraft meets the sunrise much earlier than Delhi does.

m21 works out the sun at the aircraft's real position and altitude along the route:
- When the sun rises, sets and dawn breaks at the aircraft, next to the same moment on the ground at the origin.
- For each passenger with a sun-time rule, the first time on board they may eat, so crew hold the tray until then.
- When none of that time falls in the cabin service, a sealed **Sunrise Box** at the door instead of a meal on board.

Demo moment: JL740 leaves Delhi at 04:35 IST in the dark. At 11,000 m over 31.7°N 85.8°E the sun rises at 05:42 IST, 46 minutes before Delhi's 06:28, so a passenger who waits 48 minutes after sunrise may eat from 06:30 IST, not 07:16. The overnight JL030 to Haneda gets a Sunrise Box.

## Owns
- `backend/app/modules/m21_sun/` (`solar.py`, `route.py`, `service.py`, `router.py`, no-op `seed.py`), `backend/tests/test_m21_sun.py`
- `frontend/src/modules/m21-sun/` (`/ops/sun`, `SunChart`, `SunTimer`, `api.ts`, `format.ts`, `i18n.ts`, `types.ts`, `sun.test.ts`)
- One line each in `backend/app/registry.py`, `frontend/src/app/routes.tsx`, `frontend/src/app/nav.ts`; the m21 section of `shared/api.md` (shared zone, add-only)

## Uses (contracts it reads)
- **m0:** core `Flight` (`std`, `sta`, `origin`, `dest`, `delay_min`), the sim clock (`useSimClock`) for the countdown.
- **m4:** `Flight.delay_min`, set by the `delay` booking event: the sun moves with the delayed departure.
- **m17:** `daylight_rules(session, flight_id) -> [{seat, passenger_id, rule: {kind, after_sunrise_min}}]`, imported inside a try/except ImportError (built in parallel). Without it the seats list is empty.
- **m2:** `@/ui` components and the chart tokens only.

## Provides (what others rely on)
- **Endpoints** (rows in `shared/api.md` under `## m21 · sun at the aircraft`): `GET /api/sun/flight/{id}`, `GET /api/sun/route`, `GET /api/sun/presets`, `GET /api/sun/seats/{id}`.
- **Python:** `service.sun_events(origin, dest, dep, arr)`, `service.eat_window(events, rule)`, `service.daylight_seats(session, flight_id)`, `service.track(...)`; `solar.elevation(at, lat, lon)`.
- **Front end:** `SunTimer` `{mayEatFrom, sunriseBox, lang, size}` for the crew tablet and the passenger phone ("Eat from 06:30 IST · in 1 h 09 m", "May eat now", or "Sunrise Box at the door"), and `useSunSeats(flightId)` (30 s refetch), both from `@/modules/m21-sun`.

## Tasks
- [x] **T1 Sun and route (40 min).** NOAA solar position (declination, equation of time, hour angle); horizon dip 1.76′·√h; great-circle route with the climb, cruise and descent profile.

  _Done when:_ ground sunrise matches published times for Delhi, Tokyo and Bengaluru within 2 minutes.
- [x] **T2 Events, eating windows, endpoints (50 min).** Crossings found on a 30 s track and refined by bisection; daylight and dawn-to-sunset windows; Sunrise Box; the four endpoints; m17 hook.

  _Done when:_ JL740's sunrise at the aircraft is before Delhi's, a night flight gets a Sunrise Box, and the endpoints return the documented keys (pytest).
- [x] **T3 Screens (45 min).** `/ops/sun`: KPIs, the sun chart with both sunrises marked, the three published departures, JL740's seats with a sun-time rule; `SunTimer` and `useSunSeats` exported; EN/HI/JA.

  _Done when:_ the page shows real numbers at 1440 px in all three languages, and `SunTimer` counts down on the sim clock.
- [x] **T4 Contract and checks (15 min).** `shared/api.md` rows, this file, `scripts/check.sh`.

## Done when
`/ops/sun` shows that the sun rises over JL740 46 minutes before it rises in Delhi, when a passenger who waits 48 minutes after sunrise may eat (06:30 IST), and that JL030 needs a Sunrise Box; `SunTimer` is ready for the crew tablet and the passenger phone; `scripts/check.sh` passes.

## Notes
_Owner's running notes._
- **Method.** NOAA "General Solar Position Calculations" (same formulas as NOAA's solar calculator spreadsheet), geometric elevation. Sunrise or sunset when the sun's centre crosses −0.833° − dip, dip = 1.76′·√(height in m) (3.08° at 11,000 m, so the line is −3.91°). Dawn (fajr) at −18°, no height correction. Route: great circle between DEL 28.5562, 77.1000 · BLR 13.1986, 77.7066 · NRT 35.7720, 140.3929 · HND 35.5494, 139.7798, progress linear in time; climb to 11,000 m in the first 25 min, descend in the last 30. Crossings come from a 30 s track and are bisected to a second on the continuous route, then rounded to the minute (the method is good to about a minute).
- **Choices.** The ground sunrise we compare with is on the local date of the sunrise at the aircraft (the departure date for the morning flights; for overnight JL030 it's the next morning, otherwise "minutes earlier" makes no sense). A Sunrise Box means no allowed time inside the cabin service (after the climb, before the descent), not just between departure and arrival: an allowed stretch that starts during the descent is no use to crew. A delay recorded by m4 moves both times. `/api/sun/flight` also carries the +48 min result (`chauvihar`), so the page follows a delayed flight rather than the timetable.
- **Verified.** Ground sunrise vs sunrise-sunset.org: New Delhi 25 Oct 2026 06:28:02 IST (we get 06:28), Tokyo 26 Oct 05:56:47 JST (05:57), Bengaluru 25 Oct 06:11:28 IST (06:11); DEL airport 06:28 IST. These are pytest cases.
- **Numbers on 25 Oct 2026.** JL740: sunrise at the aircraft 05:42 IST at 31.7°N 85.8°E, 11,000 m; Delhi 06:28 IST; 46 min earlier; +48 min rule eats from 06:30 IST; dawn at the aircraft 04:58 IST during the climb (Delhi 05:09), so a dawn-to-sunset fast gets a sealed box (sunset comes after landing). JL754: 05:05 IST at the aircraft vs 06:11 in Bengaluru (66 min), eats from 05:53 IST. JL030: the sun rises over the aircraft at 06:00 JST (02:30 IST), right at the top of descent, 3 h 59 m before Delhi's sunrise: Sunrise Box for the daylight rule; a dawn-to-sunset fast may eat from departure until dawn at the aircraft, 05:16 JST.
- **Checked on screen** (own server on :8305): `/ops/sun` at 1440 and 1024 px in EN, HI and JA; chart tooltip; the "Now" line on the sim clock; `SunTimer` before and after 06:30 with a local m17 stub (not committed): 2A "Eat from 05:42 IST", 31K "Eat from 06:30 IST · in 1 h 09 m" then "May eat now", 18C "Sunrise Box at the door".
- **Chart.** Recharts isn't a frontend dependency and nothing was installed, so the chart is SVG drawn with the chart rules (series in `--blue`, `--sky`, `--grey`; 12 px axis labels in grey), as m6's forecast bars are.
- **Labels name the rule, never the person:** "Daylight only, +48 min", "Fasts dawn to sunset".
- **Not built:** real flight tracks and winds (the great circle is close for DEL→NRT but not exact); refraction thinner at altitude beyond what the dip formula carries; airports other than DEL, BLR, NRT, HND; the seat card on the crew tablet and the passenger phone line (m8 and m3 can drop in `SunTimer` with `useSunSeats`).
