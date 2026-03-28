#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../apps/mobile"

KEY_FILE="google-service-account.json"

if [ -f "$KEY_FILE" ]; then
  : # key already in place
elif [ -n "$GOOGLE_SERVICE_ACCOUNT_KEY_PATH" ] && [ -f "$GOOGLE_SERVICE_ACCOUNT_KEY_PATH" ]; then
  cp "$GOOGLE_SERVICE_ACCOUNT_KEY_PATH" "$KEY_FILE"
  echo "Using Google Service Account key from: $GOOGLE_SERVICE_ACCOUNT_KEY_PATH"
else
  echo ""
  echo "Missing Google Service Account key (required for Play Store submit)."
  echo ""
  echo "Option 1: Save your key file as:"
  echo "  apps/mobile/google-service-account.json"
  echo ""
  echo "Option 2: Set the path and run again:"
  echo "  export GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/your-key.json"
  echo "  npm run submit:play"
  echo ""
  echo "How to create the key: see apps/mobile/GOOGLE_PLAY.md"
  echo ""
  exit 1
fi

npx eas-cli submit --platform android --profile production --latest
