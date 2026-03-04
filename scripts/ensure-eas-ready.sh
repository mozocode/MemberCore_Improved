#!/usr/bin/env bash
# Run from repo root. Ensures EAS login and apps/mobile project config so build:ipa can run.
set -e

MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/mobile"
cd "$MOBILE_DIR"

echo "Checking EAS setup for MemberCore (apps/mobile)..."
echo ""

# 1. EAS login (use eas-cli package so npx finds the executable)
if ! (cd "$MOBILE_DIR" && npx eas-cli whoami) &>/dev/null; then
  echo "❌ Not logged in to EAS."
  echo "   Run:  cd apps/mobile && npx eas-cli login"
  echo "   (Or install globally: npm install -g eas-cli   then run: eas login)"
  echo "   Then run this script again."
  exit 1
fi
echo "✓ EAS login OK ($(cd "$MOBILE_DIR" && npx eas-cli whoami 2>/dev/null))"

# 2. Project ID in app.json
PROJECT_ID=$(node -e "
  try {
    const app = require('./app.json');
    const id = app?.expo?.extra?.eas?.projectId || '';
    console.log(id.trim());
  } catch (e) {
    console.log('');
  }
" 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ EAS project not linked (projectId is empty in app.json)."
  echo "   Run:  cd apps/mobile && npx eas-cli init"
  echo "   Choose 'Create a new project' or link an existing one. Then run this script again."
  exit 1
fi
echo "✓ EAS project linked (projectId: ${PROJECT_ID:0:8}...)"
echo ""
echo "Ready to build. From repo root run:  npm run build:ipa"
exit 0
