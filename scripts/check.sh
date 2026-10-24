#!/usr/bin/env bash
# Checks that must pass before anything reaches main. ship.sh runs this automatically.
#
#   bash scripts/check.sh
#
# Project checks: tsc --noEmit, vite build, vitest, pytest (wired by m0).
set -u
. "$(dirname "$0")/_lib.sh"
cd_root

FAIL=0
step() {
  local name=$1 out; shift
  printf -- '- %s ... ' "$name"
  if out=$("$@" 2>&1); then
    echo "ok"
  else
    echo "FAILED"
    printf '%s\n' "$out" | tail -40 | sed 's/^/    /'
    FAIL=1
  fi
}

no_conflict_markers() {
  local hits
  hits=$(git grep -n -I -E '^(<<<<<<<|>>>>>>>)( |$)' -- . 2>/dev/null || true)
  [ -z "$hits" ] || { printf '%s\n' "$hits"; return 1; }
}

no_env_files() {
  local hits
  hits=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.example$' || true)
  [ -z "$hits" ] || { printf 'Remove from git (keep the file locally): git rm --cached <file>\n%s\n' "$hits"; return 1; }
}

no_huge_files() {
  local big
  big=$(git ls-files | while IFS= read -r f; do
    [ -f "$f" ] && [ "$(wc -c < "$f" | tr -d ' ')" -gt 10485760 ] && printf '  %s\n' "$f"
  done)
  [ -z "$big" ] || { printf 'Files over 10 MB (keep them out of git):\n%s\n' "$big"; return 1; }
}

pick_python() {
  local c
  for c in backend/.venv/Scripts/python.exe backend/.venv/bin/python python python3; do
    if "$c" -c 'import sys' >/dev/null 2>&1; then echo "$c"; return 0; fi
  done
  return 1
}

info "Running checks..."
step "no merge-conflict markers" no_conflict_markers
step "no .env files in git" no_env_files
step "no files over 10 MB" no_huge_files

# ---------------- Project checks (m0) ----------------
export CI=1
if [ -f frontend/package.json ]; then
  if [ ! -d frontend/node_modules ]; then
    step "frontend deps installed (run: npm install)" false
  else
    step "frontend typecheck (tsc --noEmit)" npm --prefix frontend run --silent lint
    step "frontend build" npm --prefix frontend run --silent build
    step "frontend tests (vitest)" npm --prefix frontend run --silent test
  fi
fi
if [ -f backend/requirements.txt ] || [ -f backend/pyproject.toml ]; then
  PY=$(pick_python) || PY=""
  if [ -z "$PY" ]; then
    step "backend venv (see README: uv venv --python 3.12 backend/.venv)" false
  else
    step "backend imports compile" "$PY" -m compileall -q backend/app backend/tests
    if [ -d backend/tests ]; then
      if "$PY" -c 'import pytest' >/dev/null 2>&1; then
        step "backend tests" "$PY" -m pytest -q backend/tests
      else
        step "pytest installed (run: uv pip install --python backend/.venv -r backend/requirements.txt)" false
      fi
    fi
  fi
fi
# ------------------------------------------------------------------------------------------

if [ "$FAIL" -ne 0 ]; then
  info "Checks FAILED."
  exit 1
fi
info "All checks passed."
