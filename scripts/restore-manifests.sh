#!/bin/bash
# Script to restore manifest placeholders from git (removes real secrets)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "Restoring manifest placeholders from git..."
echo "This will remove any real secrets and restore \${VAR_NAME} placeholders."
echo ""

git checkout copilot/ice-ai-website/manifest.yml

echo "✓ Manifests restored to placeholders"
echo ""
echo "The manifests now contain placeholders and are safe to commit to git."
