import eBayApi from "ebay-api";
import type {ResaleListingData} from "@app/auto-ads/resales/actions";
import {getEbayApiClient} from "@app/auto-ads/lib/ebayClient";

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
     * Splits multiline specs & features into non-empty lines for the Features aspect.
     */

    if (!specsAndFeatures?.trim()) return [];
    return specsAndFeatures
        .split(/\r?\n/)
        .map((line) => line.trim())
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
function buildAspects(listing: ResaleListingData): Record<string, string[]> {
    /**
     * Maps resale vehicle fields to eBay product aspects (item specifics).
     */

    const aspects: Record<string, string[]> = {};

    addAspect(aspects, "Year", listing.year);
    if (listing.mileage != null) {
        const unit = listing.mileageUnit?.trim() || "miles";
        aspects.Mileage = [`${listing.mileage} ${unit}`];
    }
    addAspect(aspects, "Fuel Type", listing.fuelType);
    addAspect(aspects, "Transmission", listing.gearboxType);
    addAspect(aspects, "Colour", listing.colour);
    addAspect(aspects, "Body Type", listing.bodyType);
    addAspect(aspects, "Engine Size", listing.engineSize);
    addAspect(aspects, "Seats", listing.seats);
    addAspect(aspects, "Previous owners", listing.numberOfOwners);
    addAspect(aspects, "Vehicle Registration Mark", listing.registration);
    addAspect(aspects, "MOT Expiry Date", listing.motExpiry);
    addAspect(aspects, "MOT status", listing.motStatus);
    addAspect(aspects, "Emission class", listing.emissionClass);

    const features = specsToFeatureLines(listing.specsAndFeatures);
    if (features.length > 0) {
        aspects.Features = features;
    }

    return aspects;
}

// RESALE SKU
export function resaleListingSku(listingId: number): string {
    /**
     * Stable SKU for the resale listing used across inventory and offer calls.
     */

    return `resale-${listingId}`;
}

// BUILD INVENTORY ITEM BODY
export function buildInventoryItemBody(
    listing: ResaleListingData,
    images: ListingImageRow[],
): Record<string, unknown> {
    /**
     * Produces the JSON body for createOrReplaceInventoryItem from resale data and images.
     */

    const description =
        listing.fullDescription?.trim() || listing.shortDescription || "";

    const imageUrls = sortImageUrls(images);
    const aspects = buildAspects(listing);

    const merchantLocationKey = process.env.AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY?.trim();
    if (!merchantLocationKey) {
        throw new Error("AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY is not set.");
    }

    return {
        condition: "USED",
        product: {
            title: truncateTitle(listing.shortDescription),
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
        },
    };
}

// BUILD OFFER CREATE BODY
function buildOfferCreateBody(listing: ResaleListingData, sku: string): Record<string, unknown> {
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
function buildOfferUpdateBody(listing: ResaleListingData): Record<string, unknown> {
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

    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) {
        return `https://www.ebay.co.uk/itm/${listingId}`;
    }
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) {
        return `https://www.ebay.com/itm/${listingId}`;
    }
    return `https://www.ebay.com/itm/${listingId}`;
}

// FORMAT EBAY ERROR
function formatEbayError(err: unknown): string {
    /**
     * Extracts a readable message from an eBay API or axios error.
     */

    if (err instanceof Error) {
        const anyErr = err as Error & {meta?: {res?: {data?: unknown}}};
        const data = anyErr.meta?.res?.data;
        if (data && typeof data === "object" && "errors" in data) {
            const errors = (data as {errors?: {message?: string; longMessage?: string}[]}).errors;
            if (Array.isArray(errors) && errors.length > 0) {
                const first = errors[0];
                return first.longMessage || first.message || err.message;
            }
        }
        return err.message;
    }
    return String(err);
}

// CREATE EBAY LISTING
export async function createEbayListing(
    listing: ResaleListingData,
    images: ListingImageRow[],
): Promise<string> {
    /**
     * Creates or updates the inventory item, then creates or updates an offer and
     * publishes it, returning the public eBay item URL.
     */

    if (!listing.id) {
        throw new Error("Listing must be saved before publishing to eBay.");
    }

    const sku = resaleListingSku(listing.id);
    const ebay = await getEbayApiClient();
    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;

    const inventoryBody = buildInventoryItemBody(listing, images);
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

    if (existing?.offerId) {
        const offerId = existing.offerId;
        const updateBody = buildOfferUpdateBody(listing);
        await ebay.sell.inventory.updateOffer(offerId, updateBody);

        if (existing.status !== "PUBLISHED") {
            const published = await ebay.sell.inventory.publishOffer(offerId);
            const listingId = (published as {listingId?: string})?.listingId;
            if (!listingId) {
                throw new Error("eBay publish succeeded but no listing id was returned.");
            }
            return listingUrlForMarketplace(marketplaceId, listingId);
        }

        let listingId = existing.listing?.listingId;
        if (!listingId) {
            const refreshed = await ebay.sell.inventory.getOffer(offerId);
            listingId = (refreshed as OfferRow)?.listing?.listingId;
        }
        if (!listingId) {
            throw new Error("Could not resolve eBay listing id after update.");
        }
        return listingUrlForMarketplace(marketplaceId, listingId);
    }

    const createBody = buildOfferCreateBody(listing, sku);
    const created = await ebay.sell.inventory.createOffer(createBody);
    const newOfferId = (created as {offerId?: string})?.offerId ?? "";
    if (!newOfferId) {
        throw new Error("eBay createOffer succeeded but no offer id was returned.");
    }

    const published = await ebay.sell.inventory.publishOffer(newOfferId);
    const listingId = (published as {listingId?: string})?.listingId;
    if (!listingId) {
        throw new Error("eBay publish succeeded but no listing id was returned.");
    }

    return listingUrlForMarketplace(marketplaceId, listingId);
}

// CREATE EBAY LISTING SAFE
export async function createEbayListingSafe(
    listing: ResaleListingData,
    images: ListingImageRow[],
): Promise<{success: true; ebayUrl: string} | {success: false; error: string}> {
    /**
     * Wraps createEbayListing and returns a result object suitable for server actions.
     */

    try {
        const ebayUrl = await createEbayListing(listing, images);
        return {success: true, ebayUrl};
    } catch (err) {
        console.error("eBay listing creation failed:", err);
        return {success: false, error: formatEbayError(err)};
    }
}
