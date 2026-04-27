"use server";

import {randomBytes} from "crypto";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, resaleListings, saleItems, images} from "@/drizzle/auto-ads/schema";
import {eq, and, asc} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";
import {revalidatePath} from "next/cache";
import {AWSAccess} from "@app/lib/AwsAccess";
import {readNumberplateFromUrl, readNumberplateFromBuffer} from "@app/auto-ads/lib/numberplateReader";
import {lookupVehicle} from "@app/auto-ads/lib/dvlaVehicleEnquiry";
import {generateDescription, suggestSellingPrice} from "@app/auto-ads/lib/descriptionGenerator";
import type {resaleListing} from "@app/auto-ads/resales/actions";
import {getResaleListing, saveResaleListing} from "@app/auto-ads/resales/actions";
import {cancelEbayListingSafe, createEbayListingSafe} from "@app/auto-ads/lib/ebayListing";
import {buildFacebookPayload, type FacebookListingPayload} from "@app/auto-ads/lib/facebookListing";
import {resaleToPublishable} from "@app/auto-ads/lib/listingForPublish";

// LISTING TABLE
type ListingTable = "Prospect" | "Resale" | "SaleItem";
/**
 * Union of every listing kind that owns images and per-row pages. Kept in
 * one spot so server actions and the image table cast in step when a new
 * listing kind is introduced.
 */

// FETCH LISTING IMAGES
export async function fetchListingImages(
    listingTable: ListingTable,
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

        // use explicit isPrimary when provided, otherwise auto-detect
        const isPrimaryRaw = formData.get("isPrimary");
        let isPrimary: boolean;
        if (isPrimaryRaw !== null) {
            isPrimary = isPrimaryRaw === "true";
        } else {
            const existing = await getAutoAdsDb()
                .select({id: images.id})
                .from(images)
                .where(and(
                    eq(images.listingTable, listingTableVal as ListingTable),
                    eq(images.listingId, listingId),
                ))
                .limit(1);
            isPrimary = existing.length === 0;
        }

        const [inserted] = await getAutoAdsDb()
            .insert(images)
            .values({
                url,
                listingId,
                listingTable: listingTableVal as ListingTable,
                createdAt: new Date().toISOString(),
                isPrimary,
            })
            .returning({id: images.id, url: images.url, isPrimary: images.isPrimary});

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        revalidatePath("/auto-ads/sale-items");
        return {success: true, image: inserted};
    } catch (err) {
        console.error("Failed to upload listing image:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DELETE PROSPECT LISTING
export async function deleteProspectListing(listingId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Removes a prospect listing and all of its associated images. Each image
     * hosted in our S3 bucket is deleted from storage first, then all image
     * rows and the listing row itself are removed from the database.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // fetch all images belonging to this listing
        const imageRows = await getAutoAdsDb()
            .select({id: images.id})
            .from(images)
            .where(
                and(
                    eq(images.listingTable, "Prospect"),
                    eq(images.listingId, listingId),
                )
            );

        // delete each image from s3 and the database
        for (const img of imageRows) {
            await deleteListingImage(img.id);
        }

        // delete the prospect listing itself
        await getAutoAdsDb()
            .delete(prospectListings)
            .where(eq(prospectListings.id, listingId));

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        return {success: true};
    } catch (err) {
        console.error("Failed to delete prospect listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// COPY PROSPECT TO RESALE
export async function copyProspectToResale(prospectListingId: number): Promise<{
    success: boolean;
    id?: number;
    alreadyCopied?: boolean;
    error?: string;
}> {
    /**
     * Copies a prospect listing into the resale_listings table, linking the two
     * via prospect_id. Fields not present on resale listings (url, AI analysis
     * fields, interestLevel, etc.) are omitted. aiSellPriceLow and
     * aiSellPriceHigh are intentionally excluded per the copy policy. If a
     * resale listing already exists for this prospect, returns alreadyCopied
     * without inserting a duplicate. Revalidates the prospects and resales pages
     * after a successful insert.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // fetch the prospect listing to copy from
        const [prospect] = await getAutoAdsDb()
            .select()
            .from(prospectListings)
            .where(eq(prospectListings.id, prospectListingId))
            .limit(1);

        if (!prospect) {
            return {success: false, error: "Prospect listing not found"};
        }

        // check whether a resale listing already exists for this prospect
        const [existing] = await getAutoAdsDb()
            .select({id: resaleListings.id})
            .from(resaleListings)
            .where(eq(resaleListings.prospectId, prospectListingId))
            .limit(1);

        if (existing) {
            return {success: true, id: existing.id, alreadyCopied: true};
        }

        const now = new Date().toISOString();

        // insert resale listing copied from prospect, excluding ai sell prices and url
        const [inserted] = await getAutoAdsDb()
            .insert(resaleListings)
            .values({
                prospectId: prospect.id,
                createdAt: now,
                updatedAt: now,
                listingSource: prospect.listingSource,
                status: "Bought",
                makeAndModel: prospect.makeAndModel,
                shortDescription: prospect.shortDescription,
                fullDescription: prospect.fullDescription,
                mileage: prospect.mileage,
                mileageUnit: prospect.mileageUnit,
                year: prospect.year,
                registration: prospect.registration,
                currencySymbol: prospect.currencySymbol,
                askingPrice: prospect.askingPrice,
                vatStatus: prospect.vatStatus,
                location: prospect.location,
                bodyType: prospect.bodyType,
                cabType: prospect.cabType,
                fuelType: prospect.fuelType,
                gearboxType: prospect.gearboxType,
                wheelbase: prospect.wheelbase,
                engineSize: prospect.engineSize,
                colour: prospect.colour,
                seats: prospect.seats,
                emissionClass: prospect.emissionClass,
                numberOfOwners: prospect.numberOfOwners,
                serviceHistory: prospect.serviceHistory,
                basicHistoryCheck: prospect.basicHistoryCheck,
                motStatus: prospect.motStatus,
                motExpiry: prospect.motExpiry,
                specsAndFeatures: prospect.specsAndFeatures,
                taxStatus: prospect.taxStatus,
                taxDueDate: prospect.taxDueDate,
                co2Emissions: prospect.co2Emissions,
                markedForExport: prospect.markedForExport,
                dateOfLastV5CIssued: prospect.dateOfLastV5CIssued,
                monthOfFirstRegistration: prospect.monthOfFirstRegistration,
                typeApproval: prospect.typeApproval,
                revenueWeight: prospect.revenueWeight,
                adsPrice: null,
                ebayCategoryId: null,
                eBayUrl: null,
                facebookUrl: "",
            })
            .returning({id: resaleListings.id});

        revalidatePath("/auto-ads/prospects");
        revalidatePath("/auto-ads/resales");
        return {success: true, id: inserted.id};
    } catch (err) {
        console.error("Failed to copy prospect to resale:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DELETE RESALE LISTING
export async function deleteResaleListing(listingId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Removes a resale listing and all of its associated images. Each image
     * hosted in our S3 bucket is deleted from storage first, then all image
     * rows and the listing row itself are removed from the database.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // fetch all images belonging to this listing
        const imageRows = await getAutoAdsDb()
            .select({id: images.id})
            .from(images)
            .where(
                and(
                    eq(images.listingTable, "Resale"),
                    eq(images.listingId, listingId),
                )
            );

        // delete each image from s3 and the database
        for (const img of imageRows) {
            await deleteListingImage(img.id);
        }

        // delete the resale listing itself
        await getAutoAdsDb()
            .delete(resaleListings)
            .where(eq(resaleListings.id, listingId));

        revalidatePath("/auto-ads/resales");
        return {success: true};
    } catch (err) {
        console.error("Failed to delete resale listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DELETE LISTING IMAGE
export async function deleteListingImage(imageId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Deletes an image by first removing it from S3 (if it is hosted in our
     * bucket), then deleting the corresponding row from the images table.
     * External / scraped URLs are left untouched on their origin servers.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // fetch the image record so we have the url for s3 deletion
        const [image] = await getAutoAdsDb()
            .select({id: images.id, url: images.url})
            .from(images)
            .where(eq(images.id, imageId))
            .limit(1);

        if (!image) {
            return {success: false, error: "Image not found"};
        }

        // only attempt s3 deletion for images hosted in our bucket
        const bucket = process.env.AUTO_ADS_BUCKET || "";
        if (bucket && image.url.includes(`${bucket}.s3.`)) {
            const urlPath = new URL(image.url).pathname.slice(1);
            const lastSlash = urlPath.lastIndexOf("/");
            const filename = urlPath.slice(lastSlash + 1);
            const dotIndex = filename.indexOf(".");
            const name = filename.slice(0, dotIndex);
            const mediaType = filename.slice(dotIndex + 1);

            const aws = new AWSAccess(
                bucket,
                "prospects",
                undefined,
                undefined,
                undefined,
                "images",
            );
            await aws.removeMedia(name, mediaType);
        }

        await getAutoAdsDb()
            .delete(images)
            .where(eq(images.id, imageId));

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        revalidatePath("/auto-ads/sale-items");
        return {success: true};
    } catch (err) {
        console.error("Failed to delete listing image:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DELETE SALE ITEM
export async function deleteSaleItem(itemId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Removes a sale item and all of its images. Mirrors deleteResaleListing:
     * each image hosted in our S3 bucket is deleted from storage first, then
     * the image rows and the sale item row are removed from the database.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // fetch all images belonging to this sale item
        const imageRows = await getAutoAdsDb()
            .select({id: images.id})
            .from(images)
            .where(
                and(
                    eq(images.listingTable, "SaleItem"),
                    eq(images.listingId, itemId),
                )
            );

        // delete each image from s3 and the database
        for (const img of imageRows) {
            await deleteListingImage(img.id);
        }

        // delete the sale item row itself
        await getAutoAdsDb()
            .delete(saleItems)
            .where(eq(saleItems.id, itemId));

        revalidatePath("/auto-ads/sale-items");
        revalidatePath("/auto-ads");
        return {success: true};
    } catch (err) {
        console.error("Failed to delete sale item:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DETECT NUMBERPLATE
export async function detectNumberplate(imageUrl: string): Promise<{
    success: boolean;
    numberplate?: string | null;
    error?: string;
}> {
    /**
     * Sends an image URL to Gemini to read the vehicle numberplate.
     * Returns the detected plate text or null if none was found.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const plate = await readNumberplateFromUrl(imageUrl);
        return {success: true, numberplate: plate};
    } catch (err) {
        console.error("Failed to detect numberplate:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// DETECT NUMBERPLATE FROM FILE
export async function detectNumberplateFromFile(formData: FormData): Promise<{
    success: boolean;
    numberplate?: string | null;
    error?: string;
}> {
    /**
     * Accepts a raw image file via FormData and sends it directly to Gemini
     * to read the numberplate, without uploading to S3 first. Used during the
     * initial photo capture step before the listing has been created.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const file = formData.get("file") as File | null;
    if (!file) {
        return {success: false, error: "No file provided"};
    }

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || "image/jpeg";
        const plate = await readNumberplateFromBuffer(buffer, mimeType);
        return {success: true, numberplate: plate};
    } catch (err) {
        console.error("Failed to detect numberplate from file:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// CREATE EBAY LISTING ACTION
export async function createEbayListingAction(listingId: number): Promise<{
    success: boolean;
    ebayUrl?: string;
    error?: string;
}> {
    /**
     * Publishes or updates a resale listing on eBay via the Inventory API,
     * then persists the returned item URL on the resale row. Requires
     * AdvancedTier or higher and a saved listing with category, asking price,
     * and at least one image.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const userTier = getUserTier(session.user.groups);
    if (!compareTiers(userTier, "AdvancedTier")) {
        return {success: false, error: "Advanced tier or higher required to publish on eBay"};
    }

    const loaded = await getResaleListing(listingId);
    if (!loaded.success || !loaded.listing) {
        return {success: false, error: loaded.error || "Listing not found"};
    }

    const listing = loaded.listing;

    if (!listing.ebayCategoryId?.trim()) {
        return {success: false, error: "Select an eBay category before publishing."};
    }
    if (listing.askingPrice == null || listing.askingPrice < 0) {
        return {success: false, error: "Set an asking price before publishing on eBay."};
    }

    const imgResult = await fetchListingImages("Resale", listingId);
    if (!imgResult.success || !imgResult.images?.length) {
        return {success: false, error: "Add at least one image before publishing on eBay."};
    }

    const ebayResult = await createEbayListingSafe(resaleToPublishable(listing), imgResult.images);
    if (!ebayResult.success) {
        const msg = ebayResult.error || "eBay request failed";
        const hint =
            /token|refresh|401|403/i.test(msg) && !/renew/i.test(msg)
                ? "Check AUTO_ADS_EBAY_REFRESH_TOKEN and OAuth scopes if this persists."
                : "";

        // place the hint on its own line so multi-line eBay errors stay readable
        const combined = hint ? `${msg}\n${hint}` : msg;
        return {success: false, error: combined};
    }

    const toSave: resaleListing = {
        ...listing,
        eBayUrl: ebayResult.ebayUrl,
        ebayItemId: ebayResult.ebayItemId ?? listing.ebayItemId,
    };
    const saved = await saveResaleListing(toSave);
    if (!saved.success) {
        return {
            success: false,
            error: saved.error || "Listing published on eBay but failed to save the URL locally.",
        };
    }

    return {success: true, ebayUrl: ebayResult.ebayUrl};
}

// CANCEL EBAY LISTING ACTION
export async function cancelEbayListingAction(listingId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Cancels a resale listing on eBay using the listing id extracted from the
     * stored eBay URL, then clears eBayUrl and ebayItemId on the local row.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const userTier = getUserTier(session.user.groups);
    if (!compareTiers(userTier, "AdvancedTier")) {
        return {success: false, error: "Advanced tier or higher required to cancel on eBay"};
    }

    const loaded = await getResaleListing(listingId);
    if (!loaded.success || !loaded.listing) {
        return {success: false, error: loaded.error || "Listing not found"};
    }

    const listing = loaded.listing;
    if (!listing.eBayUrl?.trim()) {
        return {success: false, error: "No eBay URL is stored for this listing."};
    }

    const ebayResult = await cancelEbayListingSafe(resaleToPublishable(listing));
    if (!ebayResult.success) {
        const msg = ebayResult.error || "eBay cancellation failed";
        const hint =
            /token|refresh|401|403/i.test(msg) && !/renew/i.test(msg)
                ? "Check AUTO_ADS_EBAY_REFRESH_TOKEN and OAuth scopes if this persists."
                : "";
        const combined = hint ? `${msg}\n${hint}` : msg;
        return {success: false, error: combined};
    }

    const toSave: resaleListing = {
        ...listing,
        eBayUrl: null,
        ebayItemId: null,
    };
    const saved = await saveResaleListing(toSave);
    if (!saved.success) {
        return {
            success: false,
            error: saved.error || "Listing cancelled on eBay but failed to clear local URL.",
        };
    }

    return {success: true};
}

// BUILD FACEBOOK LISTING PAYLOAD ACTION
export async function buildFacebookListingPayloadAction(listingId: number): Promise<{
    success: boolean;
    payload?: FacebookListingPayload;
    error?: string;
}> {
    /**
     * Builds the pre-fill payload the client uses to assist a Facebook
     * Marketplace post: a formatted title and description for the clipboard,
     * plus the correct target URL (the create wizard, or the existing item
     * page for updates). No external API calls and no photos are involved;
     * photos are handled by the dedicated ZIP download route so edits that
     * only change description or price do not trigger an image fetch.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const loaded = await getResaleListing(listingId);
    if (!loaded.success || !loaded.listing) {
        return {success: false, error: loaded.error || "Listing not found"};
    }

    try {
        const payload = buildFacebookPayload(resaleToPublishable(loaded.listing));
        return {success: true, payload};
    } catch (err) {
        console.error("Failed to build Facebook listing payload:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// SAVE RESALE FACEBOOK URL
export async function saveResaleFacebookUrl(listingId: number, url: string | null): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Persists the Facebook Marketplace listing URL on the resale row after
     * the user has published (or cleared) the listing manually. Accepts
     * null or an empty string to clear the stored URL when the Marketplace
     * listing has been removed or the vehicle has been sold.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const loaded = await getResaleListing(listingId);
    if (!loaded.success || !loaded.listing) {
        return {success: false, error: loaded.error || "Listing not found"};
    }

    // normalise whitespace and empty strings to null so the column is
    // cleanly cleared when the user removes the URL
    const normalised = url?.trim() ? url.trim() : null;

    const toSave: resaleListing = {
        ...loaded.listing,
        facebookUrl: normalised,
    };
    const saved = await saveResaleListing(toSave);
    if (!saved.success) {
        return {
            success: false,
            error: saved.error || "Failed to save Facebook URL.",
        };
    }

    return {success: true};
}

// GENERATE RESALE DESCRIPTION
export async function generateResaleDescription(
    formData: resaleListing,
): Promise<{success: boolean; description?: string; specsAndFeatures?: string | null; error?: string}> {
    /**
     * Fetches all images for the resale listing (if it has been saved), then
     * calls the Gemini API with the vehicle details and those images to produce
     * a compelling listing description and a specs & features list. Returns
     * both generated sections or an error.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // fetch image urls for the listing if it already exists
        let imageUrls: string[] = [];
        if (formData.id) {
            const imageRows = await getAutoAdsDb()
                .select({url: images.url})
                .from(images)
                .where(
                    and(
                        eq(images.listingTable, "Resale"),
                        eq(images.listingId, formData.id),
                    )
                )
                .orderBy(asc(images.id));
            imageUrls = imageRows.map((r) => r.url);
        }

        const result = await generateDescription(
            {
                makeAndModel: formData.makeAndModel,
                shortDescription: formData.shortDescription,
                year: formData.year,
                registration: formData.registration,
                colour: formData.colour,
                bodyType: formData.bodyType,
                cabType: formData.cabType,
                fuelType: formData.fuelType,
                gearboxType: formData.gearboxType,
                engineSize: formData.engineSize,
                seats: formData.seats,
                mileage: formData.mileage,
                mileageUnit: formData.mileageUnit,
                numberOfOwners: formData.numberOfOwners,
                serviceHistory: formData.serviceHistory,
                basicHistoryCheck: formData.basicHistoryCheck,
                motStatus: formData.motStatus,
                motExpiry: formData.motExpiry,
                taxStatus: formData.taxStatus,
                emissionClass: formData.emissionClass,
                location: formData.location,
                specsAndFeatures: formData.specsAndFeatures,
            },
            imageUrls,
        );

        if (!result) {
            return {success: false, error: "Gemini returned an empty description"};
        }

        return {success: true, description: result.description, specsAndFeatures: result.specsAndFeatures};
    } catch (err) {
        console.error("Failed to generate resale description:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// GENERATE RESALE SELL PRICE
export async function generateResaleSellPrice(
    formData: resaleListing,
): Promise<{success: boolean; low?: number; high?: number; error?: string}> {
    /**
     * Fetches all images for the resale listing (if it has been saved), then
     * calls the Gemini API with the vehicle details and those images to produce
     * a suggested retail selling price range. Returns the low and high bounds
     * in GBP, or an error if the API call or response parsing fails.
     * Requires AdvancedTier or higher (Admins included).
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const userTier = getUserTier(session.user.groups);
    if (!compareTiers(userTier, "AdvancedTier")) {
        return {success: false, error: "Advanced tier or higher required for AI sell price"};
    }

    try {
        // fetch image urls for the listing if it already exists
        let imageUrls: string[] = [];
        if (formData.id) {
            const imageRows = await getAutoAdsDb()
                .select({url: images.url})
                .from(images)
                .where(
                    and(
                        eq(images.listingTable, "Resale"),
                        eq(images.listingId, formData.id),
                    )
                )
                .orderBy(asc(images.id));
            imageUrls = imageRows.map((r) => r.url);
        }

        const range = await suggestSellingPrice(
            {
                makeAndModel: formData.makeAndModel,
                shortDescription: formData.shortDescription,
                year: formData.year,
                registration: formData.registration,
                colour: formData.colour,
                bodyType: formData.bodyType,
                cabType: formData.cabType,
                fuelType: formData.fuelType,
                gearboxType: formData.gearboxType,
                engineSize: formData.engineSize,
                seats: formData.seats,
                mileage: formData.mileage,
                mileageUnit: formData.mileageUnit,
                numberOfOwners: formData.numberOfOwners,
                serviceHistory: formData.serviceHistory,
                basicHistoryCheck: formData.basicHistoryCheck,
                motStatus: formData.motStatus,
                motExpiry: formData.motExpiry,
                taxStatus: formData.taxStatus,
                emissionClass: formData.emissionClass,
                location: formData.location,
                specsAndFeatures: formData.specsAndFeatures,
            },
            imageUrls,
        );

        if (!range) {
            return {success: false, error: "Gemini returned an unparseable price range"};
        }

        return {success: true, low: range.low, high: range.high};
    } catch (err) {
        console.error("Failed to generate resale sell price:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// TO MIXED CASE
function toMixedCase(value: string): string {
    /**
     * Converts an all-uppercase string from the DVLA API into title case,
     * capitalising the first letter of each word and lowercasing the rest.
     * Numeric tokens (e.g. "2") are left unchanged.
     */

    return value
        .split(" ")
        .map(word => word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
        .join(" ");
}

// DVLA VEHICLE DATA
export interface DvlaVehicleData {
    /**
     * Subset of DVLA response fields mapped to prospectListing column names,
     * ready for the UI to merge into the editor form state.
     */

    makeAndModel: string | null;
    year: number | null;
    colour: string | null;
    fuelType: string | null;
    wheelplan: string | null;
    engineSize: string | null;
    motStatus: string | null;
    motExpiry: string | null;
    emissionClass: string | null;
    taxStatus: string | null;
    taxDueDate: string | null;
    co2Emissions: number | null;
    markedForExport: boolean | null;
    dateOfLastV5CIssued: string | null;
    monthOfFirstRegistration: string | null;
    typeApproval: string | null;
    revenueWeight: number | null;
}

// LOOKUP REGISTRATION
export async function lookupRegistration(registrationNumber: string): Promise<{
    success: boolean;
    data?: DvlaVehicleData;
    error?: string;
}> {
    /**
     * Calls the DVLA Vehicle Enquiry Service for the given registration and
     * maps the response into field names matching the prospect listing form.
     * Engine capacity is formatted as e.g. "1796cc" for display.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const vehicle = await lookupVehicle(registrationNumber);

        console.log("DVLA vehicle enquiry response:", vehicle);

        // normalise uppercase dvla strings to mixed case, with fuel type alias
        const rawFuel = vehicle.fuelType ?? null;
        const normalisedFuel = rawFuel
            ? (rawFuel.toUpperCase() === "ELECTRICITY" ? "Electric" : toMixedCase(rawFuel))
            : null;

        const data: DvlaVehicleData = {
            makeAndModel: vehicle.make ? toMixedCase(vehicle.make) : null,
            year: vehicle.yearOfManufacture ?? null,
            colour: vehicle.colour ? toMixedCase(vehicle.colour) : null,
            fuelType: normalisedFuel,
            wheelplan: vehicle.wheelplan ? toMixedCase(vehicle.wheelplan) : null,
            engineSize: vehicle.engineCapacity ? `${vehicle.engineCapacity}cc` : null,
            motStatus: vehicle.motStatus ?? null,
            motExpiry: vehicle.motExpiryDate ?? null,
            emissionClass: vehicle.euroStatus ?? null,
            taxStatus: vehicle.taxStatus ?? null,
            taxDueDate: vehicle.taxDueDate ?? null,
            co2Emissions: vehicle.co2Emissions ?? null,
            markedForExport: vehicle.markedForExport ?? null,
            dateOfLastV5CIssued: vehicle.dateOfLastV5CIssued ?? null,
            monthOfFirstRegistration: vehicle.monthOfFirstRegistration ?? null,
            typeApproval: vehicle.typeApproval ?? null,
            revenueWeight: vehicle.revenueWeight ?? null,
        };

        return {success: true, data};
    } catch (err) {
        console.error("Failed to look up registration:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}
