#!/bin/bash
# DEPLOY LIB
# Shared functions for deployment scripts.
# Source this file in deploy scripts: source "$(dirname "$0")/scripts/deploy-lib.sh"

# Track state for cleanup
MANIFESTS_GENERATED=0
WORKSPACE_MODIFIED=0

# ============================================================================
# WORKSPACE MANAGEMENT
# ============================================================================

# SETUP WORKSPACE
# Temporarily updates the copilot workspace file to point to the target application.
# This is needed because copilot uses the workspace file to determine the current app.
setup_workspace() {
    local app_name="$1"
    local workspace_file="${WEBSITE_DIR:-$PROJECT_ROOT/website}/copilot/.workspace"
    local workspace_backup="${WEBSITE_DIR:-$PROJECT_ROOT/website}/copilot/.workspace.backup"

    # check current workspace application
    local current_app=""
    if [ -f "$workspace_file" ]; then
        current_app=$(grep "^application:" "$workspace_file" | sed 's/application: //' | tr -d ' ')
    fi

    # if workspace is registered to a different app, temporarily update it
    if [ -n "$current_app" ] && [ "$current_app" != "$app_name" ]; then
        echo "Updating workspace from '$current_app' to '$app_name'..."
        cp "$workspace_file" "$workspace_backup"
        echo "application: $app_name" > "$workspace_file"
        WORKSPACE_MODIFIED=1
    fi
}

# RESTORE WORKSPACE
# Restores the workspace file to its original state after deployment.
restore_workspace() {
    local workspace_file="${WEBSITE_DIR:-$PROJECT_ROOT/website}/copilot/.workspace"
    local workspace_backup="${WEBSITE_DIR:-$PROJECT_ROOT/website}/copilot/.workspace.backup"

    if [ $WORKSPACE_MODIFIED -eq 1 ] && [ -f "$workspace_backup" ]; then
        mv "$workspace_backup" "$workspace_file"
        echo "Workspace restored to original application"
    fi
}

# ============================================================================
# MANIFEST PLACEHOLDER MANAGEMENT
# ============================================================================

# CHECK MANIFEST PLACEHOLDERS
# Returns 0 if manifest contains ${...} placeholders, 1 otherwise.
check_manifest_placeholders() {
    local manifest_file="$1"

    if grep -q '\${' "$manifest_file" 2>/dev/null; then
        return 0  # has placeholders
    else
        return 1  # no placeholders (might have real secrets)
    fi
}

# CLEANUP MANIFESTS
# Restores manifest placeholders on error or exit.
cleanup_manifests() {
    if [ $MANIFESTS_GENERATED -eq 1 ]; then
        echo ""
        echo "Cleaning up: Restoring manifest placeholders..."
        "${WEBSITE_DIR:-$PROJECT_ROOT/website}/scripts/restore-manifests.sh" || true
    fi
}

# ============================================================================
# ENVIRONMENT MANAGEMENT
# ============================================================================

# ENSURE ENVIRONMENT
# Checks if the copilot environment exists, initializes it if not.
ensure_environment() {
    local app_name="$1"
    local env_name="$2"
    local aws_region="$3"

    echo "Checking if environment '$env_name' exists for application '$app_name'..."

    # change to website directory where copilot workspace is located
    local original_dir="$(pwd)"
    cd "${WEBSITE_DIR:-$PROJECT_ROOT/website}" || return 1

    # check if environment exists by trying to show it
    local env_exists=0
    if copilot env show --app "$app_name" --name "$env_name" &>/dev/null; then
        echo "✓ Environment '$env_name' already exists for application '$app_name'"
        env_exists=1
    fi

    # initialize if it doesn't exist
    if [ $env_exists -eq 0 ]; then
        echo "Environment '$env_name' does not exist. Initializing..."
        local init_cmd="copilot env init --app \"$app_name\" --name \"$env_name\" --region \"$aws_region\" --default-config"
        if [ -n "$AWS_PROFILE" ]; then
            init_cmd="$init_cmd --profile \"$AWS_PROFILE\""
        else
            init_cmd="$init_cmd --profile default"
        fi

        if eval "$init_cmd"; then
            echo "✓ Environment '$env_name' initialized successfully"
        else
            cd "$original_dir" || true
            echo "❌ Failed to initialize environment '$env_name'"
            return 1
        fi
    fi

    cd "$original_dir" || true
    return 0
}

# ============================================================================
# SERVICE MANAGEMENT
# ============================================================================

# ENSURE SERVICE
# Checks if the copilot service exists, initializes it if not.
ensure_service() {
    local app_name="$1"
    local service_name="$2"
    local manifest_file="$3"

    echo "Checking if service '$service_name' exists in application '$app_name'..."

    # change to website directory where copilot workspace is located
    local original_dir="$(pwd)"
    cd "${WEBSITE_DIR:-$PROJECT_ROOT/website}" || return 1

    # check if service exists by trying to show it
    local svc_exists=0
    if copilot svc show --app "$app_name" --name "$service_name" &>/dev/null; then
        echo "✓ Service '$service_name' already exists in application '$app_name'"
        svc_exists=1
    fi

    # initialize if it doesn't exist
    if [ $svc_exists -eq 0 ]; then
        echo "Service '$service_name' does not exist in application. Initializing..."

        # check if manifest exists
        if [ ! -f "$manifest_file" ]; then
            cd "$original_dir" || true
            echo "❌ Error: Service manifest not found at $manifest_file"
            echo "   Cannot initialize service without a manifest file."
            return 1
        fi

        # read service type from manifest
        local svc_type=$(grep "^type:" "$manifest_file" | sed 's/type: //' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
        if [ "$svc_type" = "Load Balanced Web Service" ] || [ "$svc_type" = "LoadBalancedWebService" ]; then
            svc_type="Load Balanced Web Service"
        fi

        local dockerfile_path=$(grep -A1 "^image:" "$manifest_file" | grep "build:" | sed 's/build: //' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
        if [ -z "$dockerfile_path" ]; then
            dockerfile_path="Dockerfile"
        fi

        local port=$(grep "^  port:" "$manifest_file" | sed 's/port: //' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
        if [ -z "$port" ]; then
            port="3000"
        fi

        # build init command
        local init_cmd="copilot svc init --app \"$app_name\" --name \"$service_name\" --svc-type \"$svc_type\" --dockerfile \"$dockerfile_path\" --port $port"

        # backup manifest before init (in case it gets modified)
        local manifest_backup="${manifest_file}.pre-init-backup"
        cp "$manifest_file" "$manifest_backup"

        if eval "$init_cmd"; then
            # restore original manifest if init created a new one
            if [ -f "$manifest_file" ] && ! diff -q "$manifest_file" "$manifest_backup" &>/dev/null; then
                echo "Restoring original manifest file..."
                mv "$manifest_backup" "$manifest_file"
            else
                rm -f "$manifest_backup"
            fi
            echo "✓ Service '$service_name' initialized successfully"
        else
            # restore manifest backup on failure
            if [ -f "$manifest_backup" ]; then
                mv "$manifest_backup" "$manifest_file"
            fi
            cd "$original_dir" || true
            echo "❌ Failed to initialize service '$service_name'"
            return 1
        fi
    fi

    cd "$original_dir" || true
    return 0
}

# ============================================================================
# VALIDATION
# ============================================================================

# VALIDATE DOMAIN ALIASES
# Checks that all domain aliases in the manifest have hosted_zone configured.
validate_domain_aliases() {
    local manifest_file="$1"
    local service_name="$2"
    local errors=0

    echo "Validating domain aliases in $service_name manifest..."

    # extract domain aliases using yq or python (fallback to grep if neither available)
    local aliases=""
    if command -v yq &> /dev/null; then
        aliases=$(yq eval '.http.alias[]?.name // .http.alias[]' "$manifest_file" 2>/dev/null || true)
    elif command -v python3 &> /dev/null; then
        aliases=$(python3 -c "
import yaml
import sys
try:
    with open('$manifest_file', 'r') as f:
        data = yaml.safe_load(f)
        aliases = data.get('http', {}).get('alias', [])
        for alias in aliases:
            if isinstance(alias, dict):
                print(alias.get('name', ''))
            else:
                print(alias)
except Exception as e:
    sys.exit(1)
" 2>/dev/null || true)
    else
        echo "⚠️  Warning: yq or python3 not found. Skipping domain alias validation."
        echo "   Install yq (https://github.com/mikefarah/yq) for better validation."
        return 0
    fi

    # check each alias
    while IFS= read -r alias_entry; do
        if [ -z "$alias_entry" ]; then
            continue
        fi

        local domain_name="$alias_entry"
        local has_hosted_zone=$(grep -A1 "name: $domain_name" "$manifest_file" | grep -q "hosted_zone:" && echo "yes" || echo "no")

        if [ "$has_hosted_zone" = "no" ]; then
            echo "❌ Error: Domain alias '$domain_name' is missing hosted_zone configuration"
            echo "   Each domain alias must specify a hosted_zone ID."
            echo "   Example:"
            echo "     alias:"
            echo "       - name: $domain_name"
            echo "         hosted_zone: Z1234567890ABC"
            errors=$((errors + 1))
        else
            echo "✓ Domain alias '$domain_name' has hosted_zone configured"
        fi
    done <<< "$aliases"

    if [ $errors -gt 0 ]; then
        echo ""
        echo "❌ Found $errors domain alias error(s). Please fix the manifest before deploying."
        return 1
    fi

    return 0
}

# ============================================================================
# DEPLOYMENT
# ============================================================================

# DEPLOY ENVIRONMENT
# Deploys the copilot environment.
deploy_environment() {
    local app_name="$1"
    local env_name="$2"

    echo ""
    echo "Deploying environment..."

    # change to website directory where copilot workspace is located
    local original_dir="$(pwd)"
    cd "${WEBSITE_DIR:-$PROJECT_ROOT/website}" || return 1
    copilot env deploy --app "$app_name" --name "$env_name" || true
    cd "$original_dir" || true
}

# DEPLOY SERVICE
# Deploys the copilot service.
deploy_service() {
    local app_name="$1"
    local service_name="$2"
    local env_name="$3"

    echo ""
    echo "Deploying service..."

    # change to website directory where copilot workspace is located
    local original_dir="$(pwd)"
    cd "${WEBSITE_DIR:-$PROJECT_ROOT/website}" || return 1
    copilot svc deploy --app "$app_name" --name "$service_name" --env "$env_name" --force
    cd "$original_dir" || true
}

# ============================================================================
# DATABASE MIGRATION
# ============================================================================

# DEPLOY SINGLE DATABASE
# Deploys a single database using Drizzle migrations.
# For staging: generates migrations first (if schema changed), then applies them
# For production: applies existing versioned migrations only (safer, auditable)
#
# Arguments:
#   $1 - Database name (e.g., "ice-ai", "anna-trainer", "auto-ads")
#   $2 - Environment name ("staging" or "production")
#   $3 - Database URL environment variable name (e.g., "ICE_AI_DATABASE_URL")
deploy_single_database() {
    local db_name="$1"
    local env_name="$2"
    local db_url_var="$3"
    local db_url="${!db_url_var}"

    if [ -z "$db_url" ]; then
        echo "⚠️  Warning: $db_url_var not found in environment file"
        return 0
    fi

    echo ""
    echo "Deploying $db_name database schema..."

    # for staging, generate migrations first to capture any schema changes
    if [ "$env_name" != "production" ]; then
        echo "  Generating migrations for any schema changes..."
        if npm run "db:$db_name:generate" 2>&1 | tee /tmp/drizzle-generate-$db_name.log; then
            # check if any new migrations were generated
            if grep -q "No schema changes" /tmp/drizzle-generate-$db_name.log 2>/dev/null; then
                echo "  No schema changes detected"
            elif grep -q "Your SQL migration file" /tmp/drizzle-generate-$db_name.log 2>/dev/null; then
                echo "  ⚠️  New migration file generated - remember to commit it!"
            fi
        else
            echo "  ⚠️  Warning: Migration generation had issues (continuing anyway)"
        fi
        rm -f /tmp/drizzle-generate-$db_name.log
    fi

    # apply migrations
    echo "  Applying migrations..."
    if npm run "db:$db_name:migrate"; then
        echo "✓ $db_name database schema updated successfully"
        return 0
    else
        echo "❌ Failed to update $db_name database schema"
        echo ""
        echo "   Troubleshooting hints:"
        echo "   - Verify database connectivity"
        echo "   - Check migration files in drizzle/$db_name/migrations/"
        echo "   - Try running manually: npm run db:$db_name:migrate"
        return 1
    fi
}

# DEPLOY ICE AI DATABASES
# Runs Drizzle migrations for all ice-ai databases (ice-ai, anna-trainer, auto-ads).
# For staging: auto-generates migrations for schema changes, then applies them.
# For production: applies existing versioned migrations only (safer, auditable).
deploy_ice_ai_databases() {
    local env_file="$1"
    local env_name="${2:-staging}"
    local failed_count=0

    if [ -z "$env_file" ]; then
        echo "❌ Environment file path is required"
        return 1
    fi

    if [ ! -f "$env_file" ]; then
        echo "⚠️  Warning: Environment file not found at $env_file"
        echo "   Skipping database migrations"
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "Deploying ice-ai databases ($env_name)"
    echo "=========================================="

    # load environment variables from .env file
    set -a
    source "$env_file"
    set +a

    # change to website directory where drizzle configs are located
    local original_dir="$(pwd)"
    cd "${WEBSITE_DIR:-$PROJECT_ROOT/website}" || return 1

    # check if npm is available
    if ! command -v npm &> /dev/null; then
        echo "⚠️  Warning: npm not found, skipping database migrations"
        cd "$original_dir" || true
        return 0
    fi

    # deploy each database
    deploy_single_database "ice-ai" "$env_name" "ICE_AI_DATABASE_URL" || ((failed_count++))
    deploy_single_database "anna-trainer" "$env_name" "ANNA_TRAINER_DATABASE_URL" || ((failed_count++))
    deploy_single_database "auto-ads" "$env_name" "AUTO_ADS_DATABASE_URL" || ((failed_count++))

    cd "$original_dir" || true

    # report summary
    echo ""
    if [ $failed_count -eq 0 ]; then
        echo "✓ All ice-ai databases deployed successfully"
        return 0
    else
        echo "⚠️  $failed_count database(s) failed to deploy"
        return 1
    fi
}

# DEPLOY UNCL AL DATABASES
# Runs Drizzle migrations for all uncl-al databases (uncl-al, market-horizons, love-alpha).
# For staging: auto-generates migrations for schema changes, then applies them.
# For production: applies existing versioned migrations only (safer, auditable).
deploy_uncl_al_databases() {
    local env_file="$1"
    local env_name="${2:-staging}"
    local failed_count=0

    if [ -z "$env_file" ]; then
        echo "❌ Environment file path is required"
        return 1
    fi

    if [ ! -f "$env_file" ]; then
        echo "⚠️  Warning: Environment file not found at $env_file"
        echo "   Skipping database migrations"
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "Deploying uncl-al databases ($env_name)"
    echo "=========================================="

    # load environment variables from .env file
    set -a
    source "$env_file"
    set +a

    # change to website directory where drizzle configs are located
    local original_dir="$(pwd)"
    cd "${WEBSITE_DIR:-$PROJECT_ROOT/website}" || return 1

    # check if npm is available
    if ! command -v npm &> /dev/null; then
        echo "⚠️  Warning: npm not found, skipping database migrations"
        cd "$original_dir" || true
        return 0
    fi

    # deploy each database
    deploy_single_database "uncl-al" "$env_name" "UNCL_AL_DATABASE_URL" || ((failed_count++))
    deploy_single_database "market-horizons" "$env_name" "MARKET_HORIZONS_DATABASE_URL" || ((failed_count++))
    deploy_single_database "love-alpha" "$env_name" "LOVE_ALPHA_DATABASE_URL" || ((failed_count++))

    cd "$original_dir" || true

    # report summary
    echo ""
    if [ $failed_count -eq 0 ]; then
        echo "✓ All uncl-al databases deployed successfully"
        return 0
    else
        echo "⚠️  $failed_count database(s) failed to deploy"
        return 1
    fi
}

