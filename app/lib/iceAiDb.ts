import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/ice-ai/schema";

// ICE AI DATABASE CLIENT

type IceAiDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForIceAiDb = globalThis as unknown as {
    iceAiDb: IceAiDb | undefined;
};

/**
 * Drizzle database client singleton for the ICE AI database.
 * Uses ICE_AI_DATABASE_URL environment variable for connection.
 */

const client = postgres(process.env.ICE_AI_DATABASE_URL!);

export const iceAiDb: IceAiDb =
    globalForIceAiDb.iceAiDb ??
    drizzle(client, {schema});

if (process.env.NODE_ENV !== "production") {
    globalForIceAiDb.iceAiDb = iceAiDb;
}
