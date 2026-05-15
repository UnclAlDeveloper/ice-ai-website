import {readFileSync, existsSync} from "fs";
import {resolve} from "path";

// LOAD ENV FILE
function loadEnvFile(filePath: string): void {
    /**
     * Reads a `.env`-style file and copies its key/value pairs into
     * `process.env`, overwriting any existing entries. Lines starting with `#`
     * and empty lines are skipped, and surrounding single or double quotes are
     * stripped from values so quoted phrases like names with spaces load cleanly.
     */

    if (!existsSync(filePath)) {
        console.warn(`[loadEnv] env file not found: ${filePath}`);
        return;
    }

    // walk every line and copy into process.env, overriding earlier loads
    for (const line of readFileSync(filePath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!key) continue;
        process.env[key] = val;
    }
}

// LOAD ENV
export function loadEnv(): void {
    /**
     * Hydrates `process.env` for local helper scripts using the same layering
     * the rest of the codebase uses: read the shared `../../.env` first, then
     * override with the per-environment file (`.env.dev` for dev/staging,
     * `.env.prod` for production). The active environment is taken from the
     * `ENVIRONMENT` env var (defaults to `dev`).
     */

    // resolve repo root: this file lives in website/scripts/
    const repoRoot = resolve(__dirname, "../../");

    // pick the override file based on ENVIRONMENT, mirroring python/environments.py
    const envName = (process.env.ENVIRONMENT ?? "dev").toLowerCase();
    const overrideName = envName === "production" ? ".env.prod" : ".env.dev";

    // shared base first, then per-env override on top
    loadEnvFile(resolve(repoRoot, ".env"));
    loadEnvFile(resolve(repoRoot, overrideName));
}
