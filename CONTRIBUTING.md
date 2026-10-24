# How we work

Three people build three modules at the same time. `main` must always run, because it's what we demo.

## The 6 rules
1. **Never commit on `main`.** Each person works on their own branch and ships it into `main` with `scripts/ship.sh`.
2. **One branch per person per module:** `<name>/<module>`, e.g. `gunagye/m3-crew-scan`. Create it with `scripts/start.sh`. Switching module means a new branch.
3. **Stay in your lane.** Edit only the paths your module owns (the `Owns:` list in `docs/plan/modules/<module>.md`). Shared files follow the shared-zone rules below.
4. **Ship small, ship often:** every time something works, aim for every 60–90 min. Small diffs merge cleanly; a branch that sits for half a day turns into a conflict.
5. **Sync before you start, before you ship, and whenever main moves:** `scripts/sync.sh`.
6. **Contracts first.** A change to `shared/` (schema, API types, seed data) gets shipped on its own, right away, with a heads-up.

## Commands
| You want to | Run |
|---|---|
| Start or continue a module (first time: add your name) | `bash scripts/start.sh gunagye m3`, later just `bash scripts/start.sh m3` |
| See who is working on what, and where you overlap | `bash scripts/radar.sh` |
| Get teammates' shipped work into your branch | `bash scripts/sync.sh` |
| Run the checks | `bash scripts/check.sh` |
| Put your work into main | `bash scripts/ship.sh "what works now" "optional heads-up"` |

On Windows, run these in **Git Bash** (it comes with Git for Windows).

## The loop
```
start ─► code ─► commit ─► (main moved? sync) ─► ship ─► keep coding on the same branch
```
- **Commit** after each working step: `git add -A && git commit -m "feat(m3): scan QR from camera"`.
- **Push your branch** whenever you like (`git push`). It's your backup and only touches your branch.
- **Ship** when a task in your module file works. Afterwards your branch matches `main` and you keep going on it.

## What ship.sh does
1. Stops if you have uncommitted changes (exit 3) or you're on `main`.
2. Merges the latest `main` into your branch. On a conflict it stops (exit 2): resolve, commit, run ship again.
3. Runs `scripts/check.sh`. If a check fails it stops (exit 4): fix, commit, run ship again.
4. Pushes your branch, then creates the merge into `main` on GitHub with one line added to `docs/changelog.md`.
5. If someone else shipped at the same moment, it pulls their work, re-checks and retries.
6. Moves your branch forward to the new `main`.

It never force-pushes, rebases or rewrites history.

## Commit messages
`<type>(<module>): <what>`, present tense, max ~72 characters.
Types: `feat` `fix` `refactor` `test` `docs` `style` `chore`. Example: `fix(m2): backup count ignores cancelled seats`.
No trailers or sign-off lines. Your git name and email identify you, so set them once: `git config --global user.name "Your Name"`.

## Ownership and the shared zone
Every path belongs to exactly one module, unless it's in the **shared zone**:
- `shared/`: contracts (data schema, API types, seed data)
- dependency manifests: `package.json`, `requirements.txt`, `pyproject.toml`, and their lockfiles
- app registries: the route list, nav menu, module index (one line per module)
- root config files, `README.md`, `docs/changelog.md`, `docs/decisions.md`

Shared-zone rules:
- **Add, don't rewrite.** Add your line, field or dependency. Don't reorder, reformat or rename what's there.
- **Contracts only grow.** Add new optional fields; never remove or rename a field someone else uses. If a breaking change is unavoidable, agree on it in the team chat first.
- **Ship contract changes immediately**, with a heads-up: `bash scripts/ship.sh "add seat field to Promise" "Promise.seat is new, optional"`.
- Need something changed in **someone else's module**? Ask them, or mock it on your side until they ship it.

## Merge conflicts
`sync.sh` and `ship.sh` print each conflicted file with the rule to use. In the files, `<<<<<<<` is your side, `|||||||` the common ancestor, and `>>>>>>>` main's side.

| File | Resolution |
|---|---|
| Lockfile (`package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, ...) | `git checkout --theirs -- <file>`, reinstall to regenerate it, `git add` |
| `docs/changelog.md`, `docs/decisions.md` | Keep both sides' lines (usually resolved automatically) |
| Manifest (`package.json`, `requirements.txt`) | Keep both sides' additions; on a version clash keep the higher version |
| Registry (routes, nav, module index) | Keep both entries |
| `shared/` contract | Combine both changes; never drop something main added |
| A file in **your** module | Keep yours, plus whatever main changed in it (often a contract update) |
| A file in **someone else's** module | Take main's version: `git checkout --theirs -- <file>` |
| Real logic clash in shared code | Make both behaviours work. If they truly can't both be true, ask the other person |

Then check that no markers are left, run `bash scripts/check.sh`, and `git add -A && git commit --no-edit`. Re-run the sync or ship.

## Heads-ups
If your ship changes anything for the others (new dependency, new env key, contract change, renamed route or command), pass a heads-up as the second ship argument. It goes into `docs/changelog.md` and the merge commit, and `sync.sh` shows it to everyone.

## Secrets and environment
- `.env` files never go into git. `.env.example` lists every key with a dummy value. Real keys are shared in the team chat.
- Don't commit generated folders (`node_modules/`, `dist/`, `.venv/`), and no files over 10 MB.

## Never
- force-push, `git rebase` on a pushed branch, `git reset --hard`, or `--no-verify`
- commit directly on `main`, or delete someone else's branch
- reformat or move files you don't own

## When something looks wrong
| Message | Fix |
|---|---|
| "Push rejected" / "main kept moving" | Someone shipped first. Run ship again |
| "You're not on a branch" | `bash scripts/start.sh <module>` |
| "Uncommitted changes on main" | `bash scripts/start.sh <module>` moves them to your branch |
| "Local main has commits that aren't on GitHub" | `bash scripts/start.sh <module>` moves them to your branch |
| Auth or permission error on push | Run `git push` once in Git Bash and sign in through the browser window |
