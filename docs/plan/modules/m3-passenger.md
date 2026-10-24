# m3: passenger + judge join

**Owner:** Shefali · **Branch:** `shefali/m3-passenger` · **Phase:** 1, 17:00–19:30 IST (after m0 is on main)
**Status:** not started <!-- not started | in progress | blocked: <why> | done -->

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
- [ ] **T1 Backend (40 min).**
  - `lookup`.
  - `profiles`: creates Profile + MealPromise, writes **C1** via `events.record_checkpoint`. It calls `check_booking` and raises WRONG_CODE when the booked code breaks the rules.
  - `join`: next free seat in row 5 (A C D G H K), then row 20; sets `is_judge`; C1.
  - Tests.

  _Done when:_ `pytest backend/tests/test_m3_*.py` passes, and two calls to `POST /api/join` return seats 5A then 5C.
- [ ] **T2 DietPicker + DietSummary (45 min).** Uses `mock.ts` until `/api/rules` is live, then switches to it with one change in `mock.ts`. EN/HI/JA labels.

  _Done when:_ at 390 px, tapping "Jain" ticks meat, fish, egg, onion/garlic, root vegetables and honey; unticking works; the summary updates.
- [ ] **T3 `/p` flow wired (50 min).** Steps 1–7 against the real API (m1 mocked if needed).

  _Done when:_ Priya's flow ends with "AVML + NO ONION NO GARLIC", her promise appears in `GET /api/flights/JL740-20261025/passengers?with_promises=true`, and a C1 event exists.
- [ ] **T4 `/j` judge join (35 min).** Short URL, fast on a phone, MatchResult slot.

  _Done when:_ three phones on the tunnel URL join and get 5A, 5C, 5D within 2 s each.
- [ ] **T5 Languages + states (20 min).** Hindi and Japanese strings for every step, plus loading, error and retry states, following `docs/design.md`.

  _Done when:_ all three languages fit at 390 px with no overflow.

## Done when
Act 1 runs live on a phone, and a judge can join from a QR in under 30 seconds.

## Notes
_Owner's running notes: what's mocked, open questions._
