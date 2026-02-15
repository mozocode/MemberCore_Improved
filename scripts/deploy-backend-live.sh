#!/usr/bin/env bash
# Deploy backend to Google Cloud Run.
# Run from project root. Requires gcloud CLI logged in.
#
# For event ticket payments, set Stripe env vars in Cloud Run (Console or gcloud):
#   STRIPE_SECRET_KEY, FRONTEND_URL, and optionally STRIPE_WEBHOOK_SECRET
# See docs/PAYMENTS.md.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Deploying backend to Cloud Run..."
gcloud run deploy membercore-api --source backend --region us-central1 --allow-unauthenticated

echo "Done. API will be live in a few seconds."
