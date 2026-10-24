#!/usr/bin/env bash
# Shared helpers for the team git scripts. Sourced by the other scripts, not run directly.
# Works in Git Bash (Windows), macOS bash 3.2 and Linux.

MAIN=main
REMOTE=origin

die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
info() { printf '%s\n' "$*"; }

cd_root() {
  local root
  root=$(git rev-parse --show-toplevel 2>/dev/null) || die "Not inside the git repo."
  cd "$root" || die "Cannot open the repo folder."
}

current_branch() { git symbolic-ref --quiet --short HEAD 2>/dev/null || echo "HEAD"; }

# Uncommitted changes, including new files (ignored files don't count).
is_dirty() { [ -n "$(git status --porcelain 2>/dev/null)" ]; }

in_merge() { [ -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; }

has_remote_main() { git rev-parse --verify --quiet "$REMOTE/$MAIN" >/dev/null; }

with_timeout() {
  # with_timeout <seconds> <cmd...>; runs without a limit where `timeout` is missing (macOS).
  # Only GNU timeout: on Windows a different timeout.exe can shadow it.
  local s=$1; shift
  if timeout --version 2>/dev/null | grep -q GNU; then timeout "$s" "$@"; else "$@"; fi
}

fetch_quiet() { with_timeout 30 git fetch --quiet --prune "$REMOTE" 2>/dev/null; }

slug() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'; }

# Prints each conflicted file with the playbook rule that applies (CONTRIBUTING.md > Merge conflicts).
print_conflicts() {
  local f n=0
  info ""
  info "MERGE CONFLICT. Files to resolve:"
  for f in $(git diff --name-only --diff-filter=U); do
    n=$((n + 1))
    case "$f" in
      *package-lock.json|*pnpm-lock.yaml|*yarn.lock|*bun.lockb|*poetry.lock|*uv.lock|*Pipfile.lock)
        info "  [lockfile]  $f -> take main's copy (git checkout --theirs -- \"$f\"), reinstall deps to regenerate, git add" ;;
      docs/changelog.md|docs/decisions.md)
        info "  [log]       $f -> keep both sides' lines" ;;
      *package.json|*requirements*.txt|*pyproject.toml)
        info "  [manifest]  $f -> keep both sides' additions; on a version clash keep the higher one" ;;
      shared/*)
        info "  [contract]  $f -> combine both changes so every module still works; never drop a field main added" ;;
      *)
        info "  [code]      $f -> your module: keep yours + absorb main's changes; someone else's module: take main's" ;;
    esac
  done
  [ "$n" -eq 0 ] && info "  (none listed; run: git status)"
  info ""
  info "After fixing: make sure no <<<<<<< / >>>>>>> markers remain, then: git add -A && git commit --no-edit"
}
