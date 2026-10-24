# m3: passenger + judge join

**Owner:** Shefali · **Branch:** `shefali/m3-passenger` · **Phase:** 1, 17:00–19:30 IST (after m0 is on main)
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Where it stands
_Updated 24 Oct 18:40 IST by Shefali. Read this first; the Notes below are the history._

**Shefali's queue:** m3 `done` → m9 `done` → m14 cut. Every module in the queue is finished. Nothing in progress: waiting for the team to say what's next. Before dry run 1 (07:00): read Bhavyam's Q&A sheet (docs repo `06-deliverables/final-pitch/qa-sheet.md`).

| | |
|---|---|
| **State** | `done`. T1–T5 shipped. `/j` now shows m6's `MatchResult` (compact). Demo-ready: yes |
| **Changed by someone else** | Gunagye (lane A) reworked the diet picker (commit `3fafd27`). Reviewed 18:26: two bugs, see the last note. One is fixed here (stale match on `/j`); one is in m6 and needs Gunagye (lane B) |
| **Waiting on others** | **Gunagye (lane B, m6):** the late-request desk drops allergies (last note). Still open on main at 18:40. **Gunagye (m6):** `MatchResult` has English-only text ("Galley", "CP-SAT · … meals checked") and the Japanese ladder labels break mid-word at 375 px ("通常メニ／ュー") |
| **Open, not started** | 1. Japanese copy needs a native speaker's read. 2. Passenger messages arrive in English because m4 writes them (`Profile.lang` is saved) |
| **Others waiting on m3** | Nothing known |

## Goal
Act 1 of the demo, plus the moment judges take part.
- **Priya** finds her booking, picks a language, gives consent, taps her diet once, and sees it turned into **AVML + kitchen note "no onion, no garlic"** along with what the code loses.
- **Judges** scan a QR, enter a diet on their own phone, and get a seat on JL740 and a safe meal found on board.

## Owns
- `frontend/src/modules/m3-passenger/` (pages `/p` and `/j`, `DietPicker`, `DietSummary`, `i18n.ts`, `mock.ts`)
- `backend/app/modules/m3_passenger/`, `backend/tests/test_m3_*.py`

## Uses (contracts it reads)
- **m1:** `GET /api/rules` (presets, picker_groups, labels), `POST /api/rules/code-options`, `POST /api/rules/check-booking`. In Python, `app.modules.m1_rules.engine.code_options` and `check_booking`. **Until m1 ships (~18:00), use `mock.ts`** with 8 presets, the picker groups and one fixed code option.
- **m0:** core `Passenger`, `Profile`, `MealPromise`, `events.record_checkpoint`, `alerts.raise_alert`, `GET /api/notifications?to=<passenger id>`.
- **m6 (from ~22:00):** `POST /api/late-requests` and the `MatchResult` component from `frontend/src/modules/m6-matcher/MatchResult.tsx`. Until then, show "Crew will confirm your meal on board".
- **m2:** components from `@/ui` and `docs/design.md`. Use shadcn base components from m0 until m2 ships (~18:30).

## Provides (what others rely on)
- **`DietPicker`** (`frontend/src/modules/m3-passenger/DietPicker.tsx`), used by m5 (late-request desk) and m14.
  - Props: `{value: {presets: string[], forbid: string[], allow: string[]}, onChange(value), lang: "en"|"hi"|"ja", compact?: boolean}`.
  - A row of presets, then checkbox groups from `picker_groups`, then allergens. Tapping a preset ticks its tags; the user can untick.
- **`DietSummary`** chips ("No meat, fish, egg · No onion or garlic · Dairy OK"), same folder.
- **Endpoints:** `GET /api/passenger/lookup`, `POST /api/profiles`, `POST /api/join`. Shapes are in `shared/api.md`.

## Screens
**`/p` (mobile, MobileLayout, boarding-pass header):**
1. Find your booking: PNR + surname. Demo hint "6XK2QP · SHARMA".
2. Language: EN / हिन्दी / 日本語.
3. Consent: three toggles (this trip / save for next time / share with the caterer), plus this notice: "Your food rules go to JAL and its caterer in Delhi and Tokyo. We store food rules, not religion. Deleted after your trip."
4. DietPicker.
5. Summary: chips + "Is this right?"
6. Result:
   - the recommended code card: code, kitchen note, and a tray-label preview with the big diet mark
   - the alternative, with what it loses
   - if the booked code clashes (e.g. HNML for a vegetarian), a red card: "Your booking has HNML. It contains chicken or fish. We'll change it to AVML."
7. Confirm → "Your meal promise" page showing the latest notifications: "restored after rebooking", "Jain meal reserved: galley 2", or a voucher.

**`/j` (judges):** a name (display only, e.g. "Judge 1"), language, consent, DietPicker, confirm → a boarding-pass card (JL740 · seat 5A · diet mark) → calls `/api/late-requests` → `MatchResult` (or the placeholder).

## Tasks
- [x] **T1 Backend (40 min).**
  - `lookup`.
  - `profiles`: creates Profile + MealPromise, writes **C1** via `events.record_checkpoint`. It calls `check_booking` and raises WRONG_CODE when the booked code breaks the rules.
  - `join`: next free seat in row 5 (A C D G H K), then row 20; sets `is_judge`; C1.
  - Tests.

  _Done when:_ `pytest backend/tests/test_m3_*.py` passes, and two calls to `POST /api/join` return seats 5A then 5C.
- [x] **T2 DietPicker + DietSummary (45 min).** Uses `mock.ts` until `/api/rules` is live, then switches to it with one change in `mock.ts`. EN/HI/JA labels.

  _Done when:_ at 390 px, tapping "Jain" ticks meat, fish, egg, onion/garlic, root vegetables and honey; unticking works; the summary updates.
- [x] **T3 `/p` flow wired (50 min).** Steps 1–7 against the real API (m1 mocked if needed).

  _Done when:_ Priya's flow ends with "AVML + NO ONION NO GARLIC", her promise appears in `GET /api/flights/JL740-20261025/passengers?with_promises=true`, and a C1 event exists.
- [x] **T4 `/j` judge join (35 min).** Short URL, fast on a phone, MatchResult slot.

  _Done when:_ three phones on the tunnel URL join and get 5A, 5C, 5D within 2 s each.
- [x] **T5 Languages + states (20 min).** Hindi and Japanese strings for every step, plus loading, error and retry states, following `docs/design.md`.

  _Done when:_ all three languages fit at 390 px with no overflow.

## Done when
Act 1 runs live on a phone, and a judge can join from a QR in under 30 seconds.

## Notes
_Owner's running notes: what's mocked, open questions._
- **Changed by lane B at 19:30 (Q5 privacy fix, Gunagye's request):** `_save` stores `presets = []` (food rules only; the tapped quick picks stay on the phone), and C1 reads "Profile saved: <food-rule mark> → <code>". `ProfileIn.presets` is still accepted, never stored. Judges' "Change my answers" refills the ticks from forbid/allow; the quick pick isn't highlighted. Test: `test_profile_keeps_food_rules_not_diet_names`.
- T1 done: lookup, profiles (C1, WRONG_CODE when the booked SSR breaks the rules, saving again updates the same promise) and join (seat lock, so judges joining at once never share a seat). A passenger with no SSR gets no WRONG_CODE.
- T2: no mock needed. The picker reads presets, picker groups and the tag tree from `loadRules()` (the same shared/rules JSON the server uses), so it works instantly on a slow phone. It understands parents: Jain forbids `allium`, which ticks "Onion & garlic"; unticking it keeps leek, shallot, spring onion and chive. Allergies live in `DietValue.allergens` (optional) and are sent as forbidden too. The meal code always comes from the server (`/api/rules/code-options`).
- T3/T4 checked at 390 px: Priya ends on AVML + NO ONION NO GARLIC with C1; Verma (HNML) gets the red card and a WRONG_CODE alert; three joins at once get 5A, 5C, 5D in under 10 ms each.
- `/j` calls `POST /api/late-requests` after joining and shows m6's explanation; until m6 ships it shows "Crew will confirm your meal on board". Swap in m6's `MatchResult` component when it lands.
- `/j` remembers the join on the phone (one seat per device). After a reset without judges, the phone shows the join form again.
- T5 done: every /p step checked at 390 px in Hindi and Japanese (also the 28-allergen list, the consent warning, the not-found error and a live update), with no overflow. Japanese labels wrap only before "（" or after "・". The boarding-pass date follows the language (10月25日, 25 अक्टू॰).
- Open: notifications are written by the sending module in English (e.g. m4's "Your meal is back on JL740"), even when Profile.lang is hi or ja. The /p page shows them as sent.
- Hindi and Japanese copy is a first draft: get a native speaker to read the Japanese before the demo.
- 17:50 (lane A, after the first real phone test): the picker is now three plain questions with one tile style: "Do you follow a diet?" (optional; "No beef" and "No onion, no garlic" moved into the food list), "What can't you eat?" (Beef, Pork, Chicken, All meat, then m1's groups), "Any food allergies?". A live "Your answer so far" summary sits under it, and a disabled button always says why. The old "Tick at least one thing you don't eat" error came from combinations no meal code covers; those now get `SPML` + a kitchen note (`POST /api/passenger/meal-options`). `/j` has "Try a different diet" (same seat, old meal released, fresh match); `/p` has "Change my answers" after saving. Judges' allergies are sent as `allergens`.
- 18:26 `/j` shows m6's `MatchResult` (`compact`) instead of the plain explanation: tier ladder, the chosen meal with its galley position, the why, and the solver line. Checked at 375 px in Japanese: joined as a vegetarian judge, got 5C with a Jain thali from galley 1.
- 18:26 review of lane A's picker rework (`3fafd27`). The three questions, the SPML fallback and the same-seat rejoin all work. Found:
  1. **Fixed here:** after "Try a different diet", saving the same food answers (or changing only what's allowed) reused the cached match, because the late-request query key only had `forbid` and `staleTime` is Infinity. The server had already released that meal and deleted the late request, so the judge saw a meal that was no longer reserved. Now a save drops the old match and the key includes `allow`.
  2. **For Gunagye (lane B, m6):** `LateDesk.tsx` sends `diet.forbid` only. Since the rework, the picker keeps allergies in `diet.allergens`, so allergies ticked at the desk never reach the matcher, and an allergy-only request can't be sent. Fix: send `toRequest(diet)` from `@/modules/m3-passenger/diet` (forbid with allergens merged).
  3. **Worth a look, not urgent:** `_release_judge_meal` in m3's router imports m6's `LateRequest` and deletes its rows, and resolves its alerts. It works, but m3 now writes m6's tables; a `release(passenger_id)` helper in m6 would keep that in one place.
- 19:17 `/j`: while a judge changes their answers, the boarding pass now shows their current meal code instead of "Not set" (row 12 of the screen review in the m9 file).
