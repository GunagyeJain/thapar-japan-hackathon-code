#!/usr/bin/env bash
# HTTPS for phones and the iPad: a Cloudflare quick tunnel to the demo server on :8000.
#
#   npm run demo          # in one terminal: build + serve everything on :8000
#   bash scripts/tunnel.sh  # in another: prints the https://….trycloudflare.com address
#
# Needs cloudflared: Windows `winget install Cloudflare.cloudflared`, macOS `brew install cloudflared`.
# Each start gives a new address: reopen /demo and /crew on it (before airplane mode on the iPad).
set -u
. "$(dirname "$0")/_lib.sh"
cd_root

PORT=${PORT:-8000}

find_cloudflared() {
  local c
  for c in cloudflared cloudflared.exe \
    "/c/Program Files (x86)/cloudflared/cloudflared.exe" \
    "/c/Program Files/cloudflared/cloudflared.exe" \
    "$HOME/AppData/Local/Microsoft/WinGet/Links/cloudflared.exe"; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then printf '%s\n' "$c"; return 0; fi
  done
  return 1
}

CF=$(find_cloudflared) || die "cloudflared not found. Windows: winget install Cloudflare.cloudflared · macOS: brew install cloudflared"

if ! curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  die "Nothing on :$PORT. Start the demo server first: npm run demo"
fi
if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/crew"; then
  warn ":$PORT answers the API but not the app. Use npm run demo (it builds the frontend), not npm run dev."
fi

info "Starting the tunnel to http://localhost:$PORT (Ctrl+C to stop)..."
shown=0
"$CF" tunnel --no-autoupdate --url "http://localhost:$PORT" 2>&1 | while IFS= read -r line; do
  url=$(printf '%s' "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
  if [ -n "$url" ] && [ "$shown" -eq 0 ]; then
    shown=1
    info ""
    info "  Tunnel is up: $url"
    info "    judges:  $url/j"
    info "    crew:    $url/crew   (open online, Download, then airplane mode)"
    info "    demo:    $url/demo"
    info "    ops:     $url/ops"
    info ""
  fi
  case "$line" in
    *ERR*|*error*) printf '  cloudflared: %s\n' "$line" ;;
  esac
done
