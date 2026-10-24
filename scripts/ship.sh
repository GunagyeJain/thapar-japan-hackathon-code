#!/usr/bin/env bash
# Ship your branch into main so the whole team gets it.
#
#   bash scripts/ship.sh "<what works now>" ["<heads-up for teammates>"]
#   e.g. bash scripts/ship.sh "crew scan reads QR offline" "run npm install in frontend"
#
# Steps: pull latest main into your branch -> run checks -> push your branch ->
#        merge it into main on GitHub -> your branch is left identical to main.
# Exit codes: 0 shipped (or nothing to ship) · 1 error · 2 merge conflict · 3 commit first · 4 checks failed
set -u
. "$(dirname "$0")/_lib.sh"
cd_root

SUMMARY=${1:-}
HEADSUP=${2:-}
[ -n "$SUMMARY" ] || die "Usage: bash scripts/ship.sh \"<what works now>\" [\"<heads-up>\"]"

CUR=$(current_branch)
case "$CUR" in
  HEAD) die "You're not on a branch. Run: bash scripts/start.sh <module>" ;;
  "$MAIN") die "You're on main. Ship from your branch: bash scripts/start.sh <module> moves your work there." ;;
esac
if in_merge; then print_conflicts; exit 2; fi
if is_dirty; then
  info "Uncommitted changes. Commit them first:  git add -A && git commit -m \"<type>(<module>): <what>\""
  exit 3
fi

fetch_quiet || die "Could not reach GitHub."
has_remote_main || die "GitHub has no main branch yet."

run_checks() {
  if [ "${SKIP_CHECKS:-0}" = "1" ]; then
    warn "Checks skipped (SKIP_CHECKS=1)."
    return 0
  fi
  bash scripts/check.sh
}

sync_with_main() {
  if ! git merge-base --is-ancestor "$REMOTE/$MAIN" HEAD; then
    info "Pulling the latest main into $CUR first..."
    git merge --no-edit -m "merge main into $CUR" "$REMOTE/$MAIN" || { print_conflicts; info "Then run ship again."; exit 2; }
  fi
  run_checks || { info ""; info "Checks failed. Fix, commit, and run ship again."; exit 4; }
}

sync_with_main

AHEAD=$(git rev-list --count "$REMOTE/$MAIN..HEAD")
if [ "$AHEAD" -eq 0 ]; then
  info "Nothing new to ship: main already has everything on $CUR."
  exit 0
fi

with_timeout 90 git push --quiet -u "$REMOTE" "$CUR" || die "Could not push $CUR to GitHub (see the message above)."

WHO=$(git config --get user.name || echo "unknown")
STAMP=$(date '+%Y-%m-%d %H:%M')
LINE="- $STAMP · $WHO · \`$CUR\` · $SUMMARY"
[ "${SKIP_CHECKS:-0}" = "1" ] && LINE="$LINE (checks skipped)"
[ -n "$HEADSUP" ] && LINE="$LINE · **Heads-up:** $HEADSUP"
MSG="Merge branch '$CUR': $SUMMARY"
GITDIR=$(git rev-parse --git-dir)
TMP_INDEX="$GITDIR/ship-index.tmp"

attempt=0
while :; do
  attempt=$((attempt + 1))
  [ "$attempt" -gt 5 ] && die "main kept moving. Wait a minute and run ship again."

  # Build the merge commit without touching your files: tree = your branch + one changelog line.
  rm -f "$TMP_INDEX"
  GIT_INDEX_FILE="$TMP_INDEX" git read-tree HEAD || die "Could not prepare the merge."
  if git cat-file -e "HEAD:docs/changelog.md" 2>/dev/null; then
    OLD_LOG=$(git cat-file -p "HEAD:docs/changelog.md")
  else
    OLD_LOG="# Changelog"
  fi
  BLOB=$(printf '%s\n%s\n' "$OLD_LOG" "$LINE" | git hash-object -w --stdin)
  GIT_INDEX_FILE="$TMP_INDEX" git update-index --add --cacheinfo "100644,$BLOB,docs/changelog.md"
  TREE=$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)
  rm -f "$TMP_INDEX"
  if [ -n "$HEADSUP" ]; then
    COMMIT=$(git commit-tree "$TREE" -p "$REMOTE/$MAIN" -p HEAD -m "$MSG" -m "Heads-up: $HEADSUP")
  else
    COMMIT=$(git commit-tree "$TREE" -p "$REMOTE/$MAIN" -p HEAD -m "$MSG")
  fi
  [ -n "$COMMIT" ] || die "Could not create the merge commit."

  if with_timeout 90 git push --quiet "$REMOTE" "$COMMIT:refs/heads/$MAIN"; then
    break
  fi
  info "Someone shipped at the same moment. Pulling their work and retrying ($attempt/5)..."
  fetch_quiet || die "Could not reach GitHub."
  sync_with_main
done

fetch_quiet || true
git merge --quiet --ff-only "$COMMIT" || warn "Could not fast-forward $CUR to main; run bash scripts/sync.sh."
with_timeout 60 git push --quiet "$REMOTE" "$CUR" 2>/dev/null || true
git show-ref --verify --quiet "refs/heads/$MAIN" && git branch -f "$MAIN" "$COMMIT" 2>/dev/null

info ""
info "SHIPPED: $CUR is now in main ($(git rev-parse --short "$COMMIT"))."
info "  $LINE"
info "Keep working on $CUR; it is identical to main right now."
