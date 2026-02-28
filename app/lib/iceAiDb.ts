import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/ice-ai/schema";

// GET ICE AI DB
type IceAiDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForIceAiDb = globalThis as unknown as {
    iceAiDb: IceAiDb | undefined;
};

export function getIceAiDb(): IceAiDb {
    /**
     * Returns the Drizzle database client singleton for the ICE AI database.
     * Lazily initialises using ICE_AI_DATABASE_URL so the module can be
     * imported at build time without the env var being present.
     */

    if (globalForIceAiDb.iceAiDb) {
        return globalForIceAiDb.iceAiDb;
    }

    const connectionString = process.env.ICE_AI_DATABASE_URL;

    if (!connectionString) {
        throw new Error("ICE_AI_DATABASE_URL environment variable is not set for the ICE AI database client.");
    }

    const client = postgres(connectionString, {
        ssl: "require",
    });

    const db = drizzle(client, {schema});
    globalForIceAiDb.iceAiDb = db;
    return db;
}
