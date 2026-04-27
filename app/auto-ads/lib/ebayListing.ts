import eBayApi from "ebay-api";
import {ebayUseSandbox, getEbayApiClient} from "@app/auto-ads/lib/ebayClient";
import {
    createOrReviseClassifiedAd,
    formatTradingError,
    isVehicleCategory,
} from "@app/auto-ads/lib/ebayTrading";
import {
    listingSku as buildListingSku,
    type PublishableListing,
} from "@app/auto-ads/lib/listingForPublish";

// LISTING IMAGE ROW
export type ListingImageRow = {id: number; url: string; isPrimary: boolean | null};
/**
 * Minimal image row from the aa.images table used when ordering URLs for eBay.
 */

// CURRENCY SYMBOL TO ISO
function currencySymbolToIso(symbol: string | null): string {
    /**
     * Maps common currency symbols to ISO 4217 codes for eBay pricing.
     */

    if (!symbol) return "GBP";
    const s = symbol.trim();
    if (s === "£" || s.toUpperCase() === "GBP") return "GBP";
    if (s === "$" || s.toUpperCase() === "USD") return "USD";
    if (s === "€" || s.toUpperCase() === "EUR") return "EUR";
    return "GBP";
}

// EBAY TITLE MAX LENGTH
const EBAY_TITLE_MAX = 80;

// TRUNCATE TITLE
function truncateTitle(title: string): string {
    /**
     * Clips the listing title to eBay's maximum title length.
     */

    if (title.length <= EBAY_TITLE_MAX) return title;
    return title.slice(0, EBAY_TITLE_MAX - 1) + "…";
}

// SPECS TO FEATURE ASPECTS
function specsToFeatureLines(specsAndFeatures: string | null): string[] {
    /**
     * Splits multiline specs & features into non-empty lines for the Features
     * aspect. Any leading markdown bullet marker ("- ", "* ", or "• ") is
     * stripped because eBay joins multi-valued aspects with commas and the
     * bullet glyphs would otherwise show up inline on the item page.
     */

    if (!specsAndFeatures?.trim()) return [];
    return specsAndFeatures
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^(?:[-*•])\s+/, "").trim())
        .filter(Boolean);
}

// SORT IMAGE URLS PRIMARY FIRST
function sortImageUrls(images: ListingImageRow[]): string[] {
    /**
     * Orders image URLs with the primary image first, then insertion order.
     */

    const primary = images.filter((i) => i.isPrimary === true);
    const rest = images.filter((i) => i.isPrimary !== true);
    return [...primary, ...rest].map((i) => i.url);
}

// ADD ASPECT
function addAspect(aspects: Record<string, string[]>, name: string, value: string | number | null | undefined) {
    /**
     * Appends a single string value to an aspect name if the value is present.
     */

    if (value === null || value === undefined || value === "") return;
    const str = typeof value === "number" ? String(value) : String(value).trim();
    if (!str) return;
    aspects[name] = [str];
}

// BUILD ASPECTS
function buildAspects(listing: PublishableListing): Record<string, string[]> {
    /**
     * Maps a publishable listing's vehicle aspects (when present) to eBay
     * product aspects (item specifics). When the listing's `vehicle` field
     * is undefined we instead emit a small set of placeholder aspects
     * ("Brand=Unbranded", "MPN=Does Not Apply") so that publishOffer does
     * not reject the listing for having zero aspects — eBay's REST
     * Inventory API rejects most publishes with errorId 25713 when the
     * inventory item carries no aspects at all.
     */

    const aspects: Record<string, string[]> = {};

    const vehicle = listing.vehicle;
    if (vehicle) {
        addAspect(aspects, "Year", vehicle.year);
        // ebay's mileage aspect must be numeric only; the unit is implied
        // by the marketplace (miles on uk, km on most eu sites) so we never
        // append a unit here even when one is set
        addAspect(aspects, "Mileage", vehicle.mileage);
        addAspect(aspects, "Fuel Type", vehicle.fuelType);
        addAspect(aspects, "Transmission", vehicle.gearboxType);
        addAspect(aspects, "Colour", vehicle.colour);
        addAspect(aspects, "Body Type", vehicle.bodyType);
        addAspect(aspects, "Engine Size", vehicle.engineSize);
        addAspect(aspects, "Seats", vehicle.seats);
        addAspect(aspects, "Previous owners", vehicle.numberOfOwners);
        addAspect(aspects, "Vehicle Registration Mark", vehicle.registration);
        addAspect(aspects, "MOT Expiry Date", vehicle.motExpiry);
        addAspect(aspects, "MOT status", vehicle.motStatus);
        addAspect(aspects, "Emission class", vehicle.emissionClass);
    } else {
        // baseline placeholder aspects for non-vehicle (sale item) listings.
        // ebay treats "Unbranded" and "Does Not Apply" as legitimate values
        // across most consumer categories and prefers them over empty
        // aspect objects, which trigger error 25713 at publish time
        addAspect(aspects, "Brand", "Unbranded");
        addAspect(aspects, "MPN", "Does Not Apply");
    }

    const features = specsToFeatureLines(listing.specsAndFeatures);
    if (features.length > 0) {
        aspects.Features = features;
    }

    return aspects;
}

// BUILD INVENTORY ITEM BODY
export function buildInventoryItemBody(
    listing: PublishableListing,
    images: ListingImageRow[],
): Record<string, unknown> {
    /**
     * Produces the JSON body for createOrReplaceInventoryItem from the
     * publishable listing and its images.
     */

    const description = listing.body?.trim() || listing.title || "";

    const imageUrls = sortImageUrls(images);
    const aspects = buildAspects(listing);

    const merchantLocationKey = process.env.AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY?.trim();
    if (!merchantLocationKey) {
        throw new Error("AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY is not set.");
    }

    // declare BOTH ship-to-location and pickup-at-location availability so
    // the inventory item is publishable under any fulfillment policy: the
    // sale-items flow is most often used with large/heavy items where the
    // configured fulfillment policy is local-pickup-only, and ebay rejects
    // publishOffer with a fieldless 25713 ("This Offer is not available")
    // when a LOCAL_PICKUP policy is paired with an inventory item that has
    // no pickupAtLocationAvailability entry. fulfillment policies that
    // support shipping simply use shipToLocationAvailability and ignore
    // the pickup block, so this is safe across all policy types.
    return {
        condition: "USED_GOOD",
        product: {
            title: truncateTitle(listing.title),
            description,
            imageUrls,
            aspects,
        },
        availability: {
            shipToLocationAvailability: {
                quantity: 1,
                availabilityDistributions: [
                    {
                        merchantLocationKey,
                        quantity: 1,
                    },
                ],
            },
            pickupAtLocationAvailability: [
                {
                    merchantLocationKey,
                    quantity: 1,
                    availabilityType: "IN_STOCK",
                },
            ],
        },
    };
}

// BUILD OFFER CREATE BODY
function buildOfferCreateBody(listing: PublishableListing, sku: string): Record<string, unknown> {
    /**
     * Builds the payload for createOffer including policies, price, and category.
     */

    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;
    const merchantLocationKey = process.env.AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY?.trim();
    const fulfillmentPolicyId = process.env.AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID?.trim();
    const paymentPolicyId = process.env.AUTO_ADS_EBAY_PAYMENT_POLICY_ID?.trim();
    const returnPolicyId = process.env.AUTO_ADS_EBAY_RETURN_POLICY_ID?.trim();

    if (!merchantLocationKey) {
        throw new Error("AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY is not set.");
    }
    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
        throw new Error(
            "eBay business policies are not configured: set AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID, AUTO_ADS_EBAY_PAYMENT_POLICY_ID, and AUTO_ADS_EBAY_RETURN_POLICY_ID.",
        );
    }

    if (!listing.ebayCategoryId?.trim()) {
        throw new Error("eBay category is required.");
    }
    if (listing.askingPrice == null || listing.askingPrice < 0) {
        throw new Error("Asking price is required to publish on eBay.");
    }

    const currency = currencySymbolToIso(listing.currencySymbol);

    return {
        sku,
        marketplaceId,
        format: "FIXED_PRICE",
        categoryId: listing.ebayCategoryId.trim(),
        merchantLocationKey,
        availableQuantity: 1,
        pricingSummary: {
            price: {
                value: String(listing.askingPrice),
                currency,
            },
        },
        listingPolicies: {
            fulfillmentPolicyId,
            paymentPolicyId,
            returnPolicyId,
        },
    };
}

// BUILD OFFER UPDATE BODY
function buildOfferUpdateBody(listing: PublishableListing): Record<string, unknown> {
    /**
     * Builds the payload for updateOffer (fields allowed without sku/marketplaceId).
     */

    if (!listing.ebayCategoryId?.trim()) {
        throw new Error("eBay category is required.");
    }
    if (listing.askingPrice == null || listing.askingPrice < 0) {
        throw new Error("Asking price is required to publish on eBay.");
    }

    const currency = currencySymbolToIso(listing.currencySymbol);
    const merchantLocationKey = process.env.AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY?.trim();
    const fulfillmentPolicyId = process.env.AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID?.trim();
    const paymentPolicyId = process.env.AUTO_ADS_EBAY_PAYMENT_POLICY_ID?.trim();
    const returnPolicyId = process.env.AUTO_ADS_EBAY_RETURN_POLICY_ID?.trim();

    if (!merchantLocationKey) {
        throw new Error("AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY is not set.");
    }
    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
        throw new Error(
            "eBay business policies are not configured: set AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID, AUTO_ADS_EBAY_PAYMENT_POLICY_ID, and AUTO_ADS_EBAY_RETURN_POLICY_ID.",
        );
    }

    return {
        categoryId: listing.ebayCategoryId.trim(),
        merchantLocationKey,
        availableQuantity: 1,
        pricingSummary: {
            price: {
                value: String(listing.askingPrice),
                currency,
            },
        },
        listingPolicies: {
            fulfillmentPolicyId,
            paymentPolicyId,
            returnPolicyId,
        },
    };
}

// LISTING URL FROM MARKETPLACE
function listingUrlForMarketplace(marketplaceId: string, listingId: string): string {
    /**
     * Returns a consumer-facing item URL for the published listing id.
     */

    const sandboxPrefix = ebayUseSandbox() ? "sandbox." : "";
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) {
        return `https://www.${sandboxPrefix}ebay.co.uk/itm/${listingId}`;
    }
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) {
        return `https://www.${sandboxPrefix}ebay.com/itm/${listingId}`;
    }
    return `https://www.${sandboxPrefix}ebay.com/itm/${listingId}`;
}

// FORMAT EBAY ERROR
function formatEbayError(err: unknown): string {
    /**
     * Extracts a readable message from an eBay REST API or axios error,
     * returning every reported error on its own line (with error id,
     * category, parameter hints and inputRefIds) so the caller can
     * surface the full set of issues rather than just the first one.
     * inputRefIds are particularly useful for diagnosis because eBay
     * uses them to point at the JSON path of the offending request
     * field (e.g. "$.product.aspects.Brand").
     */

    if (!(err instanceof Error)) return String(err);

    type EbayRestParameter = {name?: string; value?: string | number};
    type EbayRestError = {
        errorId?: string | number;
        domain?: string;
        category?: string;
        message?: string;
        longMessage?: string;
        inputRefIds?: string[];
        outputRefIds?: string[];
        parameters?: EbayRestParameter[];
    };
    const anyErr = err as Error & {meta?: {res?: {data?: unknown}}};
    const data = anyErr.meta?.res?.data;
    if (data && typeof data === "object" && "errors" in data) {
        const errors = (data as {errors?: EbayRestError[]}).errors;
        if (Array.isArray(errors) && errors.length > 0) {
            const lines: string[] = [];
            for (const entry of errors) {
                if (!entry || typeof entry !== "object") continue;
                const codeParts: string[] = [];
                if (entry.category) codeParts.push(entry.category);
                if (entry.errorId !== undefined) codeParts.push(`id ${entry.errorId}`);
                const prefix = codeParts.length > 0 ? `[${codeParts.join(" ")}] ` : "";
                const body =
                    entry.longMessage ||
                    entry.message ||
                    (entry.errorId !== undefined ? `eBay error ${entry.errorId}` : "");
                if (!prefix && !body) continue;

                const hints: string[] = [];

                // include any parameter hints (e.g. which field caused the issue)
                if (Array.isArray(entry.parameters) && entry.parameters.length > 0) {
                    const paramText = entry.parameters
                        .map((p) => (p?.name ? `${p.name}=${p.value ?? ""}` : String(p?.value ?? "")))
                        .filter(Boolean)
                        .join(", ");
                    if (paramText) hints.push(paramText);
                }

                // surface inputRefIds: json paths into the request body that
                // ebay flags as the source of the error (e.g. "$.condition"
                // when the condition is invalid for the chosen category).
                // for error 25713 these are usually the only diagnostic clue
                // the api gives us
                if (Array.isArray(entry.inputRefIds) && entry.inputRefIds.length > 0) {
                    hints.push(`fields: ${entry.inputRefIds.join(", ")}`);
                }

                const suffix = hints.length > 0 ? ` (${hints.join("; ")})` : "";

                lines.push(`${prefix}${body}${suffix}`.trim());
            }
            if (lines.length > 0) return lines.join("\n");
        }
    }
    return err.message;
}

// EBAY LISTING RESULT
export type EbayListingResult = {ebayUrl: string; ebayItemId: string | null};
/**
 * Return shape from createEbayListing. ebayItemId is populated for the Trading
 * path (UK vehicle Classified Ads) and left null for the Inventory path, which
 * only exposes a marketplace listingId via the offer response.
 */


// EXTRACT LISTING ID FROM URL
function extractListingIdFromEbayUrl(ebayUrl: string | null | undefined): string | null {
    /**
     * Extracts the numeric listing id from an eBay item URL such as
     * https://www.ebay.co.uk/itm/123456789012.
     */

    if (!ebayUrl?.trim()) return null;
    const m = ebayUrl.match(/\/itm\/(\d+)/i);
    return m?.[1] ?? null;
}


// CANCEL EBAY LISTING INVENTORY
async function cancelEbayListingInventory(
    listing: PublishableListing,
    listingIdToCancel: string,
): Promise<void> {
    /**
     * Cancels a published non-vehicle listing by finding the corresponding
     * offer for the listing's SKU and withdrawing that offer.
     */

    const ebay = await getEbayApiClient();
    const sku = buildListingSku(listing);
    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;
    type OfferRow = {
        offerId?: string;
        sku?: string;
        listing?: {listingId?: string};
    };

    const offersResponse = await ebay.sell.inventory.getOffers({sku, marketplaceId});
    const offers = (offersResponse?.offers ?? []) as OfferRow[];
    const matched = offers.find((offer) => offer.listing?.listingId === listingIdToCancel);

    if (!matched?.offerId) {
        throw new Error("Could not find the published eBay offer to cancel for this listing.");
    }

    await ebay.sell.inventory.withdrawOffer(matched.offerId);
}


// CANCEL EBAY LISTING TRADING
async function cancelEbayListingTrading(listingIdToCancel: string): Promise<void> {
    /**
     * Cancels a vehicle/classified listing via Trading API EndItem.
     */

    const ebay = await getEbayApiClient();
    const tradingClient = (ebay as unknown as {
        trading: {EndItem: (body: unknown) => Promise<unknown>};
    }).trading;
    await tradingClient.EndItem({
        ItemID: listingIdToCancel,
        EndingReason: "NotAvailable",
    });
}


// CANCEL EBAY LISTING
export async function cancelEbayListing(
    listing: PublishableListing,
): Promise<void> {
    /**
     * Cancels the current eBay listing by extracting its item/listing id from
     * the stored eBay URL, then dispatching to Trading EndItem for vehicle
     * routes or Inventory withdrawOffer for non-vehicle routes.
     */

    if (!listing.id) {
        throw new Error("Listing must be saved before cancelling on eBay.");
    }

    const listingIdToCancel = extractListingIdFromEbayUrl(listing.eBayUrl);
    if (!listingIdToCancel) {
        throw new Error("Could not extract an eBay listing id from the stored URL.");
    }

    if (await isVehicleCategory(listing.ebayCategoryId)) {
        await cancelEbayListingTrading(listingIdToCancel);
        return;
    }

    await cancelEbayListingInventory(listing, listingIdToCancel);
}


// CANCEL EBAY LISTING SAFE
export async function cancelEbayListingSafe(
    listing: PublishableListing,
): Promise<{success: true} | {success: false; error: string}> {
    /**
     * Wraps cancelEbayListing and returns a structured result suitable for
     * server actions. Formats Trading and Inventory errors consistently with
     * the create/update publish path.
     */

    const usedTrading = await isVehicleCategory(listing.ebayCategoryId);
    try {
        await cancelEbayListing(listing);
        return {success: true};
    } catch (err) {
        console.error("eBay listing cancellation failed:", err);
        const message = usedTrading ? formatTradingError(err) : formatEbayError(err);
        // EndItem returns this when the listing has already ended; treat cancel
        // as idempotent success so local eBayUrl can still be cleared.
        if (/auction has been closed|listing has ended|item has ended|already ended/i.test(message)) {
            return {success: true};
        }
        return {success: false, error: message};
    }
}


// DEBUG INVENTORY PUBLISH
function debugInventoryPublish(): boolean {
    /**
     * Returns true when AUTO_ADS_EBAY_DEBUG_PUBLISH is set to a truthy value,
     * which gates the verbose request/response logging used to diagnose
     * publish failures (notably the fieldless 25713 errors eBay returns
     * when an inventory item or offer is structurally rejected without
     * pointing at a specific field).
     */

    const flag = (process.env.AUTO_ADS_EBAY_DEBUG_PUBLISH || "").toLowerCase();
    return flag === "1" || flag === "true" || flag === "yes";
}

// CREATE EBAY LISTING INVENTORY
async function createEbayListingInventory(
    listing: PublishableListing,
    images: ListingImageRow[],
): Promise<EbayListingResult> {
    /**
     * Publishes a non-vehicle listing via the REST Sell Inventory API. Creates
     * or replaces the inventory item, creates or updates the offer, then
     * publishes it and returns the public listing URL.
     */

    const sku = buildListingSku(listing);
    const ebay = await getEbayApiClient();
    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;

    const inventoryBody = buildInventoryItemBody(listing, images);
    if (debugInventoryPublish()) {
        console.log(`[ebay-debug] sku=${sku} marketplaceId=${marketplaceId}`);
        console.log("[ebay-debug] inventoryBody:", JSON.stringify(inventoryBody, null, 2));
    }
    await ebay.sell.inventory.createOrReplaceInventoryItem(sku, inventoryBody);

    const offersResponse = await ebay.sell.inventory.getOffers({sku, marketplaceId});
    type OfferRow = {
        offerId?: string;
        sku?: string;
        status?: string;
        listing?: {listingId?: string};
    };
    const offers = (offersResponse?.offers ?? []) as OfferRow[];

    const existing = offers.find((o) => o.sku === sku);
    if (debugInventoryPublish()) {
        console.log(
            `[ebay-debug] existing offer: ${existing ? `${existing.offerId} status=${existing.status}` : "<none>"}`,
        );
    }

    if (existing?.offerId) {
        const offerId = existing.offerId;
        const updateBody = buildOfferUpdateBody(listing);
        if (debugInventoryPublish()) {
            console.log("[ebay-debug] updateOffer body:", JSON.stringify(updateBody, null, 2));
        }
        await ebay.sell.inventory.updateOffer(offerId, updateBody);

        if (existing.status !== "PUBLISHED") {
            if (debugInventoryPublish()) {
                console.log(`[ebay-debug] publishOffer offerId=${offerId}`);
            }
            const published = await ebay.sell.inventory.publishOffer(offerId);
            const listingId = (published as {listingId?: string})?.listingId;
            if (!listingId) {
                throw new Error("eBay publish succeeded but no listing id was returned.");
            }
            return {
                ebayUrl: listingUrlForMarketplace(marketplaceId, listingId),
                ebayItemId: null,
            };
        }

        let listingId = existing.listing?.listingId;
        if (!listingId) {
            const refreshed = await ebay.sell.inventory.getOffer(offerId);
            listingId = (refreshed as OfferRow)?.listing?.listingId;
        }
        if (!listingId) {
            throw new Error("Could not resolve eBay listing id after update.");
        }
        return {
            ebayUrl: listingUrlForMarketplace(marketplaceId, listingId),
            ebayItemId: null,
        };
    }

    const createBody = buildOfferCreateBody(listing, sku);
    if (debugInventoryPublish()) {
        console.log("[ebay-debug] createOffer body:", JSON.stringify(createBody, null, 2));
    }
    const created = await ebay.sell.inventory.createOffer(createBody);
    const newOfferId = (created as {offerId?: string})?.offerId ?? "";
    if (!newOfferId) {
        throw new Error("eBay createOffer succeeded but no offer id was returned.");
    }
    if (debugInventoryPublish()) {
        console.log(`[ebay-debug] createOffer returned offerId=${newOfferId}`);
        console.log(`[ebay-debug] publishOffer offerId=${newOfferId}`);
    }

    const published = await ebay.sell.inventory.publishOffer(newOfferId);
    const listingId = (published as {listingId?: string})?.listingId;
    if (!listingId) {
        throw new Error("eBay publish succeeded but no listing id was returned.");
    }

    return {
        ebayUrl: listingUrlForMarketplace(marketplaceId, listingId),
        ebayItemId: null,
    };
}


// CREATE EBAY LISTING
export async function createEbayListing(
    listing: PublishableListing,
    images: ListingImageRow[],
): Promise<EbayListingResult> {
    /**
     * Publishes a publishable listing on eBay, dispatching automatically
     * based on the eBay category: vehicle categories (UK Cars, Motorcycles
     * & Vehicles tree and any overrides in AUTO_ADS_EBAY_VEHICLE_CATEGORY_IDS)
     * are published as Classified Ads via the Trading API because the
     * Inventory API rejects them; every other category continues to use
     * the REST Sell Inventory API flow.
     */

    if (!listing.id) {
        throw new Error("Listing must be saved before publishing to eBay.");
    }

    if (await isVehicleCategory(listing.ebayCategoryId)) {
        const result = await createOrReviseClassifiedAd(listing, images);
        return {ebayUrl: result.ebayUrl, ebayItemId: result.itemId};
    }

    return createEbayListingInventory(listing, images);
}


// CREATE EBAY LISTING SAFE
export async function createEbayListingSafe(
    listing: PublishableListing,
    images: ListingImageRow[],
): Promise<
    | {success: true; ebayUrl: string; ebayItemId: string | null}
    | {success: false; error: string}
> {
    /**
     * Wraps createEbayListing and returns a result object suitable for server
     * actions. Uses the Trading-specific error formatter when the dispatch
     * took the Trading path so the caller sees the actual XML error text.
     */

    const usedTrading = await isVehicleCategory(listing.ebayCategoryId);
    try {
        const result = await createEbayListing(listing, images);
        return {success: true, ebayUrl: result.ebayUrl, ebayItemId: result.ebayItemId};
    } catch (err) {
        console.error("eBay listing creation failed:", err);
        const message = usedTrading ? formatTradingError(err) : formatEbayError(err);
        return {success: false, error: message};
    }
}
