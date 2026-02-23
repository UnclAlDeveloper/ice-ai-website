#!/bin/bash
# DEPLOY CONFIG
# Configuration for the website application and environments.

# GET APP CONFIG
# Sets configuration variables for the website (single application).
get_app_config() {
    APP_NAME="ice-ai-website"
    SERVICE_NAME="ice-ai-website"
    AWS_PROFILE="ice-ai"
    AWS_REGION="eu-west-2"
    export APP_NAME SERVICE_NAME AWS_PROFILE AWS_REGION
    return 0
}

# GET ENV CONFIG
# Sets configuration variables for the specified environment.
# Usage: get_env_config "website" "staging" or get_env_config "website" "production"
get_env_config() {
    local env="$2"

    case "$env" in
        staging)
            ENV_NAME="staging"
            ENV_FILE=".env.dev"
            ENV_MANIFEST_SOURCE="copilot/environments/staging/manifest.yml"
            ;;
        production)
            ENV_NAME="production"
            ENV_FILE=".env.prod"
            ENV_MANIFEST_SOURCE="copilot/environments/production/manifest.yml"
            ;;
        *)
            echo "❌ Unknown environment: $env"
            echo "   Valid options: staging, production"
            return 1
            ;;
    esac

    ENV_MANIFEST_TARGET="copilot/environments/$ENV_NAME/manifest.yml"

    export ENV_NAME ENV_FILE ENV_MANIFEST_SOURCE ENV_MANIFEST_TARGET
    return 0
}

# PRINT CONFIG
print_config() {
    echo "Configuration:"
    echo "  APP_NAME:            $APP_NAME"
    echo "  SERVICE_NAME:        $SERVICE_NAME"
    echo "  ENV_NAME:            $ENV_NAME"
    echo "  APP_PROFILE:         ${AWS_PROFILE:-default}"
    echo "  AWS_REGION:          $AWS_REGION"
    echo "  ENV_FILE:            $ENV_FILE"
    echo "  ENV_MANIFEST_SOURCE: $ENV_MANIFEST_SOURCE"
    echo "  ENV_MANIFEST_TARGET: $ENV_MANIFEST_TARGET"
}
