#!/usr/bin/env bash
# Local Android build inside WSL.
#
# Why a copy: builds from /mnt/c are slow and Windows node_modules don't run on Linux.
# The repo stays the single source of truth; this mirrors mobile/ into the WSL home
# (never edit the copy), installs Linux deps there and runs `eas build --local`.
#
# Usage (from Windows):  wsl -d Ubuntu-22.04 -- bash scripts/wsl-build.sh [development|preview|production]
# The APK/AAB is copied back to mobile/builds/ (git-ignored).
set -euo pipefail

PROFILE="${1:-development}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/mobile/"
DEST="$HOME/nourish-build/mobile/"
OUT="$REPO/mobile/builds"

export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
# The WSL copy isn't a git repo; EAS then packs it using mobile/.easignore.
export EAS_NO_VCS=1

echo "› syncing $SRC → $DEST"
mkdir -p "$DEST" "$OUT"
# --delete keeps the copy identical; generated/native/local-only files are excluded.
rsync -a --delete \
  --exclude node_modules --exclude android --exclude ios --exclude .expo \
  --exclude dist --exclude builds --exclude '.env*' --exclude '*firebase-adminsdk*.json' \
  "$SRC" "$DEST"

cd "$DEST"
# Reinstall only when the lockfile changed (saves minutes on repeat builds).
if ! cmp -s package-lock.json node_modules/.lock-copy 2>/dev/null; then
  echo "› npm ci"
  npm ci
  cp package-lock.json node_modules/.lock-copy
fi

EXT=apk
[ "$PROFILE" = "production" ] && EXT=aab
ARTIFACT="$OUT/nourish-$PROFILE-$(date +%Y%m%d-%H%M).$EXT"

echo "› eas build --local ($PROFILE)"
npx --yes eas-cli@latest build -p android --profile "$PROFILE" --local --output "$ARTIFACT"
echo "✓ $ARTIFACT"
