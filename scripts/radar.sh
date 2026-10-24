#!/usr/bin/env bash
# Who is working on what, and where your work overlaps with theirs.
#
#   bash scripts/radar.sh            full view
#   bash scripts/radar.sh --brief    short view
#   add --no-fetch to skip contacting GitHub
set -u
. "$(dirname "$0")/_lib.sh"
cd_root

BRIEF=0; FETCH=1
for a in "$@"; do
  case "$a" in
    --brief) BRIEF=1 ;;
    --no-fetch) FETCH=0 ;;
  esac
done
if [ "$FETCH" -eq 1 ]; then
  fetch_quiet || warn "Could not reach GitHub; showing the last known state."
fi

if ! has_remote_main; then
  info "Radar: GitHub has no main branch yet."
  exit 0
fi

CUR=$(current_branch)
TMPD=$(mktemp -d 2>/dev/null || { d="${TMPDIR:-/tmp}/radar.$$"; mkdir -p "$d"; echo "$d"; })
trap 'rm -rf "$TMPD"' EXIT
MINE="$TMPD/mine"; OVER="$TMPD/overlap"
: > "$MINE"; : > "$OVER"

info "== Team radar · main @ $(git log -1 --format='%h, %cr' "$REMOTE/$MAIN") =="
if [ "$CUR" != "$MAIN" ] && [ "$CUR" != "HEAD" ]; then
  { git diff --name-only "$REMOTE/$MAIN...HEAD"; git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | grep . | sort -u > "$MINE"
  AHEAD=$(git rev-list --no-merges --count "$REMOTE/$MAIN..HEAD")
  BEHIND=$(git rev-list --count "HEAD..$REMOTE/$MAIN")
  DIRTY=$(git status --porcelain | grep -c . || true)
  STATE="You: $CUR · $AHEAD commit(s) not shipped · $DIRTY uncommitted file(s)"
  [ "$BEHIND" -gt 0 ] && STATE="$STATE · $BEHIND commit(s) behind main (run sync)"
  info "$STATE"
else
  info "You: on $CUR (start a branch before editing)"
fi

info "Teammates' unshipped branches:"
COUNT=0
for ref in $(git for-each-ref --format='%(refname:short)' --no-merged "$REMOTE/$MAIN" "refs/remotes/$REMOTE/"); do
  name=${ref#"$REMOTE"/}
  case "$name" in HEAD|"$MAIN"|"$CUR") continue ;; esac
  COUNT=$((COUNT + 1))
  who=$(git log -1 --format='%an' "$ref")
  when=$(git log -1 --format='%cr' "$ref")
  n=$(git rev-list --no-merges --count "$REMOTE/$MAIN..$ref")
  git diff --name-only "$REMOTE/$MAIN...$ref" 2>/dev/null | grep . > "$TMPD/theirs" || true
  nf=$(grep -c . "$TMPD/theirs" || true)
  areas=$(sed -E 's|/[^/]+$||' "$TMPD/theirs" | sort -u | head -4 | tr '\n' ' ')
  info "  $name · $who · last commit $when · $n commit(s), $nf file(s): $areas"
  if [ -s "$MINE" ] && [ -s "$TMPD/theirs" ]; then
    grep -Fx -f "$MINE" "$TMPD/theirs" | sed "s|\$|  (also changed on $name by $who)|" >> "$OVER" || true
  fi
done
[ "$COUNT" -eq 0 ] && info "  (none: everything is shipped)"

if [ -s "$OVER" ]; then
  info "OVERLAP with your work (likely merge conflict; ship or sync soon, or agree who edits it):"
  sed 's/^/  ! /' "$OVER"
fi

if git cat-file -e "$REMOTE/$MAIN:docs/changelog.md" 2>/dev/null; then
  N=5; [ "$BRIEF" -eq 1 ] && N=3
  SHIPS=$(git cat-file -p "$REMOTE/$MAIN:docs/changelog.md" | grep -E '^- ' | tail -n "$N" | sed 's/^/  /')
  info "Last ships to main:"
  info "${SHIPS:-  (none yet)}"
fi
exit 0
