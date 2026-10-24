# ThaliBento · JAL-PS-01

Prototype for the **Thapar Japan Hackathon 2026** (offline round, 24–25 Oct, TIET Patiala).
Track: **In-Flight Hospitality & Dietary Intelligence** (Japan Airlines).
Team **Caffeinated Nerds**: Bhavyam Misra · Gunagye Jain · Shefali Sharma.

## Repo layout
```
frontend/   web app(s); each module gets its own folder (set up in M0)
backend/    API, rules and solvers; each module gets its own folder
shared/     contracts every module builds against: data schema, API types, seed data
docs/
  plan/     PLAN.md (master plan) + modules/ (one spec per module, kept up to date by its owner)
  changelog.md   one line per ship to main (written by scripts/ship.sh)
  decisions.md   dated decisions
scripts/    team git helpers: start, sync, ship, radar, check
```

## Run it
_Module M0 (foundation) fills this in once the stack is scaffolded: install, env setup, dev servers, demo data._

## How we work
Full rules are in [CONTRIBUTING.md](CONTRIBUTING.md). Short version:
```bash
bash scripts/start.sh <your-name> <module>   # once per module, e.g. gunagye m3
# ...code, commit...
bash scripts/sync.sh                         # pull in teammates' shipped work
bash scripts/ship.sh "what works now"        # merge your branch into main
bash scripts/radar.sh                        # who is on what, and any overlaps
```
