#!/usr/bin/env bash
# Deploy backend to Google Cloud Run.
# Run from project root. Requires gcloud CLI logged in.
#
# For Stripe, set env vars in Cloud Run (Console or gcloud):
#   STRIPE_SECRET_KEY, FRONTEND_URL,
#   STRIPE_PAYMENTS_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET fallback),
#   STRIPE_SUBSCRIPTION_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET fallback),
#   STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL
# Optional Google calendar daily auto-sync:
#   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
#   GOOGLE_CALENDAR_OAUTH_REDIRECT_URI, GOOGLE_CALENDAR_SYNC_SECRET
# See docs/PAYMENTS.md.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Deploying backend to Cloud Run..."
gcloud run deploy membercore-api --source backend --region us-central1 --allow-unauthenticated

echo "Done. API will be live in a few seconds."
