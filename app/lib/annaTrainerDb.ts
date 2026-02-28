import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/anna-trainer/schema";

// GET ANNA TRAINER DB
type AnnaTrainerDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForAnnaTrainerDb = globalThis as unknown as {
    annaTrainerDb: AnnaTrainerDb | undefined;
};

export function getAnnaTrainerDb(): AnnaTrainerDb {
    /**
     * Returns the Drizzle database client singleton for the Anna Trainer database.
     * Lazily initialises using ANNA_TRAINER_DATABASE_URL so the module can be
     * imported at build time without the env var being present.
     */

    if (globalForAnnaTrainerDb.annaTrainerDb) {
        return globalForAnnaTrainerDb.annaTrainerDb;
    }

    const connectionString = process.env.ANNA_TRAINER_DATABASE_URL;

    if (!connectionString) {
        throw new Error("ANNA_TRAINER_DATABASE_URL environment variable is not set for the Anna Trainer database client.");
    }

    const client = postgres(connectionString, {
        ssl: "require",
    });

    const db = drizzle(client, {schema});
    globalForAnnaTrainerDb.annaTrainerDb = db;
    return db;
}
