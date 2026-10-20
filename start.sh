#!/usr/bin/env bash
# Starter appen lokalt: database i Docker, migrasjoner, testdata og dev-server.
# Stopp med Ctrl+C eller ./stop.sh fra et annet vindu.
set -euo pipefail

cd "$(dirname "$0")"

PID_FILE=.dev.pid

if ! docker info >/dev/null 2>&1; then
  echo "Docker kjører ikke. Start Docker Desktop og prøv igjen." >&2
  exit 1
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Appen kjører allerede (pid $(cat "$PID_FILE")). Kjør ./stop.sh først." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Lager .env fra .env.example"
  cp .env.example .env
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installerer avhengigheter"
  npm install
fi

echo "Starter databasen"
npm run db:up

echo "Kjører migrasjoner"
npm run db:migrate

echo "Legger inn testdata som mangler"
npm run db:seed

echo "Starter dev-serveren på http://localhost:3000"
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT
npm run dev
