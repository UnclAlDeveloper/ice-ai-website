import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/auto-ads/schema";

// AUTO ADS DATABASE CLIENT

type AutoAdsDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForAutoAdsDb = globalThis as unknown as {
    autoAdsDb: AutoAdsDb | undefined;
};

/**
 * Drizzle database client singleton for the Auto Ads database.
 * Uses AUTO_ADS_DATABASE_URL environment variable for connection.
 */

const client = postgres(process.env.AUTO_ADS_DATABASE_URL!);

export const autoAdsDb: AutoAdsDb =
    globalForAutoAdsDb.autoAdsDb ??
    drizzle(client, {schema});

if (process.env.NODE_ENV !== "production") {
    globalForAutoAdsDb.autoAdsDb = autoAdsDb;
}
