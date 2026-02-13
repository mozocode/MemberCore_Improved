#!/bin/bash
# Start the MemberCore API backend with Firestore emulator support.
# Ensure the Firestore emulator is running: firebase emulators:start --only firestore

cd "$(dirname "$0")"
source venv/bin/activate
FIRESTORE_EMULATOR_HOST=localhost:8080 uvicorn app.main:app --reload --port 8001
