#!/usr/bin/env bash
# Bring teammates' shipped work (latest main) into your branch.
#
#   bash scripts/sync.sh
#
# Exit codes: 0 up to date / merged · 1 error · 2 merge conflict to resolve · 3 commit your changes first
set -u
. "$(dirname "$0")/_lib.sh"
cd_root

if in_merge; then
  print_conflicts
  exit 2
fi

fetch_quiet || die "Could not reach GitHub."
has_remote_main || die "GitHub has no main branch yet."
CUR=$(current_branch)
[ "$CUR" = "HEAD" ] && die "You're not on a branch. Run: bash scripts/start.sh <module>"

if [ "$CUR" = "$MAIN" ]; then
  is_dirty && die "Uncommitted changes on main. Move them to your branch: bash scripts/start.sh <module>"
  git merge --quiet --ff-only "$REMOTE/$MAIN" 2>/dev/null \
    || die "Local main has commits that aren't on GitHub. Move them to your branch: bash scripts/start.sh <module>"
  info "main is up to date."
  exit 0
fi

if is_dirty; then
  info "You have uncommitted changes. Commit them first, e.g.:"
  info "  git add -A && git commit -m \"wip(<module>): <what>\""
  exit 3
fi

BEHIND=$(git rev-list --count "HEAD..$REMOTE/$MAIN")
if [ "$BEHIND" -eq 0 ]; then
  info "Up to date: $CUR already has everything on main."
  exit 0
fi

info "main has $BEHIND new commit(s) since $CUR last synced:"
git log --no-merges --format='  %h %an: %s' "HEAD..$REMOTE/$MAIN" | head -15
HEADSUPS=$(git diff "HEAD...$REMOTE/$MAIN" -- docs/changelog.md 2>/dev/null | grep -E '^\+- ' | grep -i 'heads-up' | sed 's/^+/  /')
if [ -n "$HEADSUPS" ]; then
  info ""
  info "Heads-ups from teammates:"
  printf '%s\n' "$HEADSUPS"
fi

OLD=$(git rev-parse HEAD)
if ! git merge --no-edit -m "merge main into $CUR" "$REMOTE/$MAIN"; then
  print_conflicts
  exit 2
fi

info ""
info "Merged main into $CUR. Files that changed:"
git diff --stat "$OLD" HEAD | tail -20
if git diff --name-only "$OLD" HEAD | grep -qE '(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|uv\.lock)$'; then
  info ""
  info "Dependencies changed: reinstall (e.g. npm install / pip install -r requirements.txt) in the affected folder."
fi
if git diff --name-only "$OLD" HEAD | grep -qE '(^|/)\.env\.example$'; then
  info "New or changed env keys in .env.example: copy them into your .env."
fi

with_timeout 60 git push --quiet "$REMOTE" "$CUR" 2>/dev/null || true
exit 0
