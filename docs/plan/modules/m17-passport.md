# m17: Dietary Passport + Calendar Radar

**Owner:** Gunagye (lane b, built in parallel) · **Branch:** `gunagye/m16-days` (v2 integration) · **Phase:** v2, 25 Oct 00:30–04:00 IST
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
A passenger describes their diet once, in their own words and language (typed or spoken), on the phone chat `/chat`. The rules turn it into food rules with strictness tiers (hard / firm / soft), time rules (fast dates, weekday vows, daylight-only eating) and a flex opt-in; the passenger confirms the card; the rules engine picks the main-menu dish to hold or the nearest JAL code + kitchen note. The passport belongs to the person, survives rebooking and asks the whole booking. The Calendar Radar checks each trip date against the time rules and asks one tap-to-answer question before the cutoff. Spec: `docs/plan/v2.md`.

## Owns
- `backend/app/modules/m17_passport/`, `backend/tests/test_m17_*.py`
- `frontend/src/modules/m17-passport/` (page `/chat`)
- additions to `shared/rules/calendar.json` (Purnima dates, weekday vows, Ramadan 2027)

## Provides
`Passport`, `service.rules_for / rules_on / plan_for / daylight_rules / cabin / rules_card` (Python), endpoints in `shared/api.md` (`## m17`).

## Done when
Priya types "pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon" on `/chat`, sees the chips, confirms, gets AVML + NO ONION NO GARLIC, and the Radar asks about 25 Oct (Sharad Purnima); "Yes" switches her JL740 meal before the cutoff and shows in the change log.

## Notes
- 25 Oct 00:40: spine on main: `Passport` table, `service.py`, seed (103 of 186 passengers known: 23 from special meals or cast profiles, 80 answered the T-48 h chat; Priya, Mehta and Swati have none), `GET /api/passport/cabin/{flight_id}`, `GET /api/passport/{passenger_id}`.
