"use server";

import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {resaleListings} from "@/drizzle/auto-ads/schema";
import {eq, ne} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";

// RESALE LISTING
export type resaleListing = typeof resaleListings.$inferSelect;
/**
 * Row shape for aa.resale_listings inferred directly from Drizzle schema.
 */

// GET RESALE LISTINGS
export async function getResaleListings(): Promise<{
    success: boolean;
    listings?: {id: number; makeAndModel: string; shortDescription: string; registration: string | null}[];
    error?: string;
}> {
    /**
     * Fetches all resale listings with a status other than 'Sold', returning
     * the id, make/model, short description, and registration for use in the
     * listing selector dropdown.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const rows = await getAutoAdsDb()
            .select({
                id: resaleListings.id,
                makeAndModel: resaleListings.makeAndModel,
                shortDescription: resaleListings.shortDescription,
                registration: resaleListings.registration,
            })
            .from(resaleListings)
            .where(ne(resaleListings.status, "Sold"));

        return {success: true, listings: rows};
    } catch (err) {
        console.error("Failed to fetch resale listings:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// GET RESALE LISTING
export async function getResaleListing(id: number): Promise<{
    success: boolean;
    listing?: resaleListing;
    error?: string;
}> {
    /**
     * Fetches a single resale listing by id for editing, returning only the
     * fields relevant to the editor form.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const [row] = await getAutoAdsDb()
            .select()
            .from(resaleListings)
            .where(eq(resaleListings.id, id));

        if (!row) {
            return {success: false, error: "Listing not found"};
        }

        return {success: true, listing: row};
    } catch (err) {
        console.error("Failed to fetch resale listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// SAVE RESALE LISTING
export async function saveResaleListing(data: resaleListing): Promise<{
    success: boolean;
    id?: number;
    error?: string;
}> {
    /**
     * Inserts a new resale listing or updates an existing one. New listings
     * get a random 16-char hex hash code and fixed defaults for timestamps.
     * Updates only touch the editable fields and updatedAt.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const now = new Date().toISOString();

        // strip fields managed by the database / this function so we can
        // spread the rest straight into the insert/update values
        const {id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest} = data;

        if (id) {
            // update existing listing
            await getAutoAdsDb()
                .update(resaleListings)
                .set({...rest, updatedAt: now})
                .where(eq(resaleListings.id, id));

            revalidatePath("/auto-ads/resales");
            return {success: true, id};
        }

        // insert new listing; let the database assign the serial id
        const [inserted] = await getAutoAdsDb()
            .insert(resaleListings)
            .values({...rest, createdAt: now, updatedAt: now})
            .returning({id: resaleListings.id});

        revalidatePath("/auto-ads/resales");
        return {success: true, id: inserted.id};
    } catch (err) {
        console.error("Failed to save resale listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}
