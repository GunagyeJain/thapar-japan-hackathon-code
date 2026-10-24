# m13: pitch, video, props

**Owner:** Bhavyam · **Branch:** `bhavyam/m13-pitch` · **Phase:** final, 05:00–09:30 IST (two early tasks today)
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

### Where it stands (24 Oct, 21:36 IST)
- **T5 Q&A sheet** (docs repo `06-deliverables/final-pitch/qa-sheet.md`): question 6 now has the recipe-check numbers from Shefali's m9 line, checked against `GET /api/recipes/eval` (dictionary 79%, model 96% with 0 false alarms, both 100%; 23 hand-labelled sheets). Not ticked until Gunagye and Shefali have read it.
- **T3 deck outline** (`06-deliverables/final-pitch/v1/outline.md`): written; `[FILL 05:00]` slots still open. `deck.html` + PDF not started.
- **T2 demo script:** Gunagye shipped `docs/demo-script.md` (18:57). The deck's demo slide must follow it.
- **No survey (T0 skipped, team decision):** the deck's problem slide now uses sourced public cases only, and the pilot's month 1 is pitched as how JAL gets the failure rate. Logged in the docs repo's `08-log/decisions.md`.
- **Hook changed:** "Hindu meal has chicken" is gone from the docs repo (summary, one-pager PDF, concept, gaps). The true version: an agent can book HNML, JAL's non-vegetarian Hindu meal, for a vegetarian, and nothing checks it. Slide 2 now opens on dropped codeshare requests, diets no code can hold, and diets told in people's own words; slide 3 carries m15 and m16, marked [CHECK 02:00].
- **00:00 mentor round:** questions are in Notes below (3 on m15/m16, 3 open from T1, plus organiser items). Record answers with names and roles right after, then ship.
- **Next:** record mentor answers in Notes; at 05:00 fill the outline (mentor quote, matcher ms, recipe table) and build the deck.

## Goal
Win the room. A pitch that maps every minute to the judging rubric (Technical first), shows the live demo from `/demo`, and backs each claim with:
- sourced public cases of meals lost or wrong (no survey was run; see T0)
- what the JAL mentors told us at the checkpoint
- our own measurements: rule tests that agree on the server and the tablet, matcher speed, recipe-check results

## Owns
- `docs/demo-script.md` in this repo
- The final deck in the docs repo: `06-deliverables/final-pitch/`, built from the v5 deck source. Use the same fonts, colours and boarding-pass style.

## Uses (contracts it reads)
- Screens from every module (screenshots after the 02:00 freeze, re-taken after m12's polish)
- m11's step list for the demo order

## Provides (what others rely on)
- `docs/demo-script.md`: who says what, who clicks what, timings, and the fallback line for each act
- The submission package (whatever the organisers ask for at 10:00)

## Tasks
- [x] **T0 skipped (24 Oct, team decision): no time to run it, and we won't show invented results.** Was: flyer survey. A Google Form with 5 questions: did you pre-order a special meal; did it arrive; did you carry your own food; what did you worry about; which diet. Share it in family and college groups. Read the results at 05:00.
- [ ] **T1 (Checkpoint 1 at 16:00–17:30, and the 00:00 mentorship round; no code): ask the JAL mentors.** The talk itself follows `06-deliverables/checkpoint-1/brief.md` in the docs repo.
  - Do special meals really drop when a codeshare booking is reissued?
  - What is the real caterer cutoff at DEL?
  - Would a read-only passenger-list feed plus an add-on screen for the crew iPad app be acceptable for a pilot?

  Write their answers, with names and roles, in Notes below. Also ask the organisers: what to submit at 10:00, pitch length, projector/HDMI, and the Wi-Fi.
- [x] **T2 Demo script (45 min). Taken by Gunagye lane B at 18:38 (see docs/decisions.md); Bhavyam skips it.** `docs/demo-script.md`, following m11's steps; the 4-minute version plus a 2-minute cut.

  _Done when:_ the team can run a dry run from the script without asking anything.
- [ ] **T3 Final deck (90 min).** Problem (survey number + mentor quote) → live demo → how it works (architecture, read-only integration, rules decide) → numbers (rule-test count, matcher ms, recipe-check table) → pilot plan → team. Export the PDF.

  _Done when:_ the PDF is exported and Drive-ready.
- [ ] **T4 Backup video + props (45 min).** Record the full story from `/demo` at 07:30 (OBS, 1080p, under 4 min). Optional props: print one A4 label sheet from `/caterer/labels` and stick the labels on 3 boxes as "meal trays".

  _Done when:_ the video file is saved in two places; the labels scan.
- [ ] **T5 Q&A sheet (20 min).** One-line answers:
  - Doesn't the booking system already carry meals over on a rebooking?
  - Who pays for the backups?
  - What about the Torizen veg meals?
  - How does this overlap with i-PAXINFO?
  - Privacy: APPI and DPDP.
  - What if the model misreads a recipe? (Rules decide, and a human approves.)

  _Done when:_ every teammate has read it.

## Done when
Submitted by 09:30, rehearsed twice, and every rubric line has a slide or demo moment.

## Notes
_Mentor answers (attributed), survey results, organiser answers._
- 24 Oct 18:41 (wrap): T5 Q&A sheet and T3 outline are pushed to the docs repo (`06-deliverables/final-pitch/`). Neither is ticked: T5 waits for both teammates to read it, T3 still needs `deck.html` and the PDF.
- Not yet recorded here: survey numbers, mentor answers, organiser answers (pitch length, submission format, HDMI, Wi-Fi). The outline's `[FILL 05:00]` slots depend on them.
- To measure at 05:00 for slide 6: `solver.ms` from `POST /api/match` (the 31K Jain request) and the table from `GET /api/recipes/eval`.

### Questions for the 00:00 mentor round (answers go here right after, with name and role, then ship)
**m15 "say it your way" and m16 "diets that change by date" (lane B, before the 02:00 freeze):**
1. **m15, trust:** if a passenger types or says their diet in their own words (Hindi or English), a model turns it into food rules, the passenger confirms them, and fixed rules pick the meal code, would JAL accept that? What would you need to see first: an accuracy number, a staff check, where the model runs?
   - Answer (name, role):
2. **m16, operations:** can one booking carry a different special meal on one leg only, for example a fasting meal on the Ekadashi return flight and AVML outbound? Is that a separate SSR per segment today, and would the caterer and crew handle it without extra work?
   - Answer (name, role):
3. **m15, privacy:** if we keep only the confirmed food rules, not the passenger's words or voice, is that enough under JAL's reading of APPI and DPDP, or would free text or voice need its own consent?
   - Answer (name, role):

**Still open from T1:**
4. Do special meals really drop when a codeshare booking is reissued (IndiGo to JAL)? How often does JAL see it?
   - Answer (name, role):
5. What is the real caterer cutoff for JL740 at DEL: when does the final list go to the kitchen?
   - Answer (name, role):
6. Would a read-only copy of the PNL/ADL feed plus an extra screen in i-PAXINFO be acceptable for a pilot?
   - Answer (name, role):

**Organisers:** pitch length · what to submit at 10:00 and where · projector/HDMI · venue Wi-Fi for the demo.
   - Answers:
