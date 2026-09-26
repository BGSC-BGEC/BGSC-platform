#!/usr/bin/env bash
# Live stack for run.js: gateway + 12 services under ts-node, DB bgsc_live (dropped first).
# Usage: npm run live-check (from Backend/), or bash scripts/live-check/stack.sh then stop.sh.
# Needs the compose MongoDB + Redis up. Runtime output goes to .run/ (git-ignored).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIVE="$HERE/.run"
BACKEND="$(cd "$HERE/../.." && pwd)"
SERVICES=(auth-service user-service event-service registration-service announcement-service points-service
          leaderboard-service challenge-service media-service notification-service feedback-service bracket-service)

bash "$HERE/stop.sh" >/dev/null 2>&1 || true
mkdir -p "$LIVE/logs" "$LIVE/pids" "$LIVE/uploads"
rm -f "$LIVE"/logs/*.log "$LIVE"/pids/*.pid
rm -rf "$LIVE/uploads" && mkdir -p "$LIVE/uploads"

# Same host/creds as .env, database swapped to bgsc_live.
DEV_URI="$(grep -E '^MONGO_URI=' "$BACKEND/.env" | head -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//')"
LIVE_URI="$(node -e 'const u=new URL(process.argv[1]); u.pathname="/bgsc_live"; console.log(u.toString())' "$DEV_URI")"
case "$LIVE_URI" in *bgsc_live*) ;; *) echo "refusing: bad live uri"; exit 1;; esac
echo "$LIVE_URI" > "$LIVE/mongo_uri"

echo "[stack] building @bgsc/shared"
(cd "$BACKEND" && npm run build --workspace @bgsc/shared >"$LIVE/logs/shared-build.log" 2>&1) || { echo "shared build failed; see logs/shared-build.log"; exit 1; }

echo "[stack] dropping bgsc_live"
(cd "$BACKEND" && node -e '
const m=require("mongoose");
(async()=>{await m.connect(process.argv[1]); if(m.connection.db.databaseName!=="bgsc_live") throw new Error("wrong db"); await m.connection.db.dropDatabase(); await m.disconnect(); console.log("dropped", "bgsc_live");})().catch(e=>{console.error(e);process.exit(1)})' "$LIVE_URI")

# ponytail: own INTERNAL_API_TOKEN so bus messages from other processes sharing this Redis
# (other agents' suites) fail signature here instead of mutating bgsc_live, and vice versa.
export MONGO_URI="$LIVE_URI" NODE_ENV=development UPLOAD_DIR="$LIVE/uploads" TS_NODE_TRANSPILE_ONLY=1
export INTERNAL_API_TOKEN="bgsc_live_harness_internal_token"
unset PORT
TSN="$BACKEND/node_modules/.bin/ts-node"

start() { # name dir
    # `&` on the bare command (not a `cd && …` list) so $! is node itself and no wrapper shell
    # keeps this script's stdout open.
    (cd "$2" || exit 1; nohup "$TSN" src/index.ts >"$LIVE/logs/$1.log" 2>&1 </dev/null & echo $! >"$LIVE/pids/$1.pid")
}

start gateway "$BACKEND"
for s in "${SERVICES[@]}"; do start "$s" "$BACKEND/apps/$s"; done

echo "[stack] waiting for /health on :3000-:3012"
deadline=$((SECONDS + 180))
for port in $(seq 3000 3012); do
    until curl -sf -o /dev/null "http://localhost:$port/health"; do
        if (( SECONDS > deadline )); then
            echo "[stack] :$port never became healthy — check $LIVE/logs/"; exit 1
        fi
        sleep 1
    done
done
echo "[stack] all 13 healthy (db bgsc_live, logs in $LIVE/logs)"
