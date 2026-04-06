// REGISTER
export async function register() {
    /* Runs once per Node server startup and prints every entry in process.env to the server console. */

    // surface env as a plain object for readable terminal output
    console.log("[website] environment variables (server):", { ...process.env });
}
