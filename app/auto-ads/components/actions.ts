"use server";

import {randomBytes} from "crypto";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, images} from "@/drizzle/auto-ads/schema";
import {eq, and, asc} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";
import {AWSAccess} from "@app/lib/AwsAccess";

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
        const rows = await getAutoAdsDb()
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
        await getAutoAdsDb()
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

// UPLOAD LISTING IMAGE
export async function uploadListingImage(formData: FormData): Promise<{
    success: boolean;
    image?: {id: number; url: string; isPrimary: boolean | null};
    error?: string;
}> {
    /**
     * Accepts a file via FormData, uploads it to S3 under a unique key derived
     * from the listing id, then inserts a row into the images table with the
     * resulting public URL. Returns the new image record.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const file = formData.get("file") as File | null;
    const listingId = Number(formData.get("listingId"));
    const listingTableVal = (formData.get("listingTable") as string) || "Prospect";

    if (!file || !listingId) {
        return {success: false, error: "Missing file or listing id"};
    }

    try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const imageHash = randomBytes(8).toString("hex");
        const buffer = Buffer.from(await file.arrayBuffer());

        // matches the Python pattern: bucket=AUTO_ADS_BUCKET, media_dir="images", sub_dir="prospects"
        const aws = new AWSAccess(
            process.env.AUTO_ADS_BUCKET || "",
            "prospects",
            undefined,
            undefined,
            undefined,
            "images",
        );
        await aws.saveMedia(imageHash, ext, buffer);
        const url = aws.getMediaUrl(imageHash, ext);

        // flag as primary when the listing has no existing images
        const existing = await getAutoAdsDb()
            .select({id: images.id})
            .from(images)
            .where(and(
                eq(images.listingTable, listingTableVal as "Prospect" | "Resale"),
                eq(images.listingId, listingId),
            ))
            .limit(1);

        const [inserted] = await getAutoAdsDb()
            .insert(images)
            .values({
                url,
                listingId,
                listingTable: listingTableVal as "Prospect" | "Resale",
                createdAt: new Date().toISOString(),
                isPrimary: existing.length === 0,
            })
            .returning({id: images.id, url: images.url, isPrimary: images.isPrimary});

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        return {success: true, image: inserted};
    } catch (err) {
        console.error("Failed to upload listing image:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DELETE LISTING IMAGE
export async function deleteListingImage(imageId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Removes an image record from the database by id. The underlying S3 object
     * is left in place to avoid cross-origin deletion issues with scraped URLs.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        await getAutoAdsDb()
            .delete(images)
            .where(eq(images.id, imageId));

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        return {success: true};
    } catch (err) {
        console.error("Failed to delete listing image:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}
