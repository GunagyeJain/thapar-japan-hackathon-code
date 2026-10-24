# m14: tour-operator group upload (stretch)

**Owner:** Shefali · **Branch:** `shefali/m14-groups` · **Phase:** stretch, only after 02:00 if everything else is done
**Status:** not started <!-- not started | in progress | blocked: <why> | done -->

## Goal
Tour operators book Indian groups of 20–40 people, often older travellers who won't fill in forms. The operator uploads one spreadsheet, and every traveller gets a food-rules profile and a meal promise. The group roster then shows each person's checkpoint status on one screen.

## Owns
- `frontend/src/modules/m14-groups/` (page `/groups`)
- `backend/app/modules/m14_groups/`, `backend/tests/test_m14_*.py`

## Uses (contracts it reads)
- **m3:** `DietPicker` labels/presets and `POST /api/profiles`.
- **m1:** presets.
- **m0:** core `Passenger` (group `MANGALYATRA`, seats 33D–34G).

## Provides (what others rely on)
- **Endpoints:** `POST /api/groups/upload` (CSV) and `POST /api/groups/{id}/confirm`. Shapes are in `shared/api.md`.

## Tasks
- [ ] **T1 Upload + preview (45 min).** CSV template with columns: name, PNR, then one Y/N column per picker group, plus notes. Parse it, map rows to `forbid`/`allow`, list problems per row (unknown PNR, empty diet).

  _Done when:_ the 12-person Mangal Yatra CSV previews with 0 problems.
- [ ] **T2 Confirm + roster (40 min).** Create profiles + promises, then a roster table with each traveller's C1–C5 chips.

  _Done when:_ the roster shows 12 travellers with C1 ok.

## Done when
A group can be uploaded and seen in under a minute.

## Notes
_Owner's running notes._
