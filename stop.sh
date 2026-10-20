#!/usr/bin/env bash
# Stopper dev-serveren og databasen. Dataene i databasen blir tatt vare på.
set -euo pipefail

cd "$(dirname "$0")"

PID_FILE=.dev.pid

if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopper dev-serveren (pid $pid)"
    # Stopp start.sh og alt det har startet (npm, next dev)
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Rydd opp en next dev som er startet på annen måte fra denne mappen
pkill -TERM -f "$(pwd)/node_modules/.bin/next dev" 2>/dev/null || true
pkill -TERM -f "$(pwd)/node_modules/next/dist" 2>/dev/null || true

if docker info >/dev/null 2>&1; then
  echo "Stopper databasen"
  npm run db:down
else
  echo "Docker kjører ikke, så databasen er allerede stoppet"
fi
