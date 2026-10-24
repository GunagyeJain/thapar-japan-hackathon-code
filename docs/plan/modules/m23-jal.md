# m23: JAL booking site + brand palette

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m22-seatback` · **Phase:** v2 additions, 25 Oct before the 09:30 submission
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Show ThaliBento inside JAL's own booking: `/jal` looks and works like JAL's site (our own code, JAL's layout and colours, a text wordmark and a Demo tag). My Booking finds a booking by reference + last name, Special meal opens our tick-box form, Save gives the code and kitchen note, and the Calendar Radar asks its one question on the same page. Act 1 of the story runs here. No chat: a form is quicker for passengers.

## Owns
- `frontend/src/modules/m23-jal/` (`/jal`, `/jal/booking`, `/jal/meal`)
- add-only: the JAL palette, the `.jal-site` colours and the light crew tablet in `frontend/src/styles/tokens.css`; the brand boot script and `noindex` in `frontend/index.html`; `BrandToggle.tsx` in m11; the `web` surface; JAL's logo (`frontend/src/app/layouts/jal-logo.svg`) in `Brand.tsx` on staff screens only

## Uses
- m3 `GET /api/passenger/lookup` and the `DietPicker`; m17 `GET /api/passport/booking/{id}`, `GET/POST /api/passport` (source `form`), `POST /api/radar/answer`, the passenger's notifications; m0 flight and passengers; the public fast-day calendar.

## Notes
- **Flow:** `/jal` (My Booking: `6XK2QP` · `SHARMA`, a "Demo booking" link fills it) → `/jal/booking?passenger=PX-0057` → Special meal → `/jal/meal?passenger=PX-0057`: Vegetarian, Onion & garlic, Purnima fast → Save meal → AVML + NO ONION NO GARLIC → "Your JL740 on Sun 25 Oct falls on Sharad Purnima. Keeping the fast?" → Yes → the fasting note. Flight tickets runs a dummy search (JL740) whose Select opens the sample passenger's booking; Flight status reads JL740 live.
- **Special days** (`specialDays.ts`): Purnima, Ekadashi and Navratri fasts become date rules with `confirm: true` (the Radar asks before it changes a meal); "Veg on Tuesdays/Mondays" become weekday rules.
- **Not copied from jal.co.jp:** no HTML, CSS, images or logo on `/jal`; the page has a Demo tag and a one-line footer, and no login, payment or personal-data fields. JAL's logo (official SVG, read from jal.co.jp in the browser) appears only in the staff tools' header, as the user chose.
- **Palette (25 Oct, after review):** JAL brand = ink navy `#14213D`, one blue accent `#1D4FA3`, neutral page `#F6F7F9`, red only for status and JAL's logo; `/jal` alone uses JAL's site colours (`.jal-site`: black text, red `#CC0000` pills). The crew tablet and seat screens are light. AA: text 15:1+, accent 7.8:1, grey 6.3:1, white on red 5.9:1.
- **Checks:** `jal.test.ts`; the story smoke's Act 1 runs this flow.
