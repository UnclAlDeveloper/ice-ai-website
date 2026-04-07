// REGISTER
export async function register() {
    /* Runs once per Node server startup and prints every entry in process.env to the server console. */

    // surface env as a plain object with keys in alphabetical order for readable terminal output
    const sortedEnv = Object.fromEntries(
        Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b)),
    );
    console.log("[website] environment variables (server):", sortedEnv);
}
