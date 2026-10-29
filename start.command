#!/bin/zsh

cd "${0:A:h}"

echo "======================================================"
echo "⚡ Starting Emerald Studio (World Map & Dialogue)..."
echo "======================================================"

node server.js &
studio_pid=$!
trap 'kill "$studio_pid"' EXIT

until curl -fsS http://127.0.0.1:4173/api/status >/dev/null 2>&1; do
  sleep 0.1
done

open "http://127.0.0.1:4173"
wait "$studio_pid"
