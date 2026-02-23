import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/anna-trainer/schema";

// ANNA TRAINER DATABASE CLIENT

type AnnaTrainerDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForAnnaTrainerDb = globalThis as unknown as {
    annaTrainerDb: AnnaTrainerDb | undefined;
};

/**
 * Drizzle database client singleton for the Anna Trainer database.
 * Uses ANNA_TRAINER_DATABASE_URL environment variable for connection.
 */

const client = postgres(process.env.ANNA_TRAINER_DATABASE_URL!);

export const annaTrainerDb: AnnaTrainerDb =
    globalForAnnaTrainerDb.annaTrainerDb ??
    drizzle(client, {schema});

if (process.env.NODE_ENV !== "production") {
    globalForAnnaTrainerDb.annaTrainerDb = annaTrainerDb;
}
