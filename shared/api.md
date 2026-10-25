# API contract v1

All endpoints sit under `/api`, take and return JSON in snake_case, and use the entity shapes in `README.md`. Errors return `{detail: string}` with a 4xx status. Owners implement their endpoints in `backend/app/modules/<module>/router.py`. Until an endpoint ships, consumers mock it in their own folder with exactly these shapes.

Shorthand used below:
- `Text = {en: string, hi?: string, ja?: string}`
- `Fired = {rule_id, tag, via, diet?, message: Text}`. `via` is the ingredient or child tag that triggered the rule, e.g. `"出汁 → bonito → fish"`.
- `Verdict = "SAFE" | "UNSAFE" | "NEEDS_HUMAN"`

## m0 · core
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/health` | – | `{ok: true, version}` |
| GET | `/clock` | – | `{now: iso, tz: "Asia/Kolkata"}` |
| GET | `/flights` | – | `Flight[]` |
| GET | `/flights/{id}` | – | `Flight & {counts: {passengers, special_meals, open_alerts}}` |
| GET | `/flights/{id}/passengers` | `?with_promises=true` | `(Passenger & {promise?: MealPromise})[]` |
| GET | `/notifications` | `?to=PX-0007` or `?to=caterer` or `?to=crew:JL740` | `Notification[]` (newest first) |
| POST | `/clock` | `{now: iso}` | `{now}` (sets the sim clock) |
| POST | `/demo/reset` | `{keep_judges?: boolean}` (default true) | `{ok, seed_epoch}`: runs every module's `seed()` in order and puts the clock back to 23 Oct 18:00 IST |

## m1 · rules engine
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/rules` | – | `{version, taxonomy: Tag[], diets: Diet[], presets: Preset[], codes: Code[], picker_groups: PickerGroup[]}` |
| POST | `/rules/evaluate` | `{forbid: string[], spec_tags: string[]}` or `{profile_id, spec_id}` | `{verdict: Verdict, fired: Fired[]}` |
| POST | `/rules/code-options` | `{forbid: string[], allow?: string[]}` | `{options: CodeOption[]}`, best first |
| POST | `/rules/check-booking` | `{forbid: string[], booked_code: string}` | `{ok: boolean, problem?: {contains: string[], message: Text}, suggested_code?: string}` |

- `Tag = {id, parent|null, labels: Text, synonyms_ja: string[], synonyms_en: string[]}`
- `Diet = {id, labels: Text, forbid: string[], notes?: Text}`
- `Preset = {id, labels: Text, forbid: string[], allow: string[]}`
- `Code = {code, name: Text, excludes: string[], may_contain: string[], contains: string[]}`
- `CodeOption = {code, recommended: boolean, safety_gaps: string[], preference_losses: string[], kitchen_note: string|null, label_mark: Text, why: Text}`
- `PickerGroup = {id, kind: "diet"|"allergen", labels: Text, tags: string[]}`. These are the checkbox groups of the diet picker ("Meat", "Fish & seafood", "Egg", "Onion & garlic", "Root vegetables", "Dairy", "Honey", "Alcohol", then the allergens).

Example: Priya's `forbid: [meat, seafood, egg, onion, garlic]` with dairy allowed returns:
1. AVML (recommended), note `NO ONION NO GARLIC`, label mark "VEG · no onion, no garlic".
2. VJML, no safety gaps, but it loses dairy and root vegetables she does eat.

## m3 · passenger + judge join
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/passenger/lookup` | `?pnr=6XK2QP&surname=SHARMA` | `Passenger` (404 if no match) |
| POST | `/profiles` | `{passenger_id, lang, presets, forbid, allow, fasting_dates?, allergens?, consent, chosen_code}` | `{profile: Profile, promise: MealPromise, booking_check: {ok, problem?, suggested_code?}}`. Writes C1. If the booked SSR breaks the rules (m1 `check-booking`), it also raises WRONG_CODE with `alerts.raise_alert` |
| POST | `/join` | `{display_name, lang, presets, forbid, allow, consent}` | `{passenger: Passenger, profile: Profile, promise: MealPromise}`. Takes the next free seat in row 5 (then row 20), sets `is_judge`, writes C1 |
| POST | `/passenger/meal-options` | `{forbid, allow?}` | `{options: CodeOption[]}`: `/rules/code-options`, but never empty. When no standard code fits, one option `SPML` with a kitchen note listing what to leave out |

`/join` also takes optional `allergens` (kept in `Profile.allergens`) and `passenger_id`: a judge changing their answers keeps the same seat, the meal m6 reserved for the old answers is released, and the profile and promise are updated. `/profiles` and `/join` fall back to `SPML` when no standard code fits; `chosen_code` on `/profiles` is optional (default: the recommended one).

## m4 · lost-meal watcher
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/feed/messages` | `{text}` (raw PNL or ADL) | `{message: RawMessage, changes: Change[], alerts: Alert[]}` |
| GET | `/flights/{id}/messages` | – | `RawMessage[]` (oldest first) |
| GET | `/flights/{id}/manifest` | – | `{as_of: RawMessage.id, passengers: ManifestRow[]}` |
| GET | `/alerts` | `?flight_id=&status=open&type=` | `Alert[]` (newest first) |
| POST | `/alerts/{id}/actions` | `{action: "acknowledge"\|"request_again"\|"notify_passenger"\|"notify_kitchen"\|"resolve", actor, note?}` | `Alert`. `request_again` stores `evidence.ssr_draft` and has the simulator emit the corrected ADL → C2 `fixed` + passenger notification |
| POST | `/sim/booking-events` | `{type: "rebook_drop_meal"\|"restore_meal"\|"seat_change"\|"delay"\|"aircraft_swap", passenger_id?, params?}` | `{message: RawMessage, alerts: Alert[], changes: Change[]}`. Live now: `rebook_drop_meal` (params `new_pnr?`, `inbound_flight?`), `restore_meal` (`code`, `note?`), `seat_change` (`seat`), `delay` (params `minutes`, `flight_id?`; no message, `message: null`; raises DELAY_HOLD with `deadline_at` = the new dispatch time and tells the caterer) |

- `Change = {kind: "added"|"removed"|"changed", passenger_id|null, pnr, name, field?, before?, after?}`
- `ManifestRow = {passenger_id, pnr, surname, given, title, seat, cabin, ssr: [{code, status, text}], inbound|null}`. Judges aren't in the feed, so they aren't listed
- `alerts` in a feed or sim response are the ones that message raised or resolved, not every open one
- LOST_MEAL `evidence = {message_ids, code_before, note_before, lines_before: string[], lines_after: string[], line_before, line_after|null, old_pnr, new_pnr, inbound_before, inbound_after, ssr_draft?}`
- WRONG_CODE `evidence = {message_ids, booked_code, promised_code, suggested_code, contains}`
- Names in PNL/ADL are A-Z only (ICAO 9303): MÜLLER is sent as MUELLER. Families and groups share a PNR, so match on PNR + name

LOST_MEAL deadline = `caterer_final_list_at`. Evidence holds the message ids, the line before and the line after.

## m6 · late-request matcher
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/flights/{id}/inventory` | – | `{items: (MealItem & {spec: MealSpec})[], summary: {special, spare, main, backup, free}}` |
| POST | `/match` | `{flight_id, passenger_id?, forbid, allow?, source: "checkin"\|"gate"\|"crew"\|"join"}` | `MatchResult` (dry run, reserves nothing) |
| POST | `/late-requests` | same as `/match` (`passenger_id` required) | `{late_request: {id, passenger_id, at, source, status}, match: MatchResult}`. Reserves the item, writes LATE, raises a LATE_REQUEST (info) for crew, notifies the passenger |
| GET | `/late-requests/{id}` | – | `{late_request, match: MatchResult}` (the passenger's voucher or "reserved" view) |
| GET | `/backups/forecast` | `?flight_no=JL740&days=14` | `{service_level, method: Text, rows: [{date, expected_late, recommended, festival?: Text}]}` |

`MatchResult`:
```
{
  status: "matched" | "voucher",
  tier: "spare_special" | "main_menu" | "backup" | "voucher",
  item?: MealItem & {spec},
  explanation: Text,
  considered: [{item_id, spec_name: Text, tier, verdict, fired: Fired[]}],
  solver: {engine: "cp-sat" | "greedy", ms, swaps: [...]},
  voucher?: {code, value_inr, outlets: [{name, terminal, open: string}]}
}
```

## m7 · caterer
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/flights/{id}/meal-lists` | – | `MealListVersion[]` (newest first) |
| POST | `/flights/{id}/meal-lists` | `{}` | `MealListVersion`: a new version cut from the current manifest + promises |
| POST | `/meal-lists/{id}/ack` | `{by}` | `MealListVersion`. Writes C3 for every promise on the list |
| GET | `/flights/{id}/labels` | `?version=` | `Label[]` |

- `MealListVersion = {id, flight_id, version, created_at, sha256, ack_at|null, ack_by|null, lines: [{passenger_id, name, pnr, code, note, item_id}], diff: {added: Line[], removed: Line[]}}`
- `Label = {item_id, qr: string, mark: Text, name, pnr, flight_no, date, code, note}`

Seat numbers are not printed on labels: the QR carries the item id and the crew tablet looks up the live seat.

## m8 · crew tablet
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/flights/{id}/crew-package` | – | `{flight, passengers, promises, items, specs, verdicts: {[passenger_id]: {[item_id]: Verdict}}, expected_specials: item_id[], rules_version, seed_epoch, generated_at}`: everything the tablet needs offline |
| POST | `/flights/{id}/crew-events` | `{seed_epoch, events: CrewEvent[]}` | `{accepted, duplicates, ignored_old_epoch}` |

`CrewEvent = {client_id, type: "galley_found"|"galley_missing"|"seat_scan"|"swap_backup", item_id?, passenger_id?, seat?, verdict?, at, wall_at?}`. `wall_at` (optional) is the device's real clock: when it's there, the server uses the sim time in effect at that moment instead of `at`, which goes stale if the clock moved while the tablet was offline. The endpoint is idempotent on `client_id` and writes C4/C5, item status, swaps and MISSING_TRAY / RED_SCAN.

## m9 · hidden-ingredient check
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/recipes/extract` | multipart `file` (image) or `{text, name?}` | `RecipeSheet` |
| POST | `/recipes/{id}/approve` | `{by}` | `{sheet: RecipeSheet, spec: MealSpec}` |
| GET | `/recipes` | – | `RecipeSheet[]` (newest first) |
| GET | `/recipes/{id}` | – | `RecipeSheet` |
| GET | `/recipes/eval` | – | `{diet, compared, rows: [{id, dish: Text, truth: string[], dictionary: string[], model: string[] \| null, combined: string[] \| null}], metrics: {dictionary, model, combined}}`. Each list holds the families the rules call UNSAFE for `diet` (vegetarian: meat, seafood, egg, gelatin); `null` = no cached model answer. `metrics` cover only the `compared` rows (the ones the model has read), so the three readers are scored on the same dishes. Each metric is `{dishes, hits, misses, false_alarms, recall, precision, unsafe_dishes, unsafe_dishes_caught, safe_dishes, safe_dishes_flagged}` or `null`. Reads the committed cache only, never calls the model |

`RecipeSheet = {id, name: Text, source_hash, cached: boolean, engine: "dictionary"|"gemini"|"dictionary+gemini", ingredients: [{name_ja, name_en, tags, confidence, evidence}], verdicts: [{diet, verdict, fired}], status: "needs_review"|"approved", created_at}`

Optional on `RecipeSheet`: `text` (the sheet as read, for the side-by-side view), `model_note` (e.g. "Model offline: dictionary only"), `spec_id` and `approved_by` (set by approve). Approve creates `MealSpec` `SPEC-R-…` with `kind: "main"`, `source: "recipe_check"`.

## m10 · insights
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/promises/{id}/timeline` | – | `{promise, passenger, events: (CheckpointEvent & {message: {id, kind, seq, received_at}\|null})[], actions: (AlertAction & {alert_id, alert_type})[], breakpoint?: {checkpoint, at, detail, source, alert_id?, alert_type?, deadline_at?, fixed_at?, fixed_detail?, fixed_by?, fix_action?}}`. `message` is the PNL/ADL a C2 event came from |
| GET | `/insights/summary` | `?days=30` (stretch) | `{kpis: {promises, broken, caught_before_deadline, verified_in_galley, median_fix_min}, by_checkpoint: [...], by_diet: [...], daily: [...]}` |

## m11 · story engine
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/demo/scenario` | – | `{current, steps: [{n, act, title: Text, sim_time, screen: "/p"\|"/ops"\|…, cue: Text, done}]}` |
| POST | `/demo/step` | `{n, auto?: boolean}` | `{current, clock}`: runs step n (idempotent), sets the sim clock and, with `auto`, does the presenter's action too |

Reset and the clock are m0 endpoints (above).

## m14 · groups (stretch)
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/groups/upload` | multipart CSV | `{group_id, rows: [{name, pnr, forbid, allow, problems: string[]}]}` |
| POST | `/groups/{id}/confirm` | – | `{profiles: number}` |

## m16 · diets that change by date
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/days/trips` | `?passenger_id=PX-0057` | `{passenger_id, has_profile, legs: Leg[]}` (404 if no passenger) |
| POST | `/days/save` | `{passenger_id, fast_dates: iso_date[]}` | `{passenger_id, has_profile, legs: Leg[]}`. Only dates of the passenger's own legs (422 otherwise); which fast it is never leaves the phone |
| GET | `/days/ahead` | `?days=30` (1–120) | `{today, legs: (Leg & {passenger_id, name, seat, days_to_go})[]}`: fast-day legs from the sim clock's today, soonest first |

- `Leg = {flight_no, date, from, to, catered_in, fast_day, code|null, kitchen_note|null, kitchen_note_ja|null, label_mark: Text|null, usual: {code, kitchen_note}|null}`. Meal fields are null until the passenger has a profile. On a fast day the rules are the profile's plus m1's `vrat` preset (forbid wins); `kitchen_note_ja` is the same note in Japanese for a Tokyo-catered leg.
- Rules (m1): `engine.rules_on(forbid, allow, fasting_dates, date)` / `rulesOn()` and `fast_days(observance_ids, dates)` / `fastDays()`, on the public calendar `shared/rules/calendar.json`.

## v2 shapes
`Tier`, `TimeRule`, `Rules`, `Passport`, `Window`, `Rung`, `Channel`, `ChangeKind` and `ChangeEvent` are defined in `docs/plan/v2.md` ("Shared shapes").

## m17 · dietary passport + calendar radar
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/passport/cabin/{flight_id}` | – | `{flight_id, known, total, passengers: [{passenger_id, seat, cabin, name, known, source, tier: "hard"\|"firm"\|"soft"\|"none", flex, rules: Rules\|null, card: {ja, en, hi}}]}` |
| GET | `/passport/{passenger_id}` | – | `Passport & {card, plan: {main_pick\|null, main_pick_name: Text\|null, code\|null, kitchen_note\|null, forbid, allow, time_rules_active}}` (404 if none) |
| POST | `/passport` | `{passenger_id, lang, rules: Rules, source}` | `{passport: Passport, plan, promise: MealPromise\|null}`. Writes the profile, the promise and C1 like `/profiles` (only when the plan needs a special meal); time-rule labels never stored; then runs the Radar for that passenger |
| GET | `/passport/booking/{passenger_id}` | – | `{pnr, flight_no, passenger: Person, passengers: Person[]}`, `Person = {passenger_id, name, surname, seat, has_passport}`: the passenger and the others on the same booking to ask |
| POST | `/radar/scan` | `{flight_id?, passenger_id?}` | `{asked: [{question_id, passenger_id, date, flight_no, label: Text}], quiet: number}`; each question is a `whatsapp` notification with `ref: {kind: "radar_question", question_id, date, flight_no, question: Text, options: [{id: "yes"\|"no", label: Text}]}` |
| POST | `/radar/answer` | `{question_id, option_id: "yes"\|"no"}` | `{question_id, applied: boolean, plan, change: ChangeEvent\|null}`. Idempotent (`applied: false` on a second tap). The reply is a `whatsapp` notification with `ref: {kind: "radar_answer", question_id, option_id, text: Text}` |

- A `dates` TimeRule the passenger ticks has `confirm: true`: it applies only on dates in its `confirmed` list (the Radar's "Yes"); `declined` dates never apply. Rules without `confirm` (a fast typed as a date) apply on every listed date. `service.rules_on` / `plan_for` follow this.
- Radar "Yes" before `special_meal_cutoff`: the special meal is reordered through m3's `_save` (Profile, MealPromise, C1) and m18's `submit_change(channel="radar", kind="calendar")` is called when installed; after the cutoff only `submit_change` takes it.

## m18 · change router + chaos mode
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/changes` | `{flight_id, passenger_id?, channel, kind, rules?: Rules, note?, lang?}` (rules default to the passport, else the profile, else the meal that dropped) | `ChangeEvent` (decided). 404 unknown flight or passenger; 422 bad input, unknown tag, or no rules known for the passenger. Without `passenger_id` it is a dry run: `status: "waiting"`, nothing held |
| GET | `/changes` | `?flight_id=` | `{now, window: Window, windows: [{window, from, to, rungs: Rung[]}], events: ChangeEvent[]}` (oldest first, newest last) |
| GET | `/changes/metrics` | `?flight_id=` | `{ours: Metrics, today: Metrics}`, `Metrics = {events, hard_total, hard_met, firm_total, firm_met, meals_wasted, known_before_cutoff, passengers}` |
| GET | `/changes/assignments` | `?flight_id=` | `{assignments: [{seat, passenger_id, item_id, spec_id, spec_name: Text, rung, tier, order, name, code, kind, galley, position, source}]}`: the onboard plan, in service order |
| POST | `/chaos/run` | `{flight_id, preset?: "jl740"}` | `{events: ChangeEvent[], metrics}`; idempotent per reset; 409 if the seed lacks a beat's passenger |
| POST | `/chaos/reset` | `{flight_id}` | `{ok, seed_epoch}`: runs the demo reset (judges kept), since chaos also writes bookings, meals, alerts and messages |

Passenger answers go out through `outbox.notify("whatsapp", passenger_id, …, ref={"kind": "change", "change_id", "text": Text})` so the passenger's messages show them; crew get `crew:JL740`, the caterer `caterer` (ref `{kind: "change", change_id, item_id?}`).

Additions to `ChangeEvent` (all optional for readers): `seq`; `chaos: boolean`; `request.tier` (strongest tier of the need; `"none"` for a no-show), `request.allergens`, `request.time_rules`, `request.flex`; `decision.galley`; `decision.steps: [{rung, ok, reason: Text}]` (same order as `steps_tried`; `decision.reason` joins them); `decision.swap` (flex_swap: `{passenger_id, seat, name, item_id, spec_id, spec_name, miles}`); `decision.also` (a run-out serving several seats: `[{passenger_id, seat, name, rung, ok, item_id, spec_id, spec_name, tier, reason}]`); `decision.voucher` (unmet on the ground: `{code, value_inr, outlets}`); `today.item_id` (the spare today's crew would hand over) and `today.wasted`. `message` is `null` for a no-show.

Assignments: `source` is `"assigned"` (a meal item held for the seat) or `"main_pick"` (the main course the passport plan holds; `rung: null`). Metrics: hard/firm count events by `request.tier`; `meals_wasted` ours = spare special meals nobody holds + no-show meals not passed on, today = no-show meals thrown away + spare special meals today's crew didn't hand out (pouches never count); `known_before_cutoff` ours = passport or profile dated before the cutoff, today = lines on the caterer's list cut at the cutoff.

Python: `m18_changes.service.submit_change(session, *, flight_id, passenger_id=None, channel, kind, rules=None, note=None, lang=None, at=None) -> ChangeEvent`, `m18_changes.service.assignments(session, flight_id) -> list[dict]` (the rows above).

## m19 · smart load
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/load/{flight_id}` | – | `{families: [{family, label: Text, known, forecast, p90, loaded}], reserve: {fresh: {q, cu, co, ratio}, pouch: {q, cu, co, ratio}, loaded}, universal: {profiles: [{id, label: Text}], candidates: [{id, name: Text, covers, matrix: Verdict[]}]}, bento: {components: [...], spares: [...]}}` (404 for an unknown flight) |

Everything is computed live on each call (no m19 tables). Extra fields on top of the row above:
- top level: `flight_id, flight_no, date, passengers, known, unknown, assumptions: [{id, label: Text, value, source: Text}], method: Text`. `known + unknown = passengers`; `Σ families.forecast = passengers`.
- `families[]`: `family` is one of `non_veg no_beef halal vegetarian veg_no_onion_garlic jain vegan eggetarian fasting diabetic allergy` (each passenger in exactly one, from their rules on the flight date); also `tier, loaded_from: {special, main, spare}, risk: boolean (p90 > loaded), share` (the route prior for passengers who told us nothing). `loaded` = their own special meals + main dishes left after everyone else in the cabin picked + spares and reserve pouches that m1 calls SAFE for the family.
- `reserve`: `lambda, base, factors: [{label: Text, factor, source}], loaded_covered, formula: Text, point: Text`; each of `fresh`/`pouch` also has `covered, expected_unused, expected_waste, expected_short, cost_per_flight`.
- `universal`: 13 profiles × 5 candidates; candidate `id` is `universal` (the live `SPEC-BACKUP`), `jain_thali`, `vrat_plate`, `paneer_rice`, `chicken_rice`; also `tags, reserve: boolean, checks` (NEEDS_HUMAN count), `fired: Fired[][]` (parallel to `matrix`); plus `notes: Text[]`.
- `bento`: `slots, tray: Cup[]` (the standard veg tray), `components: Cup[]` (`Cup = {id, slot, name: Text, tags, standard, safe_for: need[]}`), `needs: [{id, label: Text, lambda, fails: slot[]}]`, `spares: [{cup_id, slot, name: Text, covers: need[], lambda, count}]`, `total_cups, cups_if_stocked_apart, design: Text`.

## m20 · crew copilot (inside m8)
The crew package (`GET /api/flights/{id}/crew-package`, m8) gains `copilot` (or `null` if building it failed; the v1 fields never change):
```
copilot: {
  seats: [{seat, passenger_id, tier: "hard"|"firm"|"soft"|"none", flex, card: {ja, en, hi},
           may_eat_from: iso|null, sunrise_box: boolean,
           assigned: {item_id|null, spec_id|null, spec_name: Text, rung}|null,
           any_main: boolean, galley: "G1"|"G2",
           source?, fast_today?, sun_rule?: "daylight"|"dawn_to_sunset", may_eat_until?, sun_note?: Text, needs_tray?}],
  serve_order: string[],
  taps: [{client_id, type: "eaten"|"refused"|"swapped", passenger_id, seat, item_id|null, at}],
  sources: {trays: "m18"|"meal items", sun: "m21"|null}
}
```
- `seats`: every passenger we know something about (passport or v1 profile from m17, else a late request, else the booked code); "not stated" seats are left out. Tier, card and `fast_today` use the rules on the flight date (`rules_on`); optional keys are only sent when set.
- `assigned`: m18 `service.assignments(session, flight_id)` wins for every passenger it covers (dict with `assignments` or a plain list); otherwise the meal items: own special `ssr_change`, spare `onboard_spare`, backup `reserve_pouch`; and when exactly one main fits (`plan_for` gives `main_pick`, `any_main` false) a free main tray of that dish is held, `held_main`. `needs_tray`: strict or medical, no main fits and nothing is held.
- `may_eat_from`, `may_eat_until`, `sunrise_box`, `sun_note`: m21 `service.daylight_seats(session, flight_id)` (or its `/api/sun/seats` route function); without m21 `may_eat_from` is null and `sun_rule` still marks the seat.
- `serve_order`: the serve list: seats with a tray, a sun rule or `needs_tray`; business first, then economy front to back, strictest first within a row.
- Taps go back through `POST /api/flights/{id}/crew-events` as `type: "eaten" | "refused" | "swapped"` with `passenger_id` or `seat` (one is required), `item_id` optional. Stored in the crew event log (idempotent on `client_id`) and as a C5 `info` event on the promise timeline; they come back in `copilot.taps` on the next download.

## m21 · sun at the aircraft
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/sun/flight/{id}` | – | `SunFlight & {delay_min}` for a flight in the database: `std`/`sta` moved by any m4 delay (404 if no flight) |
| GET | `/sun/route` | `?from=DEL&to=NRT&dep=<iso>&arr=<iso>&flight_no=` | `SunFlight` for a flight that isn't in the database (`flight_id: null`). 422 for an airport other than DEL, BLR, NRT, HND, a time without an offset, arrival before departure, or over 20 h |
| GET | `/sun/presets` | `?date=2026-10-25` (default) | `{date, rule, flights: SunSummary[]}`: JL740 DEL 04:35 IST → NRT 15:20 JST, JL754 BLR 02:55 IST → NRT 14:00 JST, JL030 DEL 19:55 IST → HND 06:30 JST (+1) |
| GET | `/sun/seats/{id}` | – | `{flight_id, seats: (EatWindow & {seat, passenger_id, rule})[]}`, by seat. Rules come from m17's `daylight_rules(session, flight_id)`; `seats: []` while m17 isn't merged (404 if no flight) |

- `SunSummary = {flight_id|null, flight_no|null, origin, dest, dep, arr, threshold_cruise, sunrise: SunEvent|null, sunset: SunEvent|null, fajr: SunEvent|null, chauvihar: EatWindow & {rule}}`; `SunFlight = SunSummary & {track: TrackPoint[]}`.
- `SunEvent = {at_aircraft, at_origin|null, minutes_earlier|null, lat, lon, alt_m}`: the first time on the flight the sun crosses the line at the aircraft, the same crossing on the ground at the origin on that local date, and origin minus aircraft in minutes. Sunrise and sunset line: −0.833° − 1.76′·√(altitude in m) (`threshold_cruise` = −3.91° at 11,000 m); `fajr` (dawn): −18°.
- `TrackPoint = {at, lat, lon, alt_m, elev, elev_origin}` every 5 min from departure, plus arrival: the sun's height in degrees at the aircraft (`elev`) and on the ground at the origin (`elev_origin`).
- `EatWindow = {may_eat_from|null, may_eat_until|null, sunrise_box, note: Text}`. A rule is `{kind: "daylight", after_sunrise_min}` (eats from sunrise + N min until sunset) or `{kind: "fast_dawn_to_sunset"}` (eats from sunset until dawn). `may_eat_from` starts the first allowed stretch that reaches into the cabin service (after the 25 min climb, before the 30 min descent); `may_eat_until` is null when it lasts to arrival. `sunrise_box: true` when no allowed time falls in the cabin service: the passenger gets a sealed box at the door. `chauvihar` is the daylight rule with 48 min.
- Times are ISO with an offset, rounded to the minute: computed times in the origin's zone, `arr` in the destination's. Route: great circle, linear in time; climb to 11,000 m in 25 min, descend in the last 30 min.
- Front end (`@/modules/m21-sun`): `SunTimer` `{mayEatFrom, sunriseBox, lang, size?: "sm"|"md"}` (countdown on the sim clock, or "Sunrise Box at the door") and `useSunSeats(flightId)` (refetches every 30 s).

## m18 · additions (25 Oct): the 49 h line
- `GET /changes` also returns `long_lead: {at, hours: 49, applies_to: ["kosher", "minimal_allergen"]}`: JAL takes kosher and minimal-allergen meals until 49 h before departure (48 h by phone), every other special meal until the 25 h cutoff.
- A need with an allergy (`rules.allergens` not empty) or a kosher meal (the word "kosher" or "KSML" in the change's `note`; the rules engine has no kosher rule) leaves the `ssr` window at T-49 h. Between the two lines its ladder is `ssr_change` (skipped, with the reason) → `caterer_add` → `unmet`, and Today says the website no longer takes it. `ChangeEvent.request.long_lead: boolean` is new (optional for readers).
- The release rung (`noshow_release`) also takes trays skipped on a seat screen (m22); its reason then says so.

## m22 · seatback meal check
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/seatback/ask` | `{flight_id}` | `SeatbackStatus`: asks every passenger with a special or held meal (m18 `assignments`, first row each; held = `"main"` for a main course the passport plan holds). Seats that already answered keep their answer; each press is a new `round` |
| GET | `/seatback/{flight_id}` | – | `SeatbackStatus` (the crew view; 404 unknown flight) |
| GET | `/seatback/{flight_id}/seats/{seat}` | – | `SeatView`: what one seat screen shows (422 for a seat that isn't like `23C`) |
| GET | `/seatback/{flight_id}/seats/{seat}/options` | – | `{seat, rules_known, options: SeatOption[]}`: what the passenger may change to (404 empty seat) |
| POST | `/seatback/answer` | `{flight_id, seat, answer: "yes"\|"no"\|"change", item_id?}` (`item_id` from the options for a change) | `SeatView`. 404 empty seat, 409 not asked yet, 422 bad input or a meal that isn't free for this seat any more |

- `SeatStatus = "asked" | "confirmed" | "skipped" | "changed" | "no_answer"`; `no_answer` is `asked` for 10 min or more on the sim clock: the crew ask in person.
- `SeatbackStatus = {flight_id, now, round, asked_at|null, no_answer_after_min: 10, counts: {asked, confirmed, skipped, changed, no_answer}, seats: [{seat, passenger_id, status, held: "special"|"main", asked_at, answered_at|null, item_id|null, spec_id|null, new_item_id|null, released_item_id|null}]}`.
- `SeatView = {flight: {id, flight_no, origin, dest, std, sta}, seat, now, occupied, initials: "P. S."|null, lang, ask: {id, status, held, asked_at, answered_at|null, meal: SeatMeal & {mark: Text|null}, choice: SeatMeal|null}|null}`, `SeatMeal = {item_id|null, spec_id|null, name: Text|null, code|null, galley|null}`. Privacy: initials only; the screen shows the meal only after a tap; `mark` is the tray's label mark (food rules, never a diet's name).
- `SeatOption = {spec_id, name: Text, code|null, source: "freed"|"spare"|"main", count, item_id, galley}`: one per dish, nearest galley first; only trays nobody holds (a no-show's or another seat's freed meal, a spare special meal, a main above the count still owed in that cabin) that the rules engine calls SAFE for every rule the passenger has on the flight date. Reserve pouches are never offered. Rules: the passport, profile or booked code, else the router's last change for them, else an m6 late request; `rules_known: false` (no options) when none exists.
- Yes: status `confirmed`, a crew notification and a C5 `info` line on the timeline (the checkpoint itself is set by the tray scan, which stays the final check). After a No, Yes takes the tray back if nobody holds it. No: every tray held for them is freed (`released_item_id`) for the router. Change: the chosen tray is assigned, the old one freed.
- Python: `m22_seatback.service.released_items(session, flight_id) -> [(seat, MealItem)]` (m18's release rung reads it), `rules_of(session, passenger)`.
- Front end (`@/modules/m22-seatback`): `useSeatbackStatus(flightId)` (2 s, keeps the last answers while off the network), `useAskSeats(flightId)`, `STATUS_LOOK`; page `/seat?seat=23C`.
