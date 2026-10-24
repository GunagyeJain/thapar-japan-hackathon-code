# Build plan · ThaliBento finals (24 Oct 15:00 → 25 Oct 10:00 IST)

## Goal
Prove, live and end to end on real-format data, that a meal promise survives every hand-off. A passenger states a diet once. ThaliBento catches the wrong code (HNML), spots the request that a codeshare rebooking silently dropped, gives the caterer a list and labels they can't misread, and lets crew check every tray offline in the galley. It finds a safe meal on board for a last-minute request. It must look like an ops product JAL could pilot on DEL→NRT tomorrow.

Judging: Technical 30 · Problem 20 · Innovation 20 · Feasibility 20 · Impact 10. Every demo step below maps to a rubric line and to a module.

## Demo story (about 4 min, replayed by the scenario clock in `/demo`)
| Act | Sim time (IST) | What the judges see | Modules |
|---|---|---|---|
| 0 Hook | – | Boarding pass JL740 DEL→NRT · 23C · meal "?" · "HNML = Hindu meal = contains chicken" | m11 |
| 1 Before the journey | 23 Oct 18:10 | Priya's phone: presets + "what don't you eat" → summary chips → **AVML + kitchen note "no onion, no garlic"** + what the code loses. Ops shows a WRONG_CODE alert for Anil Verma (vegetarian booked on HNML). | m3, m1, m4 |
| 2 Night before | 24 Oct 23:02 | Ops console: ADL arrives after an IndiGo-codeshare rebooking. LOST_MEAL alert for 23C with the raw PNL/ADL diff and **1 h 38 m to the caterer list**. Staff approve "request again" → SSR draft → corrected ADL → C2 fixed, SMS "your meal is restored". | m4, m5 |
| 3 Caterer | 25 Oct 00:40 | Meal list v3: diff +1 AVML, sha256, timestamp, **Acknowledge** → C3. Label sheet: big diet mark, name, booking ref, opaque QR. | m7 |
| 4 Gate | 02:50 | Ramesh Mehta (31K) asks for a Jain meal. **Matcher (CP-SAT)** checks every meal on board, reserves the spare VJML in galley 2, and lists why the AVML spare and both mains fail. Crew are alerted at boarding. | m5, m6 |
| 5 In flight | 05:20 | Crew tablet in dark cabin mode, **offline**: galley check "7 of 8 found", 27D Jain missing → sealed backup in galley 2 → scan → green. Seat scan at 23C: wrong tray red "contains onion", right tray green. JA/EN. | m8 |
| 6 After | – | Priya's C1–C5 timeline, breakpoint = codeshare rebooking 23:02 · shadow-month dashboard · backups for the next 14 days (festival-aware). | m10 |
| Live | Acts 0–1 | Judges scan the QR on `/demo` and enter their diet on their own phones (presets only). They're invited early, while the tablet is still online. Their seats light up in row 5 on the crew tablet, and the matcher finds each of them a meal. | m3, m6, m8, m11 |

## Architecture
```
 Passenger phone (/p, /j)     Ops console (/ops)     Caterer (/caterer)     Crew tablet (/crew, offline)
          │                          │                      │                       │ IndexedDB package
          └─────── React + TS (Vite, Tailwind v4, shadcn/ui, TanStack Query, 2 s polling) ───────┘
                                     │ /api (same origin)
             FastAPI · SQLModel (SQLite) · module registry · sim clock · outbox
   m1 rules engine ─ m4 PNL/ADL watcher + booking simulator ─ m6 CP-SAT matcher ─ m7 caterer lists/labels
   m8 crew package + event sync ─ m9 recipe check (dictionary + Gemini, cached) ─ m10 insights ─ m11 story
```
- **Rules decide, models only read.** The diet form maps straight to ingredient rules. Gemini only extracts recipe ingredients into a fixed schema; the rules engine decides SAFE / UNSAFE / NEEDS-HUMAN and always names the rule that fired.
- **Same rules everywhere.** `shared/rules/*.json` is evaluated by Python on the server and by TypeScript on the offline tablet. Golden vectors run in pytest **and** vitest, so both give the same answer.
- **Read-only integration.** We ingest copies of PNL/ADL Type-B text and never write to the booking system. A human approves every fix. "Request again" produces an SSR draft; the simulator then emits the corrected ADL, as if the agent had keyed it in.
- **Sim clock.** Every deadline and countdown uses `clock.now()` on the server and `useSimClock()` on the client, never wall time. `/demo` steps the story and Reset reseeds in under a second.
- **One origin for the demo.** FastAPI serves the built frontend. A Cloudflare quick tunnel gives HTTPS for phones and the iPad (camera, service worker). Fallback: laptop hotspot, or the crew view on the laptop.

Contracts: [`shared/README.md`](../../shared/README.md) (entities, who writes what) and [`shared/api.md`](../../shared/api.md) (every endpoint, its owner and its shapes). UI rules: [`docs/design.md`](../design.md).

## Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind v4, shadcn/ui, TanStack Query, React Router | One codebase for all five surfaces; fast to build |
| Offline crew | vite-plugin-pwa (service worker) + Dexie (IndexedDB) | Works in airplane mode on iPad Safari and Android Chrome |
| QR | `qrcode` (labels), `qr-scanner` (camera) + 6-character manual code | Camera is never a blocker |
| Backend | FastAPI + Pydantic v2 + SQLModel on SQLite | Same language as the solver; zero setup on 3 laptops |
| Solver | Google OR-Tools CP-SAT, greedy fallback | Exact at flight size, explainable |
| Recipe extraction | Gemini (free tier) behind a content-hash cache + Japanese dictionary pre-pass | About 1 request per sheet; the demo runs from cache |
| Forecast | numpy/scipy Poisson + newsvendor critical ratio | Explainable backup count |
| Tooling | `uv` for the Python venv (Python 3.12 on every laptop), Node 20+, pytest, vitest, Playwright | Same setup on Windows and macOS |
| Hosting | Gunagye's laptop + Cloudflare quick tunnel | Free, HTTPS, no account |

## Modules
Folder pattern: `frontend/src/modules/mN-slug/` · `backend/app/modules/mN_slug/` · `backend/tests/test_mN_*.py`. Each spec lists exactly what its module owns.

| ID | Module | Owner | Branch | Owns (paths) | Depends on | Phase | Demo-critical |
|---|---|---|---|---|---|---|---|
| m0 | foundation | Gunagye (A) | `gunagye/m0-foundation` | scaffold, `backend/app/core/`, registries, `shared/seed/` base, `frontend/src/modules/m0-home/` | none | start | yes |
| m1 | rules engine | Gunagye (B) | `gunagye/m1-rules` | `shared/rules/`, `backend/app/modules/m1_rules/`, `frontend/src/lib/rules/`, `frontend/src/modules/m1-rules/` | none | 1 | yes |
| m2 | design system | Gunagye (A) | `gunagye/m2-design-system` | `frontend/src/ui/`, `frontend/src/app/layouts/`, `frontend/src/styles/`, `docs/design.md`, `frontend/src/modules/m2-ui/` | m0 | 1 | yes |
| m3 | passenger + judge join | Shefali | `shefali/m3-passenger` | `frontend/src/modules/m3-passenger/`, `backend/app/modules/m3_passenger/` | m0, m1 (mock) | 1 | yes |
| m4 | lost-meal watcher | Bhavyam | `bhavyam/m4-watcher` | `backend/app/modules/m4_watcher/`, `shared/seed/messages/` | m0, m1 (mock) | 1 | yes |
| m5 | ops console (board, alerts, evidence) | Bhavyam | `bhavyam/m5-ops` | `frontend/src/modules/m5-ops/` | m2, m4 (mock) | 2 | yes |
| m6 | late-request matcher + `/ops/late` desk + backup sizing | Gunagye (B) | `gunagye/m6-matcher` | `backend/app/modules/m6_matcher/`, `frontend/src/modules/m6-matcher/` | m1, m3 DietPicker | 2 | yes |
| m7 | caterer portal + labels | Gunagye (lane b) | `gunagye/m7-caterer` | `frontend/src/modules/m7-caterer/`, `backend/app/modules/m7_caterer/` | m2, m4 (mock) | 2 | yes |
| m8 | crew tablet (offline) | Gunagye (A) | `gunagye/m8-crew` | `frontend/src/modules/m8-crew/`, `frontend/src/lib/offline/`, `backend/app/modules/m8_crew/`, `frontend/public/crew/` | m1, m2 | 2 | yes |
| m9 | hidden-ingredient check | Shefali | `shefali/m9-recipes` | `frontend/src/modules/m9-recipes/`, `backend/app/modules/m9_recipes/`, `shared/seed/recipes/` | m1 | 3 | yes (cached) |
| m10 | insights: Priya's timeline (shadow month is stretch) | Bhavyam | `bhavyam/m10-insights` | `frontend/src/modules/m10-insights/`, `backend/app/modules/m10_insights/`, `shared/seed/history/` | m0 events | 3 | timeline yes |
| m11 | story engine + demo control | Gunagye (B) | `gunagye/m11-story` | `frontend/src/modules/m11-demo/`, `backend/app/modules/m11_story/`, `e2e/`, `scripts/demo*.sh` | all | 3 | yes |
| m12 | polish + hardening | Gunagye (A) | `gunagye/m12-polish` | `scripts/tunnel.sh`; style-only edits anywhere in `frontend/` after the freeze | all | freeze | yes |
| m13 | pitch, video, props | Bhavyam | `bhavyam/m13-pitch` | `docs/demo-script.md` (+ final deck in the docs repo) | all | final | yes |
| m14 | group upload (stretch) | Shefali | `shefali/m14-groups` | `frontend/src/modules/m14-groups/`, `backend/app/modules/m14_groups/` | m3 | stretch | no |

**Shared zone** (add-only; see CONTRIBUTING.md), in addition to the defaults:
- `backend/app/core/`, `backend/app/main.py`, `backend/app/registry.py`
- `frontend/src/app/routes.tsx`, `frontend/src/app/nav.ts`
- `frontend/src/lib/api.ts`, `frontend/src/lib/clock.ts`, `frontend/src/lib/i18n.ts`
- `frontend/vite.config.ts`, `frontend/index.html`
- the base `shared/seed/*.json` files, `shared/README.md`, `shared/api.md`

`shared/rules/` is **not** shared zone: m1 owns it.

## Queues
Each person works top to bottom. Take the first module in your queue whose Status isn't `done`. When it's done, ship it and start the next one. Gunagye works in two lanes (two working copies; `git config team.lane a` or `b`).

| Person | Queue |
|---|---|
| gunagye (lane a) | m0 → m2 → m8 → m12 |
| gunagye (lane b) | m1 → m6 → m11 → m7 |
| bhavyam | m4 → m5 → m10 → m13 |
| shefali | m3 → m9 → m14 |

Before m0 ships (≈17:00), nobody edits files the scaffold creates. Get ready instead:
- Read your module spec.
- Bhavyam: start the flyer survey (m13 T0) and prepare the mentor questions (m13 T1). You may also start m4's parser and fixtures in **new** files only (`backend/app/modules/m4_watcher/parser.py`, `shared/seed/messages/*.txt`, `backend/tests/test_m4_parser.py`).
- Shefali: draft the passenger form copy in English, Hindi and Japanese, and write the 4 recipe-sheet texts for m9.

## Timeline (IST)
| Time | Milestone | Integration point |
|---|---|---|
| 15:40 | Plan and contracts on main | everyone has read their module spec |
| 16:00–17:30 | **Checkpoint 1** (judged: Problem 35 · Idea 30 · Business 25 · Development 10). Bhavyam and Shefali lead with the checkpoint brief in the docs repo (`06-deliverables/checkpoint-1/`). Gunagye shows the module board, the architecture and the rules engine answering live. **Use it to validate the problem with the JAL mentors** (m13 T1) and write their answers down. | Also ask about submission format, pitch length, HDMI and Wi-Fi |
| 17:00 | **m0 on main**: run it, install deps | everyone runs `/sync` and `npm run dev` |
| 17:45 | m1 Python engine + code options on main | m3, m4 and m6 replace their mocks |
| 19:30 | **Integration 1:** Acts 1–2 click through real endpoints (rough UI is fine) | everyone ships by 19:30 |
| 21:45 | Hackspace gates close for exit: be inside with chargers, the iPad and both phones | |
| 22:30 | **Integration 2:** Acts 1–5 on real endpoints; first full run from `/demo`; rough backup video v1 | everyone ships by 22:30 |
| 00:00 | **Mentorship round:** run the story for the mentors and ask the m13 Q&A questions; note their feedback in m13 | |
| 02:00 | **Feature freeze:** full story on the tunnel with the iPad offline and 3 phones joining | after this only fixes and polish |
| 02:00–05:00 | Bhavyam and Shefali rest; Gunagye polishes (m12) | |
| 05:00–07:00 | Fix list from the module notes; pitch deck (m13) | |
| 07:00 | Dry run 1 · 07:30 record the backup video · 08:00 dry run 2 | |
| 09:30 | Submit (deadline 10:00) | |
| 11:00–12:30 | **Final judging** (Technical 30 · Problem 20 · Innovation 20 · Feasibility 20 · Impact 10) | rehearse 10:00–11:00 |

Everyone ships at least every 90 minutes. Contract changes ship immediately, with a heads-up.

## Rules for this plan
- **Takeover.** If someone is stuck or away for more than 60 min on a demo-critical module, Gunagye's lane B can take it over: `/wrap` first, then the new owner merges the old branch into theirs, so no work is lost. Record it in `docs/decisions.md`.
- **Polish after the freeze.** m12 may make style-only edits (classes, spacing, copy) in any frontend module after 02:00. Owners sync before touching their files again.
- **Mocks.** Every module can run against `shared/seed` and the response shapes in `shared/api.md` before its dependencies ship. Keep mocks in your own folder, in a file called `mock.ts` or `mock.py`.

## Cut list (drop in this order)
1. m14 group upload
2. m10 shadow-month dashboard (keep the timeline)
3. m10 backup forecast (show a fixed count with the rationale)
4. m9 eval table
5. Live Gemini call (cached result only)
6. Camera scan (manual code + tap only)
7. Delay alert to the kitchen
8. Seat scan (galley check only)

Never cut: the lost-meal alert, the matcher, offline galley check, judges joining.

## Risks
| Risk | Fallback |
|---|---|
| Venue Wi-Fi or tunnel down | Laptop hotspot; crew view on the laptop (localhost is a secure origin); team phones join instead of judges |
| iPad Safari service worker or camera | Manual 6-character code and tap-to-check; Android Chrome; Shefali's Mac can inspect the iPad's Safari |
| Gemini quota or outage | Committed cache for the 4 demo sheets; a second free key |
| Someone hits a limit or falls asleep | `/wrap` keeps notes current; takeover rule above |
| Registry merge conflicts | One line per module; m0 pre-creates every route, nav entry and module folder |
| Live demo breaks | `/demo` Reset (keeps the judges; the seed epoch makes the tablet ignore old rehearsal events); scripted seed; backup video from 07:30 |
| Tunnel restarts with a new address | Rebuild the judge QR from the page address; reopen `/crew` online on the new address before going offline |
| Nobody can see the phones or iPad | Projector on Shefali's MacBook: browser screens over the tunnel + the iPad mirrored with QuickTime over a cable (works in airplane mode). Gunagye's laptop runs the server. |
