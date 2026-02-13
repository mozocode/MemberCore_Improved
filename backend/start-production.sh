#!/bin/bash
# Start the MemberCore API backend against PRODUCTION Firestore.
# Requires: backend/.env with GOOGLE_APPLICATION_CREDENTIALS pointing to your service account JSON.
# Do NOT set FIRESTORE_EMULATOR_HOST.

cd "$(dirname "$0")"
source venv/bin/activate
# Unset emulator so we use production Firestore
unset FIRESTORE_EMULATOR_HOST
uvicorn app.main:app --reload --port 8001
