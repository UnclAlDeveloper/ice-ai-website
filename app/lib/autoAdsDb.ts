import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/auto-ads/schema";

// GET AUTO ADS DB
type AutoAdsDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForAutoAdsDb = globalThis as unknown as {
    autoAdsDb: AutoAdsDb | undefined;
};

export function getAutoAdsDb(): AutoAdsDb {
    /**
     * Returns the Drizzle database client singleton for the Auto Ads database.
     * Lazily initialises using AUTO_ADS_DATABASE_URL so the module can be
     * imported at build time without the env var being present.
     */

    if (globalForAutoAdsDb.autoAdsDb) {
        return globalForAutoAdsDb.autoAdsDb;
    }

    const connectionString = process.env.AUTO_ADS_DATABASE_URL;

    if (!connectionString) {
        throw new Error("AUTO_ADS_DATABASE_URL environment variable is not set for the Auto Ads database client.");
    }

    const client = postgres(connectionString, {
        ssl: "require",
    });

    const db = drizzle(client, {schema});
    globalForAutoAdsDb.autoAdsDb = db;
    return db;
}
