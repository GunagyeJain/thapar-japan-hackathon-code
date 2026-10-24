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
| POST | `/sim/booking-events` | `{type: "rebook_drop_meal"\|"seat_change"\|"delay"\|"aircraft_swap", passenger_id?, params?}` | `{message: RawMessage, alerts: Alert[]}` |

- `Change = {kind: "added"|"removed"|"changed", passenger_id|null, pnr, name, field?, before?, after?}`
- `ManifestRow = {pnr, surname, given, title, seat, cabin, ssr: [{code, status, text}], inbound|null}`

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

`CrewEvent = {client_id, type: "galley_found"|"galley_missing"|"seat_scan"|"swap_backup", item_id?, passenger_id?, seat?, verdict?, at}`. The endpoint is idempotent on `client_id` and writes C4/C5, item status, swaps and MISSING_TRAY / RED_SCAN.

## m9 · hidden-ingredient check
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/recipes/extract` | multipart `file` (image) or `{text, name?}` | `RecipeSheet` |
| POST | `/recipes/{id}/approve` | `{by}` | `{sheet: RecipeSheet, spec: MealSpec}` |
| GET | `/recipes` | – | `RecipeSheet[]` (newest first) |
| GET | `/recipes/{id}` | – | `RecipeSheet` |
| GET | `/recipes/eval` | – | `{rows: [{dish, truth: string[], dictionary: string[], model: string[], combined: string[]}], metrics: {dictionary, model, combined}}` |

`RecipeSheet = {id, name: Text, source_hash, cached: boolean, engine: "dictionary"|"gemini"|"dictionary+gemini", ingredients: [{name_ja, name_en, tags, confidence, evidence}], verdicts: [{diet, verdict, fired}], status: "needs_review"|"approved", created_at}`

Optional on `RecipeSheet`: `text` (the sheet as read, for the side-by-side view), `model_note` (e.g. "Model offline: dictionary only"), `spec_id` and `approved_by` (set by approve). Approve creates `MealSpec` `SPEC-R-…` with `kind: "main"`, `source: "recipe_check"`.

## m10 · insights
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/promises/{id}/timeline` | – | `{promise, passenger, events: CheckpointEvent[], breakpoint?: {checkpoint, at, detail}}` |
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
