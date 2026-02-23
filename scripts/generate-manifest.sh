#!/bin/bash
# Script to generate Copilot manifest from template using .env file

set -e

SERVICE_NAME="${1:-ice-ai-website}"
ENV_FILE_NAME="${2:-.env}"

if [ -z "$1" ]; then
    echo "Usage: $0 <service-name> [env-file]"
    echo "Example: $0 ice-ai-website"
    echo "Example: $0 ice-ai-website .env.prod"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$WEBSITE_DIR/.." && pwd)"
# If ENV_FILE_NAME is already an absolute path, use it; otherwise construct from PROJECT_ROOT
if [[ "$ENV_FILE_NAME" == /* ]]; then
    ENV_FILE="$ENV_FILE_NAME"
else
    ENV_FILE="$PROJECT_ROOT/$ENV_FILE_NAME"
fi
MANIFEST_FILE="$WEBSITE_DIR/copilot/$SERVICE_NAME/manifest.yml"

echo "Generating manifest for $SERVICE_NAME..."

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    echo "Creating from .env.example..."
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
        echo "Please edit $ENV_FILE with your actual values, then run this script again."
        exit 1
    else
        echo "Error: .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Check if manifest exists
if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: Manifest file not found at $MANIFEST_FILE"
    exit 1
fi

# Source the .env file
set -a
source "$ENV_FILE"
set +a

# Validate required variables based on service
REQUIRED_VARS=(
    "AUTH_COGNITO_ID"
    "AUTH_COGNITO_ISSUER"
    "COGNITO_USER_POOL_ID"
    "NEXTAUTH_SECRET"
    "AUTH_SECRET"
    "AUTH_COGNITO_SECRET"
)

# Add service-specific database URLs
if [ "$SERVICE_NAME" = "ice-ai-website" ]; then
    REQUIRED_VARS+=(
        "ICE_AI_DATABASE_URL"
        "ANNA_TRAINER_DATABASE_URL"
        "AUTO_ADS_DATABASE_URL"
        "NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY"
        "NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID"
        "NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME"
        "AUTO_ADS_GOOGLE_API_KEY"
        "GEMINI_MODEL_NAME"
    )
fi

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "Error: Missing required environment variables:"
    printf '  - %s\n' "${MISSING_VARS[@]}"
    exit 1
fi

# Use envsubst to substitute variables in the current manifest
# envsubst replaces ${VAR_NAME} with actual values from environment
# Export variables explicitly for envsubst
export AUTH_COGNITO_ID AUTH_COGNITO_ISSUER COGNITO_USER_POOL_ID
export NEXTAUTH_SECRET AUTH_SECRET AUTH_COGNITO_SECRET

# Export service-specific database URLs
if [ "$SERVICE_NAME" = "ice-ai-website" ]; then
    export ICE_AI_DATABASE_URL ANNA_TRAINER_DATABASE_URL AUTO_ADS_DATABASE_URL NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME AUTO_ADS_GOOGLE_API_KEY GEMINI_MODEL_NAME
fi

# Substitute variables in manifest file using envsubst
# Create backup first
cp "$MANIFEST_FILE" "${MANIFEST_FILE}.bak"

# Substitute variables (envsubst replaces ${VAR_NAME} with actual values)
envsubst < "$MANIFEST_FILE" > "${MANIFEST_FILE}.tmp" && mv "${MANIFEST_FILE}.tmp" "$MANIFEST_FILE"

echo "Manifest generated successfully: $MANIFEST_FILE"
echo "Backup saved as: ${MANIFEST_FILE}.bak"
echo ""
echo "⚠️  WARNING: The manifest now contains real secrets!"
echo "   Do NOT commit this file to git."
echo "   Restore placeholders before committing: git checkout copilot/$SERVICE_NAME/manifest.yml"
echo ""
echo "You can now deploy with:"
if [ "$ENV_FILE_NAME" = ".env.prod" ]; then
    echo "  copilot svc deploy --name $SERVICE_NAME --env production --force"
else
    echo "  copilot svc deploy --name $SERVICE_NAME --env staging --force"
fi

