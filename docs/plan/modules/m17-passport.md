# m17: Dietary Passport + Calendar Radar

**Owner:** Gunagye (lane b, built in parallel) · **Branch:** `gunagye/m16-days` (v2 integration) · **Phase:** v2, 25 Oct 00:30–04:00 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
A passenger describes their diet once, in their own words and language (typed or spoken), on the phone chat `/chat`. The rules turn it into food rules with strictness tiers (hard / firm / soft), time rules (fast dates, weekday vows, daylight-only eating) and a flex opt-in; the passenger confirms the card; the rules engine picks the main-menu dish to hold or the nearest JAL code + kitchen note. The passport belongs to the person, survives rebooking and asks the whole booking. The Calendar Radar checks each trip date against the time rules and asks one tap-to-answer question before the cutoff. Spec: `docs/plan/v2.md`.

## Owns
- `backend/app/modules/m17_passport/`, `backend/tests/test_m17_*.py`
- `frontend/src/modules/m17-passport/` (page `/chat`)
- additions to `shared/rules/calendar.json` (Purnima dates, weekday vows, Ramadan 2027)

## Provides
`Passport`, `RadarQuestion`, `service.rules_for / rules_on / plan_for / daylight_rules / cabin / rules_card / save / write_meal` (Python), endpoints in `shared/api.md` (`## m17`).

## Tasks
- [x] Spine: `Passport` table, `service.py`, seed (103 of 186 known), cabin and passport endpoints
- [x] Dictionary reader `words.py`: English, Hinglish, Hindi, Japanese (+ a few Tamil and Gujarati words); diet words → m1 presets, foods, negation / "chalega" / allergy markers, soft wording, flex, Purnima / Ekadashi / Navratri / weekday / chauvihar / sunset / Ramadan time rules; unknown words → `unclear`
- [x] `POST /api/passport/understand` (`understand.py`): presets refined by single foods ("veg, but egg chalega"), tiers, chips with `via`; the extraction model (`model.py`, only with `GEMINI_API_KEY`) may add tags; stores nothing
- [x] `POST /api/passport` + `GET /api/passport/booking/{id}`: validated rules, labels stripped, the special meal through m3's `_save` (Profile, MealPromise, C1), Radar runs right after
- [x] `service.rules_on`: `confirm: true` date rules apply only on confirmed dates; declined dates never
- [x] Calendar Radar (`radar.py`): `POST /api/radar/scan`, `POST /api/radar/answer`; questions phrased from the public calendar; Yes before the cutoff reorders the meal, after it goes to m18's `submit_change`
- [x] `calendar.json`: `purnima` (Drik Panchang, New Delhi, Oct 2026 – Dec 2027) and `ramadan` (expected 2027 dates, moon-dependent)
- [x] `/chat` (mobile): booking lookup, welcome and tap-to-try examples, typed or spoken input (hi-IN / en-IN / ja-JP / ta-IN), passport card, Change via the m3 picker, plan bubble with tray label, links for the rest of the booking, live thread with Radar buttons
- [x] Tests: `test_m17_reader.py`, `test_m17_chat.py`, `thread.test.ts`

## Done when
Priya types "pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon" on `/chat`, sees the chips, confirms, gets AVML + NO ONION NO GARLIC, and the Radar asks about 25 Oct (Sharad Purnima); "Yes" switches her JL740 meal before the cutoff and shows in the change log.

## Notes
- 25 Oct 00:40: spine on main: `Passport` table, `service.py`, seed (103 of 186 passengers known: 23 from special meals or cast profiles, 80 answered the T-48 h chat; Priya, Mehta and Swati have none), `GET /api/passport/cabin/{flight_id}`, `GET /api/passport/{passenger_id}`.
- 25 Oct: chat, save, Radar and `/chat` done. Checked on a fresh reset: Priya's sentence → card (meat, fish and seafood, egg, gelatin, onion, garlic; dairy fine; Purnima fasts) → That's right → AVML + NO ONION NO GARLIC → Radar question "Your JL740 on Sun 25 Oct falls on Sharad Purnima" → Yes → 23C's promise is AVML + `NO ONION NO GARLIC NO ALCOHOL NO GRAIN NO LENTILS OR BEANS` (the order of the note comes from the rules engine).
- Nothing is inferred from a name: "Purnima", "Poonam" and "Ramzan" are first names and "Jain" a surname, so a festival makes a time rule only with a fast or "I keep it" in its clause, "my name is …" is not read, and "Sushila Jain" doesn't make a Jain diet.
- The change log entry needs m18: the Radar calls `app.modules.m18_changes.service.submit_change` when it is importable (built in parallel) and works without it.
- Heads-up for m16: `/p/days` lists every observance in `calendar.json`, so it now shows Purnima and Ramadan too. Ramadan's `rules` is `dawn_to_sunset` (timing, not food); m16 may want to list only `rules == "vrat"`.
- The seed's Purnima passenger now fasts on 23 Dec (Drik Panchang), not 24 Dec.
- No extraction-model key on this laptop: the dictionary carries the whole demo. The merge (the model may only add tags) is tested with a fake reading; the live call itself is untested here.
