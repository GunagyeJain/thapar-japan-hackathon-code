# shared/: contracts

Everything more than one module depends on: entities, who writes what, seed data and the endpoint list. It's **shared zone**: add-only, ship right away, with a heads-up (see CONTRIBUTING.md). The one exception is `shared/rules/`, which m1 owns.

| File | What |
|---|---|
| `README.md` | Entities, conventions, who writes what (this file) |
| `api.md` | Every endpoint: method, path, owner module, request and response shapes |
| `rules/` | Diet rules data (m1): `taxonomy.json`, `diets.json`, `presets.json`, `codes.json`, `vectors.json` |
| `seed/` | Demo data loaded at startup and on `/api/demo/reset`: `flight.json`, `passengers.json`, `profiles.json`, `meal_specs.json`, `meal_items.json` (m0); `messages/` (m4), `recipes/` (m9), `history/` (m10) |

## Conventions
- **JSON is snake_case.** Python models and TypeScript types use the same field names.
- **Times are ISO 8601 with an offset.** Delhi is `+05:30`, Tokyo `+09:00`. Deadlines and countdowns always use the **sim clock** (`GET /api/clock`, `app.core.clock.now()`, `useSimClock()`), never the wall clock.
- **IDs** are strings with a prefix:

  | Entity | Format | Example |
  |---|---|---|
  | Flight | `JL740-20261025` | |
  | Passenger | `PX-` + 4 digits | |
  | Profile | `PF-…` | |
  | Meal promise | `MP-…` | |
  | Meal spec | `SPEC-…` | |
  | Meal item | `TB-` + 6 characters (opaque; printed on labels) | |
  | Alert | `AL-…` | |
  | Raw message | `MSG-…` | |
  | Notification | `NT-…` | |
  | Checkpoint event | `CE-…` | |
- **Diet data is food rules, not religion.** A profile stores `forbid` / `allow` ingredient tags (from `rules/taxonomy.json`) and the presets the person tapped. Never infer a diet from a name.
- **Languages:** `en`, `hi`, `ja`. Text shown to people is an object `{en, hi?, ja?}`, with English always present.

## Frozen now, so nobody waits
- **Core tag ids.** m1 may add child tags but never renames these:

  meat, beef, pork, chicken, mutton, seafood, fish, bonito, shellfish, egg, dairy, milk, ghee, paneer, butter, cream, cheese, yogurt, allium, onion, garlic, root_veg, potato, carrot, ginger, radish, honey, gelatin, lard, meat_extract, alcohol, mirin, sake, grain, wheat, rice, legume, peanut, tree_nut, sesame, soy, buckwheat, sugar, halal_certified (a property tag on meat dishes).
- **QR payload:** the bare item id `TB-XXXXXX`, never a URL. The manual code is the same id without the `TB-` prefix.
- **Seed epoch:** a `Setting` called `seed_epoch` goes up by one on every reset. Crew events carry it, and the server ignores events from an older epoch (so rehearsal scans queued on the iPad can't leak into the live run).
- **Item status:** `planned → loaded → served`, or `planned → missing`. A backup swap sets the backup's `assigned_passenger_id` and marks the original `missing`. Only m8 changes status; m6 only assigns.
- **`Flight.backup_count`:** 4 sealed backups (fixed for the pilot). m6's forecast suggests counts for future flights.
- **SQLite** runs in WAL mode (every screen polls while others write).
- **Judges:** row 5 (A C D G H K), then row 20, one seat per device. Business carries spare meals, so judges get matched without using the galley reserve.

## Core entities (`backend/app/core/models.py`)
| Entity | Key fields |
|---|---|
| **Flight** | `id, flight_no, date, origin, dest, std, sta, aircraft, cabins {C, Y}, special_meal_cutoff (T-25 h), caterer_final_list_at, dispatch_at, boarding_at, status (scheduled\|delayed\|departed), delay_min, caterer, backup_count` |
| **Passenger** | `id, flight_id, seat, cabin (C\|Y), surname, given, title, pnr, ssr_meal (AVML…\|null), ssr_note, inbound {flight, from, date}\|null, group\|null, is_judge, display_name\|null, profile_id\|null`. This is the **current booking state**, as last seen in the PNL/ADL feed. |
| **Profile** | `id, passenger_id, lang, presets [ids], forbid [tags], allow [tags], fasting_dates [dates], allergens [tags], consent {this_trip, save_profile, share_with_caterer, cross_border_ack, at}, created_at, expires_at` |
| **MealPromise** | `id, profile_id, passenger_id, flight_id, code, kitchen_note, label_mark {en, hi, ja}, status (ok\|at_risk\|broken\|fixed), checkpoints {C1..C5: ok\|fail\|fixed\|pending}` |
| **CheckpointEvent** | `id, promise_id\|null, passenger_id, flight_id, checkpoint (C1\|C2\|C3\|C4\|C5\|LATE), result (ok\|fail\|fixed\|info), at (sim time), source, detail, data {}, key\|null` (unique when set; makes retries idempotent) |
| **MealSpec** | `id, name {en, ja, hi?}, code\|null, kind (special\|main\|backup), tags [taxonomy ids], certified, source (caterer\|recipe_check)` |
| **MealItem** | `id (TB-…), flight_id, spec_id, kind (special\|spare\|main\|backup), galley (G1\|G2), position, assigned_passenger_id\|null, status (planned\|loaded\|missing\|served)` |
| **Alert** | `id, flight_id, type, severity (critical\|warning\|info), passenger_id\|null, promise_id\|null, title, body, evidence {}, deadline_at\|null, status (open\|acknowledged\|resolved), created_at, actions [{action, actor, at, note}]` |
| **RawMessage** | `id, flight_id, kind (PNL\|ADL), seq, received_at, text` |
| **Notification** | `id, channel (sms\|whatsapp\|email\|crew\|caterer), to (passenger id, "caterer" or "crew:JL740"), lang, title, body, at, ref {}` |
| **Setting** | `key, value`. Holds the sim clock (`sim_now`) |

Module-owned tables stay in their module folder: `MealListVersion` (m7), `LateRequest` (m6), `RecipeSheet` (m9), `Group` (m14).

## Core helpers (`backend/app/core/`)
| Helper | Does |
|---|---|
| `clock.now()` | Sim time. `clock.set(dt)` is called through `POST /api/clock` |
| `events.record_checkpoint(promise_id, passenger_id, flight_id, checkpoint, result, source, detail, data=None)` | Writes a CheckpointEvent and updates `MealPromise.checkpoints` and `status` |
| `alerts.raise_alert(flight_id, type, severity, title, body, passenger_id=None, promise_id=None, evidence=None, deadline_at=None)` | Creates an Alert; deduplicates on (type, passenger_id) while one is open |
| `outbox.notify(channel, to, title, body, lang="en", ref=None)` | Writes a Notification (shown on the passenger page and on the crew and caterer inboxes) |
| `registry.MODULES` | Each module's `router` (FastAPI `APIRouter`) and `seed(session)`. Reset calls every `seed` in order m0 → m14 |

Inside an endpoint that also writes, pass your session: `record_checkpoint(..., session=session)`, `raise_alert(..., session=session)`, `notify(..., session=session)`. Then it all commits together (and SQLite never waits on itself). Without `session=` the helper opens and commits its own. `record_checkpoint` also takes `key=` (idempotent retries) and `at=`. JSON columns (lists, dicts) only save when you assign a new value, not when you edit them in place.

## Who writes what
| Data | Written by |
|---|---|
| Passenger rows | m0 seed; **m4** updates booking fields from PNL/ADL; **m3** adds judge passengers |
| Profile, MealPromise | **m3** (and the m0 seed for the named cast) |
| CheckpointEvent | C1 **m3** (+ seed) · C2 **m4** · C3 **m7** · C4 and C5 **m8** (when crew events sync) · LATE **m6** |
| Alerts | **m4**: `LOST_MEAL`, `WRONG_CODE` (reconciler), `DELAY_HOLD` · **m3**: `WRONG_CODE` when a profile is saved against a bad booked code · **m6**: `LATE_REQUEST` · **m8**: `MISSING_TRAY`, `RED_SCAN` |
| Alert actions (acknowledge, request again, notify passenger or kitchen, resolve) | **m4** endpoint; reserving a meal is **m6** |
| MealItem | m0 seed with deterministic ids (labels stay valid after a reset) · `assigned_passenger_id` **m6** (late requests) and **m8** (galley swap) · `status` **m8** · m7 only reads |
| MealSpec | m0 seed · **m9** adds approved recipe specs |
| RawMessage | **m4** |
| Notifications | any module, through `outbox.notify` |
| Sim clock | `POST /api/clock` (m0), used by m11's story steps |
| Reset (`POST /api/demo/reset`) | **m0**: calls every module's `seed()` in order, bumps `seed_epoch`, keeps judges when asked |

## The flight (seed)
JL740 · DEL 25 Oct 2026 04:35 (IST) → NRT 15:20 (JST) · B787-8 · business rows 1–5 (A C D G H K, 30 seats), economy rows 20–39 (A C D E F G H K, 156 seats).
- Special-meal cutoff: 24 Oct 03:35 (T-25 h).
- Caterer final list: 25 Oct 00:40.
- Dispatch: 02:05.
- Boarding: 03:35.

Seat map in the seed: economy runs rows 18–39 (so the cast's 18C exists). Rows 5 and 20 are left empty for judges, plus 6 more free seats: 186 passengers, 24 special meals. Specials for rows 1–29 load in G1, rows 30–39 in G2. Priya's tray is `TB-7K2Q9F`.

Caterer: Skyline Flight Kitchens, Delhi (fictional). Row 5 is held for judges (`POST /api/join`). The sim clock starts at 23 Oct 18:00 IST.

Named cast (the other passengers are generated deterministically):
| Seat | Name · PNR | Booking | Role |
|---|---|---|---|
| 23C | SHARMA/PRIYA MS · 6XK2QP · inbound 6E5318 BOM | AVML · note NO ONION NO GARLIC | the promise we follow; lost on rebooking at 23:02, then restored |
| 31K | MEHTA/RAMESH MR | no SSR | asks for a Jain meal at the gate (02:50) |
| 27D | SHAH/HEMANT MR | VJML | tray missing at the galley check; gets the backup |
| 24A | VERMA/ANIL MR | HNML (booked by an agent) | profile says vegetarian → WRONG_CODE |
| 18C | KHAN/AYESHA MS | MOML | halal |
| 21E | IYER/ROHAN MR | VGML | vegan |
| 26G | REDDY/KAVYA MS | VLML · note EGGETARIAN | eggetarian |
| 29H | PATEL/MEENA MRS | AVML · note VRAT | fasting |
| 2A | JAIN/SUSHILA MRS | VJML · note DIABETIC | combined diet |
| 33D–34G | Mangal Yatra Tours group (12, fictional) | VJML | group booking |

Load:
- the special meals for every SSR above (produced from the 24 Oct 03:35 list)
- caterer spares: 1 VJML in G2, 1 AVML (standard, contains onion) in G1
- 4 sealed backups in G2: the v2 universal plate (retort, shelf-stable: samak millet, makhana, lauki, rock salt; no dairy, onion, garlic or root vegetables), safe for 13 of 13 diets on this route (m19). The last 2 are held for galley contingencies.
- business spares: 2 Jain thali (Jain-safe, contains dairy), 2 vegan chana masala (contains onion and garlic), 2 chicken
- economy mains: chicken tikka masala and paneer butter masala
