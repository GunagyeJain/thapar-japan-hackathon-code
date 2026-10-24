# m23: JAL booking concept + brand palette

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m22-seatback` · **Phase:** v2 additions, 25 Oct before the 09:30 submission
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Show where ThaliBento plugs into JAL's own booking: `/jal` is a "Manage booking → Special meal" page in JAL's colours and layout feel, with today's one-code form next to the ThaliBento passport chat. The whole product can wear the JAL palette (default) or the ThaliBento one, switched on `/demo` or with `?brand=`. A copied airline site on a public tunnel would look like phishing, so this is our own code, plainly marked as a concept.

## Owns
- `frontend/src/modules/m23-jal/` (page `/jal`)
- add-only: the JAL palette and its cabin fallback in `frontend/src/styles/tokens.css` (m2's file, agreed with lane A), the brand boot script and `noindex` in `frontend/index.html`, `BrandToggle.tsx` in m11, the `web` surface in `frontend/src/app/types.ts` + `routes.tsx`, one `nav.ts` line, "Brand themes" in `docs/design.md`

## Uses (contracts it reads)
- m17 `GET /api/passport/booking/{passenger_id}` (the booking and who is on it), m0 `GET /api/flights/{id}` and `GET /api/flights/{id}/passengers?with_promises=true` (booked code, ThaliBento promise), the sim clock.
- m1 codes from `@/lib/rules` (bundled, no request). The live `/chat` (m17) inside the page.

## Provides
- `/jal` (`?passenger=` picks another sample passenger; default PX-0057 Priya, 23C).
- `[data-brand="jal"]` on any element gives its subtree the JAL palette; `.brand-thalibento` (and every `.cabin`) keeps ThaliBento under the JAL brand.
- `BrandToggle`, `applyBrand`, `currentBrand`, `BRAND_KEY` from `@/modules/m11-demo/BrandToggle`.

## Tasks
- [x] **T1 Palette:** `[data-brand="jal"]` on the existing names (navy #1A1A1A, blue #333333, sky #8C8C8C, ice #F0F0F0, mist #F7F7F7, line #D6D6D6, grey #595959, primary #C00000, ring #1A1A1A), semantic names re-declared so the attribute works on any element; ThaliBento restored inside `.cabin` / `.brand-thalibento`. _Done when:_ `/crew` computes `--primary` #1F5FD1 under `data-brand="jal"`.
- [x] **T2 Switch:** boot script in `index.html` (`?brand=` → `localStorage tb.brand` → default `jal`; theme-color; `storage` event), Palette switch on `/demo`. _Done when:_ switching on `/demo` re-themes a second open tab without a reload.
- [x] **T3 `/jal`:** banner "Concept demo · not a Japan Airlines website" (pinned), text wordmark, booking card, today's form (12 JAL codes + kosher and minimal-allergen on the 49 h line, deadlines on the sim clock, honest "closed"), the ThaliBento panel with `/chat` embedded, footer. EN + JA. _Done when:_ it reads right at 1440 and 390 px, before and after the 25 h cutoff.
- [x] **T4 Checks:** `jal.test.ts` (deadlines, choices), `tsc`, screens.

## Done when
`/jal` shows Priya's JL740 booking with the 25 h and 49 h deadlines counting down on the sim clock, the one-code form and the live passport chat beside it; every screen opens in the JAL palette, `/demo`'s switch flips all open tabs, and `/crew` stays in the ThaliBento cabin palette.

## Notes
- **Facts used:** JAL takes special meals online until 25 h before departure (24 h by phone); kosher and minimal-allergen meals until 49 h (48 h by phone) (JAL's special-meal page, jal.co.jp/jp/en/inter/service/meal/special/menu/). JAL's red is about #C90000 (Pantone 1797C per brand write-ups, not an official JAL spec); we use #C00000 for AA with white text. Nothing was copied from JAL's site: no HTML, CSS, logo, crane or images; the wordmark is the word "JAL" in our display font.
- **Contrast (JAL palette, WCAG):** text navy on white 17.4:1, on mist 16.3:1, on ice 15.3:1; grey on white 7.0:1, on ice 6.2:1; white on the red button 6.5:1; red link on white 6.5:1; info text #333 on ice 11.1:1; silver icons on white 3.4:1 (non-text, ≥ 3:1); banner text 17.4:1 and 11.4:1. Status colours unchanged.
- **Where each palette lands:** JAL reads well on `/demo` (kept JAL: monochrome ladder, the red primary is the next step), `/ops/changes`, `/ops/load` (bars charcoal/silver/grey, so the status chips are the only colour) and `/chat`. `/crew`, like any `.cabin` screen, stays ThaliBento automatically (checked: `--primary` #1F5FD1 inside the cabin with `data-brand="jal"` on `<html>`).
- **No personal data:** no login, payment or name/email/passport inputs. The form sends nothing (it says so); only the embedded `/chat` writes, exactly as `/chat` does on its own. `noindex` is set for the whole app.
- **Known:** `text-sky` used as small text (Timeline "Note", a few crew labels) is 3.0:1 in ThaliBento and 3.4:1 in JAL: below AA in both; not changed here (m2/m8 files). The embedded chat follows the global palette, so with the switch on ThaliBento the chat inside `/jal` is navy.
