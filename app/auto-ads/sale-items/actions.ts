"use server";

import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {saleItems, images} from "@/drizzle/auto-ads/schema";
import {and, asc, eq} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";
import {revalidatePath} from "next/cache";
import {
    cancelEbayListingSafe,
    createEbayListingSafe,
} from "@app/auto-ads/lib/ebayListing";
import {
    buildFacebookPayload,
    type FacebookListingPayload,
} from "@app/auto-ads/lib/facebookListing";
import {saleItemToPublishable} from "@app/auto-ads/lib/listingForPublish";

// SALE ITEM
export type saleItem = typeof saleItems.$inferSelect;
/**
 * Row shape for aa.sale_items inferred directly from the Drizzle schema.
 * The lower-case alias matches the resaleListing convention so consumer
 * code reads consistently across the two listing kinds.
 */

// SALE ITEM SUMMARY
export type saleItemSummary = {
    id: number;
    title: string;
    description: string | null;
};
/**
 * Slim row used by the inventory selector dropdown so the network payload
 * stays tiny when listing items the user can resume editing.
 */

// GET SALE ITEMS
export async function getSaleItems(): Promise<{
    success: boolean;
    items?: saleItemSummary[];
    error?: string;
}> {
    /**
     * Fetches all sale items currently sitting in inventory (status =
     * 'Inventory') so the page can offer them as resumable rows in the
     * picker. Sold items are excluded from the picker but remain available
     * for retrospective viewing on the home tab.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const rows = await getAutoAdsDb()
            .select({
                id: saleItems.id,
                title: saleItems.title,
                description: saleItems.description,
            })
            .from(saleItems)
            .where(eq(saleItems.status, "Inventory"));

        return {success: true, items: rows};
    } catch (err) {
        console.error("Failed to fetch sale items:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// GET SALE ITEM
export async function getSaleItem(id: number): Promise<{
    success: boolean;
    item?: saleItem;
    error?: string;
}> {
    /**
     * Fetches a single sale item row by id for editing.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const [row] = await getAutoAdsDb()
            .select()
            .from(saleItems)
            .where(eq(saleItems.id, id));

        if (!row) {
            return {success: false, error: "Sale item not found"};
        }

        return {success: true, item: row};
    } catch (err) {
        console.error("Failed to fetch sale item:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// SAVE SALE ITEM
export async function saveSaleItem(data: saleItem): Promise<{
    success: boolean;
    id?: number;
    error?: string;
}> {
    /**
     * Inserts a new sale item or updates an existing one in place. New rows
     * pick up the current timestamp for created/updated; updates only
     * touch the editable columns and updatedAt so the original creation
     * time is preserved.
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
            await getAutoAdsDb()
                .update(saleItems)
                .set({...rest, updatedAt: now})
                .where(eq(saleItems.id, id));

            revalidatePath("/auto-ads/sale-items");
            revalidatePath("/auto-ads");
            return {success: true, id};
        }

        const [inserted] = await getAutoAdsDb()
            .insert(saleItems)
            .values({...rest, createdAt: now, updatedAt: now})
            .returning({id: saleItems.id});

        revalidatePath("/auto-ads/sale-items");
        revalidatePath("/auto-ads");
        return {success: true, id: inserted.id};
    } catch (err) {
        console.error("Failed to save sale item:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// CREATE SALE ITEM EBAY LISTING ACTION
export async function createSaleItemEbayListingAction(itemId: number): Promise<{
    success: boolean;
    ebayUrl?: string;
    error?: string;
}> {
    /**
     * Publishes or updates a sale item on eBay. Requires AdvancedTier or
     * higher and a saved item with a category, asking price, and at least
     * one image. Persists the returned listing URL and item id back onto
     * the sale_items row so subsequent edits revise the live listing in
     * place.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const userTier = getUserTier(session.user.groups);
    if (!compareTiers(userTier, "AdvancedTier")) {
        return {success: false, error: "Advanced tier or higher required to publish on eBay"};
    }

    const loaded = await getSaleItem(itemId);
    if (!loaded.success || !loaded.item) {
        return {success: false, error: loaded.error || "Sale item not found"};
    }

    const item = loaded.item;
    if (!item.ebayCategoryId?.trim()) {
        return {success: false, error: "Select an eBay category before publishing."};
    }
    if (item.askingPrice == null || item.askingPrice < 0) {
        return {success: false, error: "Set an asking price before publishing on eBay."};
    }

    // load the item's images ordered primary-first so eBay sees the cover photo
    const imageRows = await getAutoAdsDb()
        .select({id: images.id, url: images.url, isPrimary: images.isPrimary})
        .from(images)
        .where(and(
            eq(images.listingTable, "SaleItem"),
            eq(images.listingId, itemId),
        ))
        .orderBy(asc(images.id));

    if (imageRows.length === 0) {
        return {success: false, error: "Add at least one image before publishing on eBay."};
    }

    const ebayResult = await createEbayListingSafe(saleItemToPublishable(item), imageRows);
    if (!ebayResult.success) {
        const msg = ebayResult.error || "eBay request failed";
        // surface targeted hints for the most common permanent-failure
        // error ids so users do not have to dig through ebay docs
        let hint = "";
        if (/token|refresh|401|403/i.test(msg) && !/renew/i.test(msg)) {
            hint = "Check AUTO_ADS_EBAY_REFRESH_TOKEN and OAuth scopes if this persists.";
        } else if (/\bid 25713\b|This Offer is not available/i.test(msg)) {
            hint =
                "eBay 25713 usually means: (a) the category needs item specifics we did not supply, " +
                "(b) the business policies (fulfillment/payment/return) are not registered for this " +
                "marketplace, or (c) the merchant location is not active for this marketplace.";
        }
        const combined = hint ? `${msg}\n${hint}` : msg;
        return {success: false, error: combined};
    }

    const toSave: saleItem = {
        ...item,
        eBayUrl: ebayResult.ebayUrl,
        ebayItemId: ebayResult.ebayItemId ?? item.ebayItemId,
    };
    const saved = await saveSaleItem(toSave);
    if (!saved.success) {
        return {
            success: false,
            error: saved.error || "Item published on eBay but failed to save the URL locally.",
        };
    }

    return {success: true, ebayUrl: ebayResult.ebayUrl};
}

// CANCEL SALE ITEM EBAY LISTING ACTION
export async function cancelSaleItemEbayListingAction(itemId: number): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Cancels a sale item's eBay listing using the listing id extracted
     * from the stored eBay URL, then clears eBayUrl and ebayItemId on the
     * local row.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const userTier = getUserTier(session.user.groups);
    if (!compareTiers(userTier, "AdvancedTier")) {
        return {success: false, error: "Advanced tier or higher required to cancel on eBay"};
    }

    const loaded = await getSaleItem(itemId);
    if (!loaded.success || !loaded.item) {
        return {success: false, error: loaded.error || "Sale item not found"};
    }

    const item = loaded.item;
    if (!item.eBayUrl?.trim()) {
        return {success: false, error: "No eBay URL is stored for this item."};
    }

    const ebayResult = await cancelEbayListingSafe(saleItemToPublishable(item));
    if (!ebayResult.success) {
        const msg = ebayResult.error || "eBay cancellation failed";
        const hint =
            /token|refresh|401|403/i.test(msg) && !/renew/i.test(msg)
                ? "Check AUTO_ADS_EBAY_REFRESH_TOKEN and OAuth scopes if this persists."
                : "";
        const combined = hint ? `${msg}\n${hint}` : msg;
        return {success: false, error: combined};
    }

    const toSave: saleItem = {
        ...item,
        eBayUrl: null,
        ebayItemId: null,
    };
    const saved = await saveSaleItem(toSave);
    if (!saved.success) {
        return {
            success: false,
            error: saved.error || "Item cancelled on eBay but failed to clear local URL.",
        };
    }

    return {success: true};
}

// BUILD SALE ITEM FACEBOOK LISTING PAYLOAD ACTION
export async function buildSaleItemFacebookListingPayloadAction(itemId: number): Promise<{
    success: boolean;
    payload?: FacebookListingPayload;
    error?: string;
}> {
    /**
     * Builds the pre-fill payload the client uses to assist a Facebook
     * Marketplace post for a sale item. Mirrors the resale flow but uses
     * the generic Marketplace item create URL since Facebook has no
     * vehicle-style wizard for non-vehicles.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const loaded = await getSaleItem(itemId);
    if (!loaded.success || !loaded.item) {
        return {success: false, error: loaded.error || "Sale item not found"};
    }

    try {
        const payload = buildFacebookPayload(saleItemToPublishable(loaded.item));
        return {success: true, payload};
    } catch (err) {
        console.error("Failed to build Facebook payload for sale item:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// SAVE SALE ITEM FACEBOOK URL
export async function saveSaleItemFacebookUrl(itemId: number, url: string | null): Promise<{
    success: boolean;
    error?: string;
}> {
    /**
     * Persists the Facebook Marketplace listing URL on the sale item row
     * after the user has published (or cleared) the listing manually.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    const loaded = await getSaleItem(itemId);
    if (!loaded.success || !loaded.item) {
        return {success: false, error: loaded.error || "Sale item not found"};
    }

    const normalised = url?.trim() ? url.trim() : null;

    const toSave: saleItem = {
        ...loaded.item,
        facebookUrl: normalised,
    };
    const saved = await saveSaleItem(toSave);
    if (!saved.success) {
        return {
            success: false,
            error: saved.error || "Failed to save Facebook URL.",
        };
    }

    return {success: true};
}
