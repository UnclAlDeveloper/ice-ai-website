import eBayApi from "ebay-api";
import type {ResaleListingData} from "@app/auto-ads/resales/actions";
import {getEbayApiClient} from "@app/auto-ads/lib/ebayClient";

// LISTING IMAGE ROW
type ListingImageRow = {id: number; url: string; isPrimary: boolean | null};
/**
 * Minimal image row shape used when ordering image URLs for the Trading API.
 * Mirrors the equivalent type in ebayListing.ts; kept local here so this
 * module has no runtime dependency on its caller.
 */

// CLASSIFIED AD RESULT
export type ClassifiedAdResult = {ebayUrl: string; itemId: string};
/**
 * Return shape from createOrReviseClassifiedAd: the consumer-facing eBay URL
 * and the raw Trading API ItemID (needed for future ReviseItem calls).
 */

// DEFAULT VEHICLE CATEGORY IDS
const DEFAULT_VEHICLE_CATEGORY_IDS: readonly string[] = [
    "9800",
    "9801",
    "29690",
    "177681",
    "63732",
    "50054",
    "10118",
    "66466",
    "6001",
    "6024",
    "6028",
    "10063",
] as const;
/**
 * Default set of eBay category IDs (UK Motors under 9800 and US Motors under
 * 6000) that must be published via the Trading API as Classified Ads
 * because the REST Sell Inventory API rejects vehicle listings in these
 * categories. Can be overridden with AUTO_ADS_EBAY_VEHICLE_CATEGORY_IDS.
 */

// IS VEHICLE CATEGORY
export function isVehicleCategory(categoryId: string | null | undefined): boolean {
    /**
     * Returns true when the given eBay category id should be published as a
     * Classified Ad through the Trading API. If
     * AUTO_ADS_EBAY_VEHICLE_CATEGORY_IDS is set (comma-separated), that list
     * replaces the built-in default set; otherwise the default set is used.
     */

    if (!categoryId?.trim()) return false;
    const id = categoryId.trim();

    // env override wins so operators can adjust without a deploy
    const override = process.env.AUTO_ADS_EBAY_VEHICLE_CATEGORY_IDS?.trim();
    if (override) {
        const ids = override
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        return ids.includes(id);
    }

    return DEFAULT_VEHICLE_CATEGORY_IDS.includes(id);
}

// EBAY TITLE MAX LENGTH
const EBAY_TITLE_MAX = 80;

// TRUNCATE TITLE
function truncateTitle(title: string): string {
    /**
     * Clips the listing title to eBay's 80-character maximum, appending a
     * single-character ellipsis when truncation occurs.
     */

    if (title.length <= EBAY_TITLE_MAX) return title;
    return title.slice(0, EBAY_TITLE_MAX - 1) + "…";
}

// CURRENCY SYMBOL TO ISO
function currencySymbolToIso(symbol: string | null): string {
    /**
     * Maps common currency symbols (and uppercase ISO codes) to ISO 4217
     * codes for eBay pricing. Defaults to GBP.
     */

    if (!symbol) return "GBP";
    const s = symbol.trim();
    if (s === "£" || s.toUpperCase() === "GBP") return "GBP";
    if (s === "$" || s.toUpperCase() === "USD") return "USD";
    if (s === "€" || s.toUpperCase() === "EUR") return "EUR";
    return "GBP";
}

// SORT IMAGE URLS PRIMARY FIRST
function sortImageUrls(images: ListingImageRow[]): string[] {
    /**
     * Orders image URLs with the primary image first, then remaining images
     * in their original insertion order.
     */

    const primary = images.filter((i) => i.isPrimary === true);
    const rest = images.filter((i) => i.isPrimary !== true);
    return [...primary, ...rest].map((i) => i.url);
}

// SPECS TO FEATURE LINES
function specsToFeatureLines(specsAndFeatures: string | null): string[] {
    /**
     * Splits a multiline specs-and-features string into trimmed, non-empty
     * lines for use as a multi-valued Features item specific.
     */

    if (!specsAndFeatures?.trim()) return [];
    return specsAndFeatures
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

// NAME VALUE LIST
type NameValueList = {Name: string; Value: string[]};
/**
 * Single entry in Trading ItemSpecifics. Value is always an array because
 * multi-valued item specifics (for example Features) are represented as
 * repeated Value elements in the underlying XML.
 */

// ADD NAME VALUE
function addNameValue(
    list: NameValueList[],
    name: string,
    value: string | number | null | undefined,
): void {
    /**
     * Appends a single-value entry to an ItemSpecifics list if the value is
     * present and non-empty after trimming.
     */

    if (value === null || value === undefined || value === "") return;
    const str = typeof value === "number" ? String(value) : String(value).trim();
    if (!str) return;
    list.push({Name: name, Value: [str]});
}

// BUILD ITEM SPECIFICS
function buildItemSpecifics(listing: ResaleListingData): NameValueList[] {
    /**
     * Maps resale vehicle fields to the Trading API ItemSpecifics structure.
     * This mirrors the aspects built for the Sell Inventory path so buyers
     * see the same specification labels regardless of publish route.
     */

    const list: NameValueList[] = [];

    addNameValue(list, "Year", listing.year);
    if (listing.mileage != null) {
        const unit = listing.mileageUnit?.trim() || "miles";
        list.push({Name: "Mileage", Value: [`${listing.mileage} ${unit}`]});
    }
    addNameValue(list, "Fuel Type", listing.fuelType);
    addNameValue(list, "Transmission", listing.gearboxType);
    addNameValue(list, "Colour", listing.colour);
    addNameValue(list, "Body Type", listing.bodyType);
    addNameValue(list, "Engine Size", listing.engineSize);
    addNameValue(list, "Seats", listing.seats);
    addNameValue(list, "Previous owners", listing.numberOfOwners);
    addNameValue(list, "Vehicle Registration Mark", listing.registration);
    addNameValue(list, "MOT Expiry Date", listing.motExpiry);
    addNameValue(list, "MOT status", listing.motStatus);
    addNameValue(list, "Emission class", listing.emissionClass);

    const features = specsToFeatureLines(listing.specsAndFeatures);
    if (features.length > 0) {
        list.push({Name: "Features", Value: features});
    }

    return list;
}

// LISTING HOST FOR MARKETPLACE
function listingHostForMarketplace(marketplaceId: string): string {
    /**
     * Returns the consumer-facing eBay host for a REST marketplace id. Only
     * UK and US are explicitly mapped; other marketplaces fall back to
     * ebay.com.
     */

    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) return "https://www.ebay.co.uk";
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) return "https://www.ebay.com";
    return "https://www.ebay.com";
}

// TRADING SITE FOR MARKETPLACE
function tradingSiteForMarketplace(marketplaceId: string): string {
    /**
     * Maps a REST marketplace id to the Trading API Site code. Site is a
     * separate enum from REST MarketplaceId so it must be translated
     * explicitly for AddItem requests.
     */

    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) return "UK";
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) return "US";
    return "UK";
}

// TRADING COUNTRY FOR MARKETPLACE
function tradingCountryForMarketplace(marketplaceId: string): string {
    /**
     * Maps a REST marketplace id to the Trading API Country ISO code used on
     * the Item payload.
     */

    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) return "GB";
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) return "US";
    return "GB";
}

// BUILD CLASSIFIED AD ITEM
function buildClassifiedAdItem(
    listing: ResaleListingData,
    images: ListingImageRow[],
    marketplaceId: string,
): Record<string, unknown> {
    /**
     * Builds the Trading API Item payload for a Classified Ad
     * (ListingType=AdType) used by both AddItem and ReviseItem. Classified
     * Ads do not transact on eBay, so shipping, payment, and return policies
     * are intentionally omitted; buyer contact comes from the
     * AUTO_ADS_EBAY_SELLER_* environment variables.
     */

    if (!listing.ebayCategoryId?.trim()) {
        throw new Error("eBay category is required.");
    }
    if (listing.askingPrice == null || listing.askingPrice < 0) {
        throw new Error("Asking price is required to publish on eBay.");
    }

    // validate classified-ad specific environment configuration
    const postalCode = process.env.AUTO_ADS_EBAY_SELLER_POSTAL_CODE?.trim();
    if (!postalCode) {
        throw new Error("AUTO_ADS_EBAY_SELLER_POSTAL_CODE is not set.");
    }
    const sellerEmail = process.env.AUTO_ADS_EBAY_SELLER_EMAIL?.trim();
    const sellerPhone = process.env.AUTO_ADS_EBAY_SELLER_PHONE?.trim();
    if (!sellerEmail || !sellerPhone) {
        throw new Error(
            "eBay Classified Ad seller contact is required: set AUTO_ADS_EBAY_SELLER_EMAIL and AUTO_ADS_EBAY_SELLER_PHONE.",
        );
    }

    const currency = currencySymbolToIso(listing.currencySymbol);
    const title = truncateTitle(listing.shortDescription);
    const description = listing.fullDescription?.trim() || listing.shortDescription || "";
    const pictureUrls = sortImageUrls(images);
    const itemSpecifics = buildItemSpecifics(listing);

    const location =
        process.env.AUTO_ADS_EBAY_SELLER_LOCATION?.trim() ||
        listing.location?.trim() ||
        postalCode;
    const duration =
        process.env.AUTO_ADS_EBAY_CLASSIFIED_DURATION?.trim() || "Days_30";
    const site = tradingSiteForMarketplace(marketplaceId);
    const country = tradingCountryForMarketplace(marketplaceId);

    // assemble the trading api item record; ConditionID 3000 is "used"
    const item: Record<string, unknown> = {
        Title: title,
        Description: description,
        PrimaryCategory: {CategoryID: listing.ebayCategoryId.trim()},
        StartPrice: String(listing.askingPrice),
        CategoryMappingAllowed: true,
        ConditionID: 3000,
        Country: country,
        Currency: currency,
        ListingDuration: duration,
        ListingType: "AdType",
        Location: location,
        PostalCode: postalCode,
        Quantity: 1,
        Site: site,
        SellerContactDetails: {
            Email: sellerEmail,
            Phone: sellerPhone,
        },
    };

    if (pictureUrls.length > 0) {
        item.PictureDetails = {PictureURL: pictureUrls};
    }
    if (itemSpecifics.length > 0) {
        item.ItemSpecifics = {NameValueList: itemSpecifics};
    }

    return item;
}

// ADD CLASSIFIED AD
async function addClassifiedAd(
    listing: ResaleListingData,
    images: ListingImageRow[],
): Promise<string> {
    /**
     * Publishes a brand-new Classified Ad via Trading API AddItem and returns
     * the ItemID eBay assigns to the new listing.
     */

    const ebay = await getEbayApiClient();
    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;

    const item = buildClassifiedAdItem(listing, images, marketplaceId);

    // hendt/ebay-api exposes the traditional trading api under ebay.trading.*
    const tradingClient = (ebay as unknown as {trading: {AddItem: (body: unknown) => Promise<unknown>}}).trading;
    const response = await tradingClient.AddItem({Item: item});

    const itemId =
        (response as {ItemID?: string})?.ItemID ??
        (response as {Item?: {ItemID?: string}})?.Item?.ItemID;
    if (!itemId) {
        throw new Error("eBay AddItem succeeded but no ItemID was returned.");
    }
    return String(itemId);
}

// REVISE CLASSIFIED AD
async function reviseClassifiedAd(
    listing: ResaleListingData,
    images: ListingImageRow[],
    itemId: string,
): Promise<void> {
    /**
     * Updates an existing Classified Ad via Trading API ReviseItem, keeping
     * the ItemID (and therefore the public URL) unchanged.
     */

    const ebay = await getEbayApiClient();
    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;

    const item = {
        ...buildClassifiedAdItem(listing, images, marketplaceId),
        ItemID: itemId,
    };

    const tradingClient = (ebay as unknown as {trading: {ReviseItem: (body: unknown) => Promise<unknown>}}).trading;
    await tradingClient.ReviseItem({Item: item});
}

// GET ITEM LISTING STATUS
async function getItemListingStatus(itemId: string): Promise<string | null> {
    /**
     * Fetches the current Trading API ListingStatus for an item (for example
     * "Active", "Completed", "Ended"). Returns null when the item cannot be
     * fetched so the caller falls back to creating a fresh ad.
     */

    try {
        const ebay = await getEbayApiClient();
        const tradingClient = (ebay as unknown as {
            trading: {GetItem: (body: unknown) => Promise<unknown>};
        }).trading;
        const response = await tradingClient.GetItem({
            ItemID: itemId,
            DetailLevel: "ReturnAll",
            IncludeItemSpecifics: false,
        });
        const status = (response as {Item?: {SellingStatus?: {ListingStatus?: string}}})?.Item
            ?.SellingStatus?.ListingStatus;
        return status ?? null;
    } catch (err) {
        console.warn("eBay GetItem failed when checking listing status:", err);
        return null;
    }
}

// CREATE OR REVISE CLASSIFIED AD
export async function createOrReviseClassifiedAd(
    listing: ResaleListingData,
    images: ListingImageRow[],
): Promise<ClassifiedAdResult> {
    /**
     * Publishes or updates a resale vehicle listing as an eBay Motors
     * Classified Ad via the Trading API. If the listing already has a stored
     * ebayItemId and that remote listing is still Active, it is revised in
     * place so the public URL does not change; otherwise a new ad is added
     * and its ItemID is returned so the caller can persist it.
     */

    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;
    const host = listingHostForMarketplace(marketplaceId);

    // revise the existing listing when it is still live on ebay
    const existingItemId = listing.ebayItemId?.trim();
    if (existingItemId) {
        const status = await getItemListingStatus(existingItemId);
        if (status === "Active") {
            await reviseClassifiedAd(listing, images, existingItemId);
            return {
                ebayUrl: `${host}/itm/${existingItemId}`,
                itemId: existingItemId,
            };
        }
    }

    // otherwise publish a fresh classified ad and report the new id
    const newItemId = await addClassifiedAd(listing, images);
    return {
        ebayUrl: `${host}/itm/${newItemId}`,
        itemId: newItemId,
    };
}

// FORMAT TRADING ERROR
export function formatTradingError(err: unknown): string {
    /**
     * Extracts a human-readable message from an eBay Trading API error. The
     * hendt/ebay-api client attaches the parsed XML response on the thrown
     * error; this helper walks the common locations for the Errors array and
     * returns LongMessage, falling back to ShortMessage, ErrorCode, or the
     * raw Error message when nothing structured is available.
     */

    if (!(err instanceof Error)) return String(err);

    type EbayErrorEntry = {
        LongMessage?: string;
        ShortMessage?: string;
        ErrorCode?: string | number;
    };
    type EbayErrorShape = Error & {
        meta?: {
            res?: {
                data?: {Errors?: EbayErrorEntry | EbayErrorEntry[]} | unknown;
                body?: {Errors?: EbayErrorEntry | EbayErrorEntry[]} | unknown;
            };
        };
        Errors?: EbayErrorEntry | EbayErrorEntry[];
    };

    const shaped = err as EbayErrorShape;

    // the errors payload can live in a few different places depending on
    // whether the library parsed the xml or left it on the axios response
    const candidateContainers = [
        shaped.meta?.res?.body,
        shaped.meta?.res?.data,
        shaped,
    ];
    for (const container of candidateContainers) {
        if (!container || typeof container !== "object") continue;
        const errors = (container as {Errors?: EbayErrorEntry | EbayErrorEntry[]}).Errors;
        const first = Array.isArray(errors) ? errors[0] : errors;
        if (first && typeof first === "object") {
            const entry = first as EbayErrorEntry;
            if (entry.LongMessage) return entry.LongMessage;
            if (entry.ShortMessage) return entry.ShortMessage;
            if (entry.ErrorCode !== undefined) return `eBay error ${entry.ErrorCode}`;
        }
    }

    return err.message;
}
