#!/usr/bin/env bash
# Start (or continue) work on a module, on your own branch.
#
#   bash scripts/start.sh <your-name> <module>    first time, e.g.  bash scripts/start.sh gunagye m3
#   bash scripts/start.sh <module>                after that (your name is remembered)
#
# Branch name: <name>/<module-file-name>, e.g. gunagye/m3-crew-scan (from docs/plan/modules/m3-crew-scan.md).
# Safe to run any time: uncommitted changes come with you, and commits made on main by mistake
# are moved onto your branch.
set -u
. "$(dirname "$0")/_lib.sh"
cd_root

if [ $# -ge 2 ]; then
  NAME=$(slug "$1"); MOD_IN=$(slug "$2")
  git config team.member "$NAME"
elif [ $# -eq 1 ]; then
  NAME=$(slug "$(git config --get team.member || true)"); MOD_IN=$(slug "$1")
  [ -n "$NAME" ] || die "Who are you? Run: bash scripts/start.sh <your-name> <module>"
else
  die "Usage: bash scripts/start.sh <your-name> <module>   (e.g. gunagye m3)"
fi
[ -n "$MOD_IN" ] || die "Module id is empty."

in_merge && die "A merge is in progress. Finish it first: resolve the files, then git add -A && git commit --no-edit"

fetch_quiet || warn "Could not reach GitHub, using what's on this laptop."
CUR=$(current_branch)

# Resolve "m3" to the module file name "m3-crew-scan" (looks at this laptop and at GitHub's main).
MOD="$MOD_IN"
MOD_FILE=""
for name in $( { ls docs/plan/modules 2>/dev/null
                 has_remote_main && git ls-tree --name-only "$REMOTE/$MAIN" docs/plan/modules/ 2>/dev/null | sed 's|.*/||'
               } | sort -u ); do
  case "$name" in
    "$MOD_IN"-*.md|"$MOD_IN".md) MOD=${name%.md}; MOD_FILE="docs/plan/modules/$name"; break ;;
  esac
done
BR="$NAME/$MOD"

# Reuse an existing branch of yours for this module, even if it was named before the plan existed.
for b in $(git for-each-ref --format='%(refname:short)' "refs/heads/$NAME/" "refs/remotes/$REMOTE/$NAME/" | sed "s|^$REMOTE/||" | sort -u); do
  case "$b" in
    "$NAME/$MOD_IN"|"$NAME/$MOD_IN"-*) BR="$b"; break ;;
  esac
done

STASHED=0
if is_dirty; then
  git stash push --include-untracked --quiet -m "start.sh: carry changes to $BR" || die "Could not set aside your changes."
  STASHED=1
fi

MAIN_EXTRA=0
if [ "$CUR" = "$MAIN" ] && has_remote_main; then
  MAIN_EXTRA=$(git rev-list --count "$REMOTE/$MAIN..$MAIN")
fi

if [ "$CUR" = "$BR" ]; then
  info "Already on $BR."
elif git show-ref --verify --quiet "refs/heads/$BR"; then
  git switch --quiet "$BR" || die "Could not switch to $BR."
  info "Switched to your branch $BR."
elif git show-ref --verify --quiet "refs/remotes/$REMOTE/$BR"; then
  git switch --quiet --track "$REMOTE/$BR" || die "Could not check out $BR from GitHub."
  info "Checked out your branch $BR from GitHub."
elif [ "$MAIN_EXTRA" -gt 0 ]; then
  git switch --quiet -c "$BR" || die "Could not create $BR."
  info "Created $BR, carrying the $MAIN_EXTRA commit(s) you made on main."
else
  BASE="$REMOTE/$MAIN"; has_remote_main || BASE=HEAD
  git switch --quiet --no-track -c "$BR" "$BASE" || die "Could not create $BR."
  info "Created $BR from the latest main."
fi

# Commits made on main by mistake: bring them here, then point main back at GitHub's main.
if [ "$MAIN_EXTRA" -gt 0 ]; then
  if ! git merge-base --is-ancestor "$MAIN" HEAD; then
    git merge --no-edit -m "merge local main commits into $BR" "$MAIN" || { print_conflicts; exit 2; }
  fi
  git branch -f "$MAIN" "$REMOTE/$MAIN" && info "Local main reset to match GitHub (your commits are on $BR)."
fi

# Bring the branch up to date with main.
if has_remote_main && ! git merge-base --is-ancestor "$REMOTE/$MAIN" HEAD; then
  info "Pulling the latest main into $BR..."
  git merge --no-edit -m "merge main into $BR" "$REMOTE/$MAIN" || {
    print_conflicts
    [ "$STASHED" -eq 1 ] && info "Your uncommitted changes are saved in the stash; after the merge, run: git stash pop"
    exit 2
  }
fi

if [ "$STASHED" -eq 1 ]; then
  if git stash pop --quiet; then
    info "Your uncommitted changes came along."
  else
    print_conflicts
    info "Your uncommitted changes clashed with main. Resolve them; the saved copy stays in git stash list until you drop it."
    exit 2
  fi
fi

# Publish the branch so teammates' radar can see it.
if ! git rev-parse --verify --quiet "@{upstream}" >/dev/null 2>&1; then
  if with_timeout 60 git push --quiet -u "$REMOTE" "$BR" 2>/dev/null; then
    info "Published $BR to GitHub."
  else
    warn "Could not push $BR yet (offline or not signed in). Your work is safe on this laptop."
  fi
fi

info ""
info "Ready: on $BR"
[ -n "$MOD_FILE" ] && info "Module spec: $MOD_FILE" || info "No module file found for '$MOD_IN' in docs/plan/modules/ (fine before the plan exists)."
