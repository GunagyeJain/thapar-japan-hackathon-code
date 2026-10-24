# m19: Smart Load

**Owner:** Gunagye (lane b, built in parallel) · **Branch:** `gunagye/m16-days` (v2 integration) · **Phase:** v2, 25 Oct 00:30–04:00 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Load for the cabin we'll actually have: demand per diet family (what passports tell us, plus a forecast for the passengers who told us nothing), a reserve sized by the newsvendor rule where a never-spoiling pouch makes almost full cover affordable, the universal plate that suits 13 of 13 diets on this route (computed live by the rules engine), and sealed-cup thali-bento spares chosen by set cover. Screen `/ops/load`. Spec: `docs/plan/v2.md`.

## Owns
- `backend/app/modules/m19_load/`, `backend/tests/test_m19_*.py`
- `frontend/src/modules/m19-load/`
- the universal-plate reserve spec in the core seed (`SPEC-BACKUP` becomes the retort universal plate) and the taxonomy tags it needs

## Provides
`GET /api/load/{flight_id}` (`shared/api.md`, `## m19`).

## Tasks
- [x] **T1 Universal plate.** Taxonomy tags (add-only): `samak` (barnyard millet, root tag like `buckwheat`, so a vrat day allows it), `makhana` (fox nut, root tag, not a tree nut), `bottle_gourd` (under `vegetable`), `rock_salt` (under `salt`), `tapioca` (sabudana, under `root_veg`). `SPEC-BACKUP` (same id, kind `backup`, 4 items at G2-B01…B04): "Universal plate (retort, shelf-stable): samak millet, makhana, lauki", tags `samak, makhana, bottle_gourd, rock_salt`. Changed in `seed_gen.py` and `shared/seed/meal_specs.json`. Still SAFE for 27D (Jain).
- [x] **T2 Coverage table.** 13 profiles × 5 candidates, every cell `engine.evaluate()`.
- [x] **T3 Demand per family**, **T4 newsvendor reserve**, **T5 sealed-cup spares**, **T6 endpoint**, **T7 `/ops/load`**, **T8 tests**.

## Done when
`/api/load/JL740-20261025` returns the documented shape with live numbers, `/ops/load` renders at 1440 px, `bash scripts/check.sh` passes.

## Notes
- **Coverage (live):** universal plate 13/13; Jain thali with dairy 10/13 (vegan, Jain no dairy, vrat fail); vrat plate (sabudana, potato, peanuts, ghee) 9/13 (vegan, both Jain, peanut allergy fail); paneer curry with rice 8/13; chicken curry with rice 4/13 + 1 needs a check (halal: chicken without certification). Profiles are m1 presets/diets: no rules, no beef, halal, vegetarian on vow days (no beef + vegetarian), lacto-veg, eggetarian, vegan, no onion-garlic, Jain, Jain no dairy (VJML), vrat, gluten free (m1 diet), peanut allergy. Screen notes: halal passengers may still ask for a certified kitchen; diabetic is checked separately.
- **Why `tapioca` and not a `sabudana` synonym:** `shared/rules/vectors.json` pins `vrat/sabudana_khichdi = NEEDS_HUMAN` (an unknown ingredient). Teaching the taxonomy the word "sabudana" would flip 25 vectors and that pin, so the tag is `tapioca` (label "Tapioca pearls (sabudana)") and the vectors stay unchanged (pytest and vitest both green, no `make_vectors` run). If m1 wants the word, re-pin and regenerate together.
- **Demand method:** families come from each passenger's rules on the flight date (`m17 service.cabin` + `rules_on`), strictest family first (fasting, Jain, vegan, veg no onion-garlic, vegetarian, eggetarian, halal, diabetic, allergies, no beef, non-veg). Unknown passengers (83 of 186) are spread by the route prior; `p90` = known + negative-binomial 90th percentile (k = 8). `loaded` = own special meals + main dishes left after everyone else in the cabin picked (each passenger picks evenly among the dishes m1 calls SAFE for them) + spares and reserve pouches SAFE for the family. Risk = p90 > loaded. Seeded result: vegetarians (18 told, 31.1 forecast, p90 39, 24 on board), halal (uncertified chicken, so paneer only: p90 21 vs 11) and veg no onion-garlic (6 vs 5) are at risk; Jain, vegan and fasting are covered because the 4 universal pouches suit them.
- **Assumptions (all in `assumptions.py`, listed on screen):** 62% of JL740 passengers are Indian travellers; Indian mix based on Pew Research Center 2021 (39% vegetarian, 81% limit meat): vegetarian 25%, no beef 38%, halal 10%, eggetarian 6%, non-veg 8%, veg no onion-garlic 4%, diabetic 4%, Jain 2%, allergies 2%, vegan 1%; Japanese and other travellers 93% no rules, 4% allergies, 2% vegetarian, 1% halal; on a fast day 3% of Indian travellers keep the fast.
- **Reserve:** late hard needs ~ Poisson(λ), λ = 1.8 × 1.3 (m6's 25 Oct group-booking factor) × 1.25 (Sharad Purnima, kept in m19's `FAST_DAYS` because m6's table doesn't list it) = 2.925. Cu = ₹35,000 (2013 Delhi consumer-commission award against JAL); Co fresh = ₹450; Co pouch = ₹20 a sector (12-month shelf life). Fresh: ratio 0.9873 → q* 7, 4.1 meals thrown away and ₹2,359 a flight. Pouch: ratio 0.9994 → q* 10, nothing thrown away, ₹152 a flight. On board now: 4 pouches, 82.8% of flights covered.
- **Sealed-cup spares:** standard veg tray = jeera rice, paneer matar, aloo gobi, raita, gulab jamun. Late-need mix (assumption): Jain 30%, vrat 30%, no onion-garlic 25%, vegan 15% of λ. Greedy set cover over a 9-cup catalogue picks makhana tomato curry ×5, lauki sabzi ×5, samak pulao ×3, fruit cup ×3, cucumber kachumber ×1 = 17 cups (p90 of each cup's pooled late needs) vs 20 if each need is stocked apart.
- **Chart:** the repo has no Recharts dependency, so the family chart is token-coloured bars (`--blue` told us, `--sky` forecast, `--grey` on board) like m6's backup forecast; no new dependency.
- Not done: `shared/README.md` still describes the old paneer backup (line 114); the m6 forecast copy still says "sealed backup".
