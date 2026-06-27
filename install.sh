#!/usr/bin/env bash
# google-cli installer: builds and links the CLI globally via npm.
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Installing dependencies"
npm install --no-audit --no-fund

echo "→ Building"
npm run build

echo "→ Linking to global PATH"
npm link

echo
echo "✓ Installed. Run: google-cli --help"
echo "  Set your key:  export GOOGLE_API_KEY=…   (or pass --api-key)"
