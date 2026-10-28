#!/usr/bin/env bash
# Points Backend, web and mobile env files at a new public gateway URL (e.g. a fresh cloudflared
# quick tunnel, which changes on every restart) and recreates the containers that read it.
#   bash scripts/set-public-url.sh https://something.trycloudflare.com
set -euo pipefail

url="${1:?usage: bash scripts/set-public-url.sh https://<public-host>}"
url="${url%/}"
[[ $url == https://* ]] || { echo "need an https:// URL (Google refuses plain http callbacks)"; exit 1; }

root="$(cd "$(dirname "$0")/../.." && pwd)"

# sed -i.bak works on both GNU and BSD/macOS sed.
set_var() { # file key value
  local file="$1" key="$2" value="$3"
  [[ -f $file ]] || { echo "missing $file (copy it from .env.example first)"; exit 1; }
  if grep -qE "^$key=" "$file"; then
    sed -i.bak -E "s#^$key=[^ ]*#$key=$value#" "$file" && rm -f "$file.bak"
  else
    echo "$key=$value" >> "$file"
  fi
}

set_var "$root/Backend/.env" API_BASE_URL "$url"
set_var "$root/Backend/.env" GOOGLE_CALLBACK_URL "$url/auth/google/callback"
set_var "$root/Backend/.env" STRAVA_CALLBACK_URL "$url/strava/callback"
set_var "$root/web/.env" VITE_API_URL "$url"
set_var "$root/mobile/.env" EXPO_PUBLIC_API_URL "$url"

(cd "$root/Backend" && docker compose up -d)

cat <<EOF

Now pointing at $url
  1. Google Cloud Console -> Credentials -> the OAuth client -> Authorized redirect URIs:
       add  $url/auth/google/callback   and Save (takes a few minutes to apply)
  2. Restart the web dev server (Ctrl+C, npm run dev) and Expo (npx expo start -c).
EOF
