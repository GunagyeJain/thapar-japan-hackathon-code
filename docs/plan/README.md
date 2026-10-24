# docs/plan: how the build plan is written

The plan is what lets three people build at the same time without blocking or overwriting each other.
Whoever writes it should follow this shape. The scripts and team rules depend on it.

## Files
| File | Holds | Who edits |
|---|---|---|
| `PLAN.md` | Goal, demo story, architecture, stack, **module table**, timeline, cut list | Written once; changed later only on purpose (`docs(plan): ...`) |
| `modules/m<N>-<slug>.md` | One spec per module, from `modules/_template.md` | **Only the module's owner** (task checkboxes, status, notes) |
| `../../shared/README.md` | The contracts: data schema, API endpoints, events, seed data | Shared zone, add-only (see CONTRIBUTING.md) |

Module file names give the branch names: `modules/m3-crew-scan.md` → branch `gunagye/m3-crew-scan` (`bash scripts/start.sh gunagye m3`).

## Rules for a plan that runs in parallel
1. **M0 foundation comes first, owned by one person, kept short (≤ 90 min).** It scaffolds the stack, writes contracts v1 + seed data in `shared/`, creates an empty folder and route/registry entry for every module, wires real commands into `scripts/check.sh`, and fills in README "Run it". Ship it before anyone writes module code. Meanwhile the other two prepare: read their module spec, mock data, UI sketches, research, demo script.
2. **Split into vertical slices with separate folders.** Each module owns its own folders (e.g. `frontend/src/modules/m3-crew-scan/`, `backend/app/modules/m3_crew_scan/`). Every path in the repo has exactly one owner or is in the shared zone. Two modules never own the same file.
3. **Contracts before code.** Every data shape or endpoint that crosses a module boundary is defined in `shared/` during M0. A module mocks what it depends on until the real thing ships, so nobody waits.
4. **Tasks are ≤ 90 minutes, and each has a check you can verify:** a command, a URL, a test, or a screen to look at. One finished task = one ship.
5. **Fixed integration points in the timeline**, e.g. everyone ships by the top of every second hour, plus a feature freeze before demo prep and a backup demo recording on the evening of day 1.
6. **Mark the demo-critical path.** Anything not on it goes on the cut list, in the order we'd drop it.
7. **One active module per person.** The final phase has an integration/demo module (end-to-end flow, seeded demo scenario, demo script) owned by one person.
8. **Status lives in module files, not in PLAN.md.** Then nobody edits the same status table, and status never causes a merge conflict.

## Module table format (in PLAN.md)
| ID | Module | Owner | Branch | Owns (paths) | Depends on | Phase |
|---|---|---|---|---|---|---|
| m0 | foundation | ... | `<name>/m0-foundation` | scaffold, `shared/` v1 | none | start |
