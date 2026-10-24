# m15: say it your way

**Owner:** Shefali · **Branch:** `shefali/m15-say` · **Phase:** late add, 22:00–01:30 IST (on main by 01:30; freeze 02:00)
**Status:** not started <!-- not started | in progress | blocked: <why> | done -->

## Goal
Indian passengers don't describe their diet in checkbox words. They say "main Jain hoon, par doodh chalega", "no onion garlic on Tuesdays", "मैं अंडा खाता हूँ पर मछली नहीं", "肉と魚は食べません". m15 lets a passenger or a judge **type or speak their diet in their own words, in any language**, and turns it into the same food-rule chips the picker uses. The passenger confirms the chips, then m1's rules pick the meal code exactly as today.

The model only reads; it never picks a code and never decides what is safe. Same principle as m9, and the pitch line: "Say it your way. We read it; the rules decide; you confirm."

Demo moment: judges joining live on `/j` (Acts 0–1) type or speak their diet in Hindi, Hinglish, Tamil or Japanese and watch their chips appear.

## Owns
- `frontend/src/modules/m15-say/` (component `SayItYourWay`, page `/say`, `i18n.ts`, `mock.ts`)
- `backend/app/modules/m15_say/` (router, dictionary pass, model call, cache), `backend/app/modules/m15_say/cache/` (committed: the demo phrases)
- `backend/tests/test_m15_*.py`
- **One block each in m3's `JudgePage.tsx`** (and `PassengerPage.tsx` if time allows) to mount the component above the `DietPicker`. m3 belongs to lane A now; Gunagye approved this one mount (see `docs/decisions.md`). Don't change anything else in m3.

## Uses (contracts it reads)
- **m1:** `taxonomy.json` (tag ids, `labels`, `synonyms_en`, `synonyms_ja`, parents), `presets.json`, `engine.resolve(word)`; `@/lib/rules` (`loadRules`, `label`, `paths`) on the client.
- **m9 (yours):** the Gemini client pattern in `backend/app/modules/m9_recipes/gemini.py` (key check, timeout, retry, `ModelUnavailable`, schema validation with pydantic) and the content-hash cache in `cache.py`. Copy or import; don't change m9's behaviour.
- **m3:** `DietValue = {presets, forbid, allow, allergens}` from `frontend/src/modules/m3-passenger/types.ts`, `toRequest()` and `toggleGroup()`/`togglePreset()` semantics in `diet.ts` (allow never contains something forbidden). `JudgePage` keeps its `diet` state and its `DietPicker`; you only call its `setDiet`.
- **m2:** `@/ui` components only (read `docs/design.md` first).
- **Gemini:** `GEMINI_API_KEY`, `GEMINI_MODEL` from `.env`. **Your key hit the free tier's 20-a-day cap today (resets about 12:30 IST).** Use a teammate's key with requests left for building, and make sure the demo never needs a live call (see T3).

## Provides (what others rely on)
- **Endpoint:** `POST /api/say/understand`
  - Request: `{text: string, lang?: "en"|"hi"|"ja"|…}` (≤ 500 characters; 422 above that or when empty)
  - Response: `{forbid: string[], allow: string[], allergens: string[], chips: Chip[], unclear: string[], source: "dictionary"|"model"|"both", cached: boolean}`
  - `Chip = {tag, kind: "forbid"|"allow"|"allergen", via: string, source: "dictionary"|"model", confidence: number}`. `via` is the words it came from, e.g. `"lahsun → garlic"` or `"Jain → onion family, root vegetables, …"`.
  - `unclear` lists phrases it couldn't map ("no spicy food"), shown as "We didn't understand: …", never guessed.
  - Every tag is a taxonomy id. `allow` never contains something `forbid` covers (same rule as `toRequest`).
- **Component:** `<SayItYourWay lang={lang} onUnderstood={(value: DietValue) => void} />`. Text box, mic button, the chips with their `via`, and "That's right". On confirm it calls `onUnderstood` with a `DietValue` (`presets: []`), so the page's own picker shows the ticks and the person can still change them.
- **Page:** `/say` (mobile layout): the component on its own plus the meal code m3's `POST /api/passenger/meal-options` picks for the confirmed rules. For testing and the pitch screenshot.
- Add the endpoint row to `shared/api.md` under a new `## m15 · say it your way` heading (add-only).

## Privacy (Q&A Q5 must stay true)
- The sentence itself is never stored in a profile, a promise, a checkpoint or the database. Only the confirmed tags go on, through the existing `/join` and `/profiles` calls.
- Diet names a person says ("Jain", "halal", "Hindu") may turn into rules, but they never come back as a stored preset: `presets` stays `[]`.
- The committed cache holds only the demo phrases. Live phrases may be cached in memory for the run; don't write them to disk.
- Never infer anything from the person's name.

## Tasks
- [ ] **T1 Understand endpoint (60 min).** `POST /api/say/understand`:
  1. Dictionary pass first: preset words (vegetarian/veg/shakahari/शाकाहारी, Jain/जैन, vegan, eggetarian, halal, vrat/upvas/व्रत, "no onion garlic"/"bina pyaz lahsun") give that preset's `forbid`/`allow`; ingredient words in English, romanized Hindi and Devanagari (pyaz, lahsun, anda, machhli, maans, chicken, doodh/दूध, dahi, paneer, shahad/honey, aloo, sharab, …), plus m1's `synonyms_en`/`synonyms_ja`, map to tags. Negation patterns ("no X", "X nahi", "X नहीं", "bina X", "Xは食べません", "X抜き") make it `forbid`; "X chalega", "X khata/khati hoon", "X OK", "X is fine" make it `allow`. Keep this map in your module (e.g. `words.py`), not in `shared/rules/`.
  2. Then the model with a fixed schema `{items: [{tag, kind, evidence, confidence}], unclear: string[]}`. Put the taxonomy ids in the prompt as the only allowed tags; drop any tag that isn't one, and anything below 0.6 confidence goes to `unclear`. Merge with the dictionary hits (the model's kind wins on a clash, since it reads negation better; keep both `via` strings).
  3. Cache by sha256 of the normalised text, like m9. **No key, no network or a schema error:** dictionary only, `source: "dictionary"`, never a 500.

  _Done when:_ pytest passes for at least these 8, each with the expected forbid/allow: "main Jain hoon par doodh chalega", "veg, no onion garlic", "मैं अंडा खाता हूँ पर मछली नहीं", "I eat chicken but never beef or pork", "halal please, no alcohol", "vegan, allergic to peanuts", "肉と魚は食べません", "naan nahi, Navratri vrat hai" (grains forbidden). With the key unset, all 8 still return 200 with dictionary results.
- [ ] **T2 Component + `/say` page (60 min).** `SayItYourWay`: a text box with placeholder examples in the page language, a mic button using the browser's speech recognition (`window.SpeechRecognition || window.webkitSpeechRecognition`, `lang` = `hi-IN`, `en-IN`, `ja-JP` or `ta-IN` from a small picker; hide the button when the browser has none), "Understand" → chips grouped "You don't eat" / "You eat" / "Allergies", each chip showing its `via` in small text, an × to drop a chip, the `unclear` line, then **That's right** → `onUnderstood`. A loading state for the model call (it can take a few seconds) and an error line that falls back to "Pick from the list below instead". `/say` shows the component, then the recommended meal code and kitchen note from `POST /api/passenger/meal-options`.

  _Done when:_ on a 390 px phone, typing "main Jain hoon par doodh chalega" shows the chips with their `via`, and **That's right** shows the code the rules pick (VJML today); the design.md checklist passes.
- [ ] **T3 On `/j`, offline-safe (40 min).** Mount `<SayItYourWay lang={lang} onUnderstood={setDiet} />` above the `DietPicker` in `JudgePage.tsx` (one block, behind a small "Or say it in your own words" toggle so the existing flow and the e2e test are unchanged). Commit cache files for 6 demo phrases, one per language (Hindi, Hinglish, Tamil, Gujarati, English, Japanese), and put them as tap-to-try examples under the text box so a judge with no idea what to type can tap one.

  _Done when:_ with the Wi-Fi off and the key unset, a judge on `/j` taps a demo phrase, confirms, joins and gets a seat and a meal; `npm run e2e` is still 7/7; a live phrase over the tunnel works with a key.
- [ ] **T4 Ship + notes (15 min).** `shared/api.md` row, Notes below (phrases that work, quota left, known misses), `/ship` with a heads-up that `/j` has a new optional input.

  _Done when:_ on main by 01:30, smoke green.

## Done when
On main by 01:30: a judge can join from `/j` by typing or speaking their diet in their own language, sees exactly which words became which rules, confirms, and gets a meal. It works offline for the demo phrases, and the story smoke stays green. If it isn't working by 01:30, ship only the `/say` page (no `/j` mount) and tell the user.

## Notes
_Owner's running notes._
- 24 Oct 21:40, planned by lane B (Gunagye) after the team decided the pitch needs two more new things (see `docs/decisions.md`). m16 (lane B) is the other one; it doesn't touch your files.
