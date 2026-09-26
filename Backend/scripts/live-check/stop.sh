#!/usr/bin/env bash
# Stops everything stack.sh started.
LIVE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.run"
for f in "$LIVE"/pids/*.pid; do
    [ -e "$f" ] || continue
    pid="$(cat "$f")"
    kill "$pid" 2>/dev/null
done
sleep 2
for f in "$LIVE"/pids/*.pid; do
    [ -e "$f" ] || continue
    pid="$(cat "$f")"
    kill -9 "$pid" 2>/dev/null
    rm -f "$f"
done
echo "[stop] stack stopped"
