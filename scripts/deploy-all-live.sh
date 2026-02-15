#!/usr/bin/env bash
# Deploy frontend (Firebase Hosting) and backend (Cloud Run) to live.
# Run from project root.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1/2 Frontend (Firebase Hosting) ==="
bash scripts/deploy-live.sh

echo ""
echo "=== 2/2 Backend (Cloud Run) ==="
bash scripts/deploy-backend-live.sh

echo ""
echo "All done. Live site and API are updated."
