#!/usr/bin/env bash
# Checks that must pass before anything reaches main. ship.sh runs this automatically.
#
#   bash scripts/check.sh
#
# Module M0 (foundation) wires the real lint/test/build commands into "Project checks" below.
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

# ---------------- Project checks (M0 fills these in for the chosen stack) ----------------
export CI=1
if [ -f frontend/package.json ]; then
  if [ ! -d frontend/node_modules ]; then
    step "frontend deps installed (run: npm install --prefix frontend)" false
  else
    step "frontend lint"  npm --prefix frontend run --silent --if-present lint
    step "frontend build" npm --prefix frontend run --silent --if-present build
    step "frontend tests" npm --prefix frontend run --silent --if-present test
  fi
fi
if [ -f backend/requirements.txt ] || [ -f backend/pyproject.toml ]; then
  PY=$(pick_python) || PY=""
  if [ -z "$PY" ]; then
    step "python available for backend" false
  else
    step "backend imports compile" "$PY" -m compileall -q backend
    if [ -d backend/tests ]; then
      if "$PY" -c 'import pytest' >/dev/null 2>&1; then
        step "backend tests" "$PY" -m pytest -q backend/tests
      else
        step "pytest installed (run: pip install pytest)" false
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
