# m1: rules engine

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m1-rules` · **Phase:** 1, 15:45–19:00 IST (Python engine + code options on main by 17:45)
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
The decision core. Diets are ingredient rules, not codes. Every verdict (SAFE / UNSAFE / NEEDS_HUMAN) names the rule that fired. The engine:
- maps a person's rules to the best JAL meal code, plus a kitchen note and a label mark
- flags a booked code that breaks the person's rules, e.g. JAL's non-vegetarian Hindu meal (HNML) booked for a vegetarian

Python and TypeScript give identical answers, proven by one shared vector file.

## Owns
- `shared/rules/` (`taxonomy.json`, `diets.json`, `presets.json`, `codes.json`, `vectors.json`)
- `backend/app/modules/m1_rules/`, `backend/tests/test_m1_*.py`
- `frontend/src/lib/rules/` (TS evaluator + vitest for the shared vectors)
- `frontend/src/modules/m1-rules/` (the `/rules` explorer)

## Uses (contracts it reads)
- Core `Profile` and `MealSpec` (for `{profile_id, spec_id}` requests)

## Provides (what others rely on)
- **Endpoints:** `GET /api/rules` (incl. `picker_groups`), `POST /api/rules/evaluate`, `/api/rules/code-options`, `/api/rules/check-booking`. Shapes are in `shared/api.md`.
- **Python, importable** from `app.modules.m1_rules.engine`. Used by m3, m4, m6 and m9.
  - `evaluate(forbid, tags) -> {verdict, fired}`
  - `code_options(forbid, allow) -> [CodeOption]`
  - `check_booking(forbid, code) -> {...}`
  - `label_mark(forbid, allow) -> Text`
- **TypeScript:** `loadRules()` and `evaluate(forbid, tags)` from `@/lib/rules`. m8 uses them offline.

## Tasks
- [x] **T1 Rules data (45 min).**
  - **`taxonomy.json`:** about 90 tags with parents and EN/JA/HI labels:
    - `meat` → beef, pork, chicken, mutton, …
    - `seafood` → fish → bonito, sardine, …; shellfish
    - `egg`
    - `dairy` → milk, ghee, paneer, butter, cream, cheese, yogurt
    - `allium` → onion, garlic, leek, shallot, spring onion, chive
    - `root_veg` → potato, carrot, ginger, beetroot, radish/daikon, sweet potato, taro, yam, lotus root, burdock, konjac
    - honey, gelatin, lard, animal extracts
    - `alcohol` → mirin, sake, wine
    - grains and legumes (for vrat)
    - Japan's 28 allergens
  - Keep every core tag id frozen in `shared/README.md`. Japanese labels go on every tag; Hindi labels only on presets, picker groups and diets.
  - **`synonyms_ja`** for the hidden-ingredient check: 出汁, だし, 鰹節, かつお節, 煮干し, 昆布 (safe), みりん, 酒, ゼラチン, ラード, チキンエキス, ポークエキス, ビーフエキス, 魚醤, オイスターソース, 卵, 乳, バター, はちみつ, 玉ねぎ, にんにく, 生姜, じゃがいも, 人参, 大根, …
  - **`diets.json`** (about 12): vegetarian, Jain (with dairy), Jain without dairy, no onion/garlic (sattvic), eggetarian, no beef, halal, vegan, vrat/fasting, diabetic, plus allergen sets.
  - **`presets.json`:** the 10 one-tap presets plus `picker_groups`.
  - **`codes.json`:** JAL codes with `excludes` / `may_contain` / `contains`: AVML, HNML, VJML, VLML, VGML, MOML, DBML, LSML, GFML, NLML, BLML, FPML.

  _Done when:_ a test proves every referenced tag exists and every preset maps to tags.
- [x] **T2 Python evaluator + API (35 min).**
  - Expand tags to their ancestors.
  - Verdict precedence: UNSAFE > NEEDS_HUMAN > SAFE. An unknown tag, or halal meat without certification, gives NEEDS_HUMAN.
  - `fired` carries EN/JA/HI messages and a `via` chain.

  _Done when:_ `POST /api/rules/evaluate` with the Jain preset and `[paneer, tomato, onion, garlic]` returns UNSAFE with onion and garlic fired. **Ship** (unblocks m3, m4, m6).
- [x] **T3 Code mapper + booking check (35 min).** Options are ranked by safety gaps a kitchen note can close, then by preference losses. `kitchen_note` comes from the gaps; `label_mark` is EN/JA/HI ("VEG · no onion, no garlic").

  _Done when:_
  - Priya (veg + no onion/garlic, dairy OK) → AVML recommended with `NO ONION NO GARLIC`, then VJML with preference losses dairy and root vegetables.
  - Verma (vegetarian) booked on HNML → `ok:false`, contains chicken, mutton, fish, suggested AVML.
  - Mehta (Jain) → VJML.

  **Ship.**
- [x] **T4 TypeScript parity (35 min).** `frontend/src/lib/rules/` evaluator, plus `vectors.json` with 150+ cases: every diet × typical dishes, and edge cases (Jain + dairy, vrat, dashi, gelatin, uncertified halal, combined Jain + diabetic). Both pytest and vitest read the same file.

  _Done when:_ both suites pass on all vectors and print the count. **Ship.**
- [x] **T5 `/rules` explorer (30 min).**
  - A diets table with the rules spelled out.
  - A "try it" panel: diet(s) + a dish's tags → VerdictBadge + fired rules.
  - A parity line: "N rule tests · server and offline tablet agree".

  _Done when:_ Jain vs. paneer butter masala shows UNSAFE (onion, garlic), with the vector count shown.

## Done when
m3, m4, m6, m8 and m9 call the engine instead of mocks, and the parity count is on the `/rules` page for the pitch.

## Notes
_Owner's running notes._
- **Python is on main** (`app.modules.m1_rules.engine`): `evaluate(forbid, tags, diet=None)`, `evaluate_diet(diet_id, tags)`, `combine_presets(preset_ids) -> {forbid, allow}`, `code_options(forbid, allow)`, `check_booking(forbid, booked_code)`, `label_mark(forbid, allow)`, `resolve(word)`, `rules_payload()`. Unknown forbid/allow ids raise `UnknownTagError` (a `ValueError`).
- **Dish tags may be Japanese or English words**: `evaluate` maps `synonyms_ja`/`synonyms_en` to tags, so m9 can pass `出汁` straight in (`via: "出汁 → bonito → fish → seafood"`). Unknown words give NEEDS_HUMAN (`rule_id: "unknown_tag"`).
- **Fired** carries an extra `effect` (`UNSAFE` or `NEEDS_HUMAN`) so the UI can colour each line. One fired rule per dish tag. Rule ids: `forbid.<tag>`, `unclear.<tag>` (dish says only "meat" and beef is forbidden), `halal.certification`, `unknown_tag`.
- **Halal** is the forbid tag `non_halal_meat`; any meat without the `halal_certified` property tag gives NEEDS_HUMAN.
- **Code mapper**: a forbidden family the code doesn't exclude is a gap. Gaps listed in `codes.json` `note_phrases` can be closed by a kitchen note; anything else (meat, dairy, the whole root-vegetable family) rules the code out. Remaining codes sort by preference losses, then gaps; options another option beats on both counts go last. That gives Priya AVML + `NO ONION NO GARLIC`, then VJML (loses dairy, root vegetables).
- `check_booking` returns `{ok: true, kitchen_note}` when the booked code works (note may be null), else `{ok: false, problem: {contains, message}, suggested_code}`.
- **Spec certificate**: `engine.spec_tags(spec.tags, spec.certified)` adds `halal_certified` for certified specs; use it before `evaluate` (the `{profile_id, spec_id}` endpoint does).
- **TypeScript** (`@/lib/rules`): `loadRules()`, `evaluate(forbid, tags, diet?)`, `evaluateDiet()`, `combinePresets()`, `resolve()`, `label(tag, lang)`. Same answers as Python on every vector.
- **`/rules` page**: Try it (presets + tonight's seed dishes + free ingredient words, EN/HI/JA), server-vs-offline agreement line, diets and meal-code tables. Uses m2's `ui/VerdictBadge`.
- **Honey is its own family** (not under sugar), so a dish tagged `sugar` doesn't make a Jain check ask about honey. Diabetic forbids `sugar` and `honey`.
- **Codes follow JAL's own pages** (EN and JA, retrieved 24 Oct 2026): names as JAL publishes them (e.g. AVML "Vegetarian Hindu meal (Asian)", HNML "Non-vegetarian Hindu meal" / 「ヒンズー教対応のお食事 NO BEEF/NO PORK」), HNML contains lamb, chicken, fish and dairy, MOML also excludes shellfish and squid (no scales or fins), GFML excludes nuts. Where JAL doesn't promise something we no longer assume it: AVML and BLML may contain alcohol, VGML may contain honey (so vrat gets NO ALCOHOL and vegan NO HONEY as kitchen notes).
- **Vectors**: `cd backend && python -m app.modules.m1_rules.make_vectors` rewrites `shared/rules/vectors.json` (625 cases; hand-checked verdicts are pinned in the script).
