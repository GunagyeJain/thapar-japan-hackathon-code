#!/usr/bin/env bash
# One command from a clean checkout to a running demo on :8000 (API + built frontend, one origin).
#
#   bash scripts/demo.sh            install what's missing, build, start
#   bash scripts/demo.sh --reset    same, then reset the demo data once the server is up
#   PORT=8100 bash scripts/demo.sh  another port
#
# Needs uv, Python 3.12+ and Node 20+ (see README "Run it").
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${PORT:-8000}
RESET=0
[ "${1:-}" = "--reset" ] && RESET=1

say() { printf '\n== %s\n' "$*"; }

if [ ! -d backend/.venv ]; then
  say "Creating backend/.venv"
  uv venv --python 3.12 backend/.venv
fi
say "Python packages"
uv pip install -q --python backend/.venv -r backend/requirements.txt

if [ ! -d node_modules ] || [ ! -d frontend/node_modules ]; then
  say "Node packages"
  npm install --no-audit --no-fund
fi

[ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example (recipe check needs GEMINI_API_KEY)."; }

lan_ip() {
  if command -v ipconfig >/dev/null 2>&1 && ipconfig getifaddr en0 >/dev/null 2>&1; then
    ipconfig getifaddr en0
  elif command -v ipconfig >/dev/null 2>&1; then
    ipconfig | grep -a "IPv4" | head -1 | sed 's/.*: //' | tr -d '\r'
  elif command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}
IP=$(lan_ip || true)

if [ "$RESET" -eq 1 ]; then
  (
    for _ in $(seq 1 90); do
      if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
        curl -fsS -X POST -H 'Content-Type: application/json' -d '{"keep_judges": false}' \
          "http://127.0.0.1:$PORT/api/demo/reset" >/dev/null && echo "Demo data reset."
        exit 0
      fi
      sleep 2
    done
  ) &
fi

cat <<EOF

== ThaliBento demo (building first, then serving on :$PORT)
   Presenter:   http://localhost:$PORT/demo
   Same Wi-Fi:  http://${IP:-your-laptop-ip}:$PORT/demo   (judges scan the QR on /demo)
   HTTPS for phones and the iPad, in a second terminal:
     PORT=$PORT npm run tunnel
     then open /demo on the https://….trycloudflare.com address it prints, so the judge QR points there.
   Stop with Ctrl+C.
EOF

npm run build
exec node scripts/py.mjs -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "$PORT"
