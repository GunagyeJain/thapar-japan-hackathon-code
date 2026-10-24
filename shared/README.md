# shared/: contracts

Everything more than one module depends on goes here: the data schema, API endpoint shapes, event names, enums, and seed/demo data.
Module M0 writes v1. After that it's **shared zone** (CONTRIBUTING.md): add-only, ship right away, include a heads-up.

## Contents (filled by M0)
| File | What |
|---|---|
| _e.g. `schema.json` / `types.ts` / `models.py`_ | _core entities and fields_ |
| _e.g. `api.md`_ | _every endpoint: method, path, request, response, owner module_ |
| _e.g. `seed/`_ | _demo flight, passengers, menus_ |

Contract changes are announced through the ship heads-up, so they show up in `docs/changelog.md` and in everyone's next sync.
