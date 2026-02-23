"use server";

import {autoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, images} from "@/drizzle/auto-ads/schema";
import {eq, and, asc} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";

// FETCH LISTING IMAGES
export async function fetchListingImages(
    listingTable: "Prospect" | "Resale",
    listingId: number,
): Promise<{success: boolean; images?: {id: number; url: string; isPrimary: boolean | null}[]; error?: string}> {
    /**
     * Retrieves all images for a given listing, ordered by their database id
     * so that the display order matches the insertion order.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const rows = await autoAdsDb
            .select({
                id: images.id,
                url: images.url,
                isPrimary: images.isPrimary,
            })
            .from(images)
            .where(
                and(
                    eq(images.listingTable, listingTable),
                    eq(images.listingId, listingId),
                )
            )
            .orderBy(asc(images.id));

        return {success: true, images: rows};
    } catch (err) {
        console.error("Failed to fetch listing images:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// UPDATE PROSPECT INTEREST
export async function updateProspectInterest(
    listingId: number,
    interestLevel: number,
    status: 'Not Interested' | 'Interested',
    adsEstBuyPrice: number | null,
    adsEstSellPrice: number | null,
): Promise<{success: boolean; error?: string}> {
    /**
     * Persists a user's interest rating, estimated buy/sell prices, and derived
     * status for a prospect listing. Revalidates the prospects and search pages
     * so the UI reflects the saved changes.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        await autoAdsDb
            .update(prospectListings)
            .set({
                interestLevel,
                status,
                adsEstBuyPrice,
                adsEstSellPrice,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(prospectListings.id, listingId));

        revalidatePath("/auto-ads/prospects");
        revalidatePath("/auto-ads/search");
        return {success: true};
    } catch (err) {
        console.error("Failed to update prospect interest:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}
