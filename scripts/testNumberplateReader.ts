import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {eq, and} from "drizzle-orm";
import * as schema from "../drizzle/auto-ads/schema";
import {readNumberplateFromUrl} from "../app/auto-ads/lib/numberplateReader";
import {loadEnv} from "./loadEnv";

// hydrate process.env from the shared .env plus the per-environment override
loadEnv();

const {prospectListings, images} = schema;

// MAIN
async function main() {
    /**
     * Iterates through all ManualEntry prospect listings, finds each one's
     * primary image, and attempts to read the numberplate via Gemini.
     */

    const connectionString = process.env.AUTO_ADS_DATABASE_URL;
    if (!connectionString) {
        console.error("AUTO_ADS_DATABASE_URL is not set");
        process.exit(1);
    }

    const client = postgres(connectionString, {ssl: "require"});
    const db = drizzle(client, {schema});

    // fetch all ManualEntry prospect listings with their primary image
    const rows = await db
        .select({
            listingId: prospectListings.id,
            makeAndModel: prospectListings.makeAndModel,
            registration: prospectListings.registration,
            imageUrl: images.url,
        })
        .from(prospectListings)
        .innerJoin(
            images,
            and(
                eq(images.listingTable, "Prospect"),
                eq(images.listingId, prospectListings.id),
                eq(images.isPrimary, true),
            ),
        )
        .where(eq(prospectListings.listingSource, "ManualEntry"));

    console.log(`Found ${rows.length} ManualEntry prospect listing(s) with a primary image.\n`);

    for (const row of rows) {
        console.log(`--- Listing #${row.listingId}: ${row.makeAndModel} ---`);
        console.log(`  Stored registration: ${row.registration ?? "(none)"}`);
        console.log(`  Image URL: ${row.imageUrl}`);

        const plate = await readNumberplateFromUrl(row.imageUrl);
        console.log(`  Gemini numberplate:  ${plate ?? "(none detected)"}\n`);
    }

    // close the database connection
    await client.end();
    console.log("Done.");
}

main().catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
});
