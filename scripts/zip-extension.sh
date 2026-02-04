#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXTENSION_DIST="$PROJECT_ROOT/extension/dist"

# Check if extension is built
if [ ! -d "$EXTENSION_DIST" ]; then
  echo "Error: Extension not built. Run 'pnpm build:extension' first."
  exit 1
fi

if [ ! -f "$EXTENSION_DIST/manifest.json" ]; then
  echo "Error: manifest.json not found in $EXTENSION_DIST"
  exit 1
fi

# Get version from manifest.json
VERSION=$(node -p "require('$EXTENSION_DIST/manifest.json').version")
OUTPUT_FILE="$PROJECT_ROOT/sushi-focus-extension-v$VERSION.zip"

# Remove existing zip if present
if [ -f "$OUTPUT_FILE" ]; then
  rm "$OUTPUT_FILE"
fi

# Create zip excluding source maps and vite cache
cd "$EXTENSION_DIST"
zip -r "$OUTPUT_FILE" . -x "*.map" -x ".vite/*"

echo "Created: $OUTPUT_FILE"
