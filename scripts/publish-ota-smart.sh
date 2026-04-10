#!/usr/bin/env bash
# Publish an Expo OTA update only when commits include mobile-impacting changes.
#
# Usage:
#   bash scripts/publish-ota-smart.sh [git_range] [branch]
#
# Examples:
#   bash scripts/publish-ota-smart.sh                # defaults to HEAD~1..HEAD, production
#   bash scripts/publish-ota-smart.sh "origin/main..HEAD" preview
#
# Notes:
# - This script intentionally skips OTA for web-only edits.
# - Override detection with FORCE_OTA=1 to always publish.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RANGE="${1:-HEAD~1..HEAD}"
BRANCH="${2:-production}"

if ! git rev-parse --verify -q "${RANGE%%..*}" >/dev/null 2>&1; then
  echo "Could not resolve git range base from: $RANGE"
  exit 1
fi

if ! git rev-parse --verify -q "${RANGE##*..}" >/dev/null 2>&1; then
  echo "Could not resolve git range head from: $RANGE"
  exit 1
fi

CHANGED_FILES="$(git diff --name-only "$RANGE" || true)"

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files in range $RANGE. Skipping OTA publish."
  exit 0
fi

if [ "${FORCE_OTA:-0}" = "1" ]; then
  SHOULD_PUBLISH="1"
else
  SHOULD_PUBLISH="0"
  while IFS= read -r file; do
    case "$file" in
      apps/mobile/*|packages/core/*|packages/services/*|packages/firebase/*|backend/*|package.json|package-lock.json|tsconfig.json)
        SHOULD_PUBLISH="1"
        break
        ;;
    esac
  done <<< "$CHANGED_FILES"
fi

if [ "$SHOULD_PUBLISH" != "1" ]; then
  echo "Detected web-only changes in $RANGE. Skipping OTA publish."
  exit 0
fi

echo "Detected mobile-impacting changes in $RANGE:"
echo "$CHANGED_FILES" | sed 's/^/ - /'
echo ""
echo "Publishing OTA update to branch: $BRANCH"

cd "$ROOT/apps/mobile"
npx eas-cli update --branch "$BRANCH" --auto "${@:3}"

