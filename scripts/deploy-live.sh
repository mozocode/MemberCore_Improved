#!/usr/bin/env bash
# Build frontend for production and deploy to Firebase Hosting.
# Run from project root. Requires CLOUD_RUN_URL (or set default below).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Your Cloud Run service URL (no /api suffix — script adds it)
CLOUD_RUN_URL="${CLOUD_RUN_URL:-https://membercore-api-112612371535.us-central1.run.app}"
VITE_BACKEND_URL="${CLOUD_RUN_URL%/}/api"

# Vite loads frontend/.env when we run npm run build from frontend/.
# We only override VITE_BACKEND_URL so the token in .env is used (not overwritten by an empty env var).
if [ -f frontend/.env ]; then
  MAPBOX_VAL=$(grep -E '^VITE_MAPBOX_TOKEN=' frontend/.env 2>/dev/null | cut -d= -f2- | tr -d '\r')
  if [ -n "$MAPBOX_VAL" ] && [ "${#MAPBOX_VAL}" -gt 20 ] && echo "$MAPBOX_VAL" | grep -q '^pk\.'; then
    echo "Mapbox token: found in frontend/.env (will be included in build)"
  elif [ -n "$MAPBOX_VAL" ]; then
    echo "Warning: VITE_MAPBOX_TOKEN in frontend/.env looks like a placeholder. Map may not work on live site."
  else
    echo "Warning: No VITE_MAPBOX_TOKEN in frontend/.env. Map will not work on live site."
  fi
fi

echo "Building frontend (BACKEND_URL=$VITE_BACKEND_URL)..."
cd frontend
VITE_BACKEND_URL="$VITE_BACKEND_URL" npm run build
cd "$ROOT"

echo "Deploying to Firebase Hosting..."
firebase use membercore-f0b3f
firebase deploy --only hosting

echo "Done. Live site will update in a few seconds."
