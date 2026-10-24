# m9: hidden-ingredient check

**Owner:** Shefali · **Branch:** `shefali/m9-recipes` · **Phase:** 3, 22:30–01:30 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Where it stands
_Updated 24 Oct 18:40 IST by Shefali. Read this first; the Notes below are the history._

**Shefali's queue:** m3 `done` (fixing open item 1 now) → **m9 `done`** → m14 cut.

| | |
|---|---|
| **State** | `done`. T1–T4 shipped. Demo-ready: yes. `/caterer/recipes` goes photo → verdicts → approved meal spec; the 4 demo sheets work with Wi-Fi off (cached). The **Accuracy** tab has the eval table |
| **Pitch numbers** (12 sheets all three readers have read, vegetarian) | Dictionary finds 11 of 13 hidden families (85%), 2 false alarms. Model: 12 of 13 (92%), 0 false alarms. Both together: 13 of 13 (100%), 2 false alarms (the dictionary's). Say it's a hand-labelled stress set, not a random sample |
| **Left** | 11 of the 23 eval sheets aren't read by the model yet: the free tier allows **20 requests a day** and today's are used up (resets about 12:30 IST on 25 Oct). Then run `cd backend && .venv/bin/python -m app.modules.m9_recipes.evaluation --fill` and commit the new cache files. Until then the tab says how many sheets are compared |
| **Setup each laptop needs** | `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash` in `.env` (as in `.env.example`), only for new (uncached) sheets |
| **Demo risk** | Today's quota on Shefali's key is used up, so a live **uncached** photo falls back to "model offline" until it resets. Use the 4 cached demo sheets, or another teammate's key |
| **Waiting on others** | Nothing |
| **Others waiting on m9** | Nothing known. Approved dishes become `MealSpec` rows (`SPEC-R-…`, source `recipe_check`) |
| **For m2** | VerdictBadge's "N rules" link is English-only, so it stays English on the Japanese page |

## Goal
The deck's page-4 promise. On the Tokyo→Delhi leg the food is cooked in Japan, and fish often hides in the soup stock. The caterer uploads a **Japanese recipe sheet**:
1. A Japanese dictionary pass, plus Gemini, extracts the ingredients into a fixed schema.
2. Our rules decide: "出汁 dashi → 鰹節 bonito → fish: not safe for Vegetarian, Jain".
3. A person approves, and the dish becomes a certified meal spec.

The model only reads; it never decides.

## Owns
- `frontend/src/modules/m9-recipes/` (page `/caterer/recipes`, `i18n.ts`, `mock.ts`)
- `backend/app/modules/m9_recipes/` (dictionary pass, Gemini client, cache, router, `RecipeSheet` model, `seed.py`), `backend/app/modules/m9_recipes/cache/` (committed)
- `shared/seed/recipes/` (demo sheets + `eval.json`)
- `backend/tests/test_m9_*.py`

## Uses (contracts it reads)
- **m1:** `taxonomy.json` (tag ids, `synonyms_ja`) and `evaluate()`. Diets checked: vegetarian, Jain, vegan, no onion/garlic, halal.
- **m0:** core `MealSpec` (approve adds one with `source: "recipe_check"`).
- **Gemini:** the `google-genai` package with `GEMINI_API_KEY` and `GEMINI_MODEL` (default `gemini-3.5-flash`; 2.5-flash is closed to new keys) from `.env`.
  - Structured output: `response_mime_type: application/json` with a response schema `{dish_name_ja, dish_name_en, ingredients: [{name_ja, name_en, tags: [taxonomy ids], confidence: 0-1, evidence}]}`.
  - Usage is light: one request per new sheet, about 50–150 for the whole event.
- **m2:** `@/ui` components.

## Provides (what others rely on)
- **Endpoints:** `POST /api/recipes/extract`, `POST /api/recipes/{id}/approve`, `GET /api/recipes`, `GET /api/recipes/eval`. Shapes are in `shared/api.md`.

## Pipeline
1. Input: an image or text → sha256. If a cache file exists, return it with `cached: true`.
2. Dictionary pass: match every `synonyms_ja` entry in the text (for images, on the model's transcription).
3. Gemini call: image or text + the schema. Unknown tags become NEEDS_HUMAN. Merge in the dictionary hits.
4. Per-diet verdicts with `evaluate()`. Store the sheet as `needs_review`, and write the cache file.
5. **No key, or no network:** run dictionary-only, and show a "model offline: dictionary only" chip.

## Demo sheets (`shared/seed/recipes/`, each as `.txt` + `.png`)
| Dish | Hidden ingredients |
|---|---|
| 味噌汁 miso soup | 出汁 = 鰹節 (fish) |
| 野菜カレー vegetable curry | the curry roux has ポークエキス and ラード |
| きつねうどん kitsune udon | つゆ with 鰹節, 昆布 (safe) and みりん (alcohol) |
| 野菜天ぷら vegetable tempura | 卵 in the batter, 天つゆ with 鰹節 |

The PNGs are recipe cards rendered from the text (an HTML page + screenshot is fine).

## Tasks
- [x] **T1 Dictionary + verdicts on text (40 min).** Works with no model at all. Tests on the 4 `.txt` sheets.

  _Done when:_ the miso soup text shows UNSAFE for vegetarian and Jain via 出汁 → 鰹節 → fish.
- [x] **T2 Gemini + cache (40 min).** Client, schema, validation, cache, timeouts, clear errors.

  _Done when:_ with a key, the miso PNG is extracted once, and the second call returns `cached: true` in under 50 ms. The cache files for the 4 demo sheets are committed.
- [x] **T3 Page (50 min).** Upload (drag-drop an image or paste text). Result view: the sheet on the left; the ingredient table on the right (JA, EN, tags, confidence, evidence highlighted); a verdict chip per diet with the fired rule; **Approve**.

  _Done when:_ uploading the miso PNG shows the dashi flag and approve creates a MealSpec, at 1440 px.
- [x] **T4 Eval table (30 min, cut first).** `eval.json` with about 20 Japanese dishes and hand-labelled "not vegetarian" tags. Recall and precision for dictionary vs. model vs. combined.

  _Done when:_ the Eval tab shows the 3 rows with numbers.

## Done when
A Japanese recipe sheet goes from photo to verdict to approved spec in under 10 seconds live, and the demo works from cache with Wi-Fi off.

## Notes
_Owner's running notes._
- T1 done: `dictionary.py` scans every `synonyms_ja` word (longest match first, so 玉ねぎ is onion and 昆布だし is kombu; "ただし" is ignored). Ingredient lines the dictionary can't read (わかめ, 油揚げ, うどん) go through the rules as unknown → NEEDS_HUMAN, so dictionary-only never says SAFE about something it didn't read. 水/湯 lines are skipped.
- The four demo sheets are in `shared/seed/recipes/` as `.txt` and `.png` (printed cards rendered from the same text).
- T2 code is in: `gemini.py` (fixed schema incl. a `transcription` for photos, temperature 0, 25 s timeout, schema-checked answer), `cache.py` (`cache/<sha256>.json`, model answers only), `pipeline.run` (cache → Gemini → dictionary on the text or transcription → merge → verdicts). Tests stub Gemini and use a temp cache, so they never call the API or write to the repo.
- T2 done with `gemini-3.5-flash`: `gemini-2.5-flash` is closed to new keys, and `gemini-3.8-flash` took 70 to 120 s per call on our key. 3.5-flash reads a photo in about 5 to 9 s with thinking set to LOW. The 8 demo inputs (4 PNG + 4 TXT) are cached; a repeat call is about 10 ms, and a test fails if any demo sheet loses its cache file.
- Free tier is 5 requests a minute. On 429 or 503 the client retries once after 3 s, then falls back to the dictionary with the reason in `model_note`.
- Verdicts list one fired rule per forbidden family, with the Japanese word first (ラード → lard → pork). Rows nobody could read (揚げ油 frying oil, サラダ油) stay NEEDS_HUMAN on purpose.
- T3 done, checked at 1440 px in EN and JA: the miso photo (demo button or drag-drop) loads from cache in about 0.6 s, verdicts show "出汁 → bonito → fish → seafood", 出汁 and 鰹節 are marked red in the sheet, and Approve creates `SPEC-R-…` (kind main, source recipe_check). A new, uncached photo took 10.6 s live on the free tier.
- If Gemini leaves a photo's transcription empty, the sheet text is rebuilt from its evidence lines so the dictionary still checks it.
- For m2: VerdictBadge's "N rules" link is English-only, so it reads in English on the Japanese page.
- T4 done: `shared/seed/recipes/eval.json` has 23 hand-labelled sheets (the 4 demo ones plus 19 more), built around known hard cases: hidden stock (白だし, おでんだし, 削り粉), product names (ウェイパー, マシュマロ, ちくわ, ウインナー) and words that only look like an ingredient (精進だし, 野菜ブイヨン, かき = 柿, 肉桂, えび芋). A family counts as found when the rules call the dish UNSAFE for vegetarian; NEEDS_HUMAN doesn't count. `evaluation.py` builds the table from the committed cache only (never calls the model); `GET /api/recipes/eval` serves it and the Accuracy tab shows it. The three readers are scored on the same sheets (the ones the model has read).
- What the table shows: the dictionary is fooled by look-alike words (精進だし → bonito, 野菜ブイヨン → meat extract) and misses product names (ウェイパー, 削り粉). The model got those right but missed コンソメ as meat in the croquette. Combined catches everything but keeps the dictionary's false alarms, which is why a person approves every sheet.
- The free tier also has a daily cap of 20 requests (on top of 5 a minute). The eval fill hit it after 8 new sheets.

