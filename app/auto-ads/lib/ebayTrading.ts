import eBayApi from "ebay-api";
import {and, eq} from "drizzle-orm";
import {ebayUseSandbox, getEbayApiClient} from "@app/auto-ads/lib/ebayClient";
import type {PublishableListing} from "@app/auto-ads/lib/listingForPublish";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {lookups} from "@/drizzle/auto-ads/schema";

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

// EBAY CATEGORY LOOKUP TYPE
const EBAY_CATEGORY_LOOKUP_TYPE = "ebay_categories";
/**
 * lookup_type value used to store eBay category options in the aa.lookups
 * table. The row's `extra` column drives routing: when it contains
 * 'vehicle' (in a comma-delimited list, case-insensitive) the listing is
 * published via the Trading API as a Classified Ad; everything else goes
 * through the REST Sell Inventory API. The `description` column now stores
 * the human-readable category path (e.g. "Cars, Motorcycles & Vehicles >
 * Cars > BMW") and is no longer consulted for routing.
 */

// VEHICLE EXTRA TAG
const VEHICLE_EXTRA_TAG = "vehicle";
/** Case-insensitive token expected in aa.lookups.extra for vehicle categories. */

// IS VEHICLE CATEGORY
export async function isVehicleCategory(categoryId: string | null | undefined): Promise<boolean> {
    /**
     * Returns true when the given eBay category id should be published as a
     * Classified Ad through the Trading API. Routing is driven by the
     * `extra` column on the aa.lookups row for this category: when the
     * comma-delimited list contains 'vehicle' (case-insensitive), the
     * Trading path is used. The AUTO_ADS_EBAY_VEHICLE_CATEGORY_IDS
     * environment variable (comma-separated) is still honoured as a
     * short-circuit override for cases where the database has not yet been
     * seeded with the flag.
     */

    if (!categoryId?.trim()) return false;
    const id = categoryId.trim();

    // env override wins so operators can force the trading path without a
    // database change in an emergency
    const override = process.env.AUTO_ADS_EBAY_VEHICLE_CATEGORY_IDS?.trim();
    if (override) {
        const ids = override
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (ids.includes(id)) return true;
    }

    // consult the lookups table for the category's routing flags
    try {
        const [row] = await getAutoAdsDb()
            .select({extra: lookups.extra})
            .from(lookups)
            .where(and(
                eq(lookups.lookupType, EBAY_CATEGORY_LOOKUP_TYPE),
                eq(lookups.code, id),
            ))
            .limit(1);

        // split the comma-delimited extra column into tokens and check for
        // the vehicle marker; null/empty extras simply fall through as false
        const tokens = (row?.extra ?? "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
        return tokens.includes(VEHICLE_EXTRA_TAG);
    } catch (err) {
        // an error here shouldn't prevent all publishing, so fall back to
        // the safer non-vehicle path and let the caller surface any eBay error
        console.warn("Failed to look up eBay category routing tag:", err);
        return false;
    }
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
     * lines for use as a multi-valued Features item specific. Any leading
     * markdown bullet marker ("- ", "* ", or "• ") is stripped because eBay
     * joins multi-valued aspects with commas and the bullet glyphs would
     * otherwise show up inline (e.g. "- Heated seats, - Bluetooth").
     */

    if (!specsAndFeatures?.trim()) return [];
    return specsAndFeatures
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^(?:[-*•])\s+/, "").trim())
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
function buildItemSpecifics(listing: PublishableListing): NameValueList[] {
    /**
     * Maps the publishable listing's vehicle aspects (when present) to the
     * Trading API ItemSpecifics structure, mirroring the aspects used on the
     * Sell Inventory path so buyers see the same labels regardless of
     * publish route. When the listing is not a vehicle (`vehicle` is
     * undefined) the only specifics produced are the optional Features
     * lines extracted from `specsAndFeatures`.
     */

    const list: NameValueList[] = [];

    const vehicle = listing.vehicle;
    if (vehicle) {
        addNameValue(list, "Year", vehicle.year);
        // ebay's mileage item specific must be numeric only; the unit is
        // implied by the marketplace (miles on uk, km on most eu sites) so
        // we never append a unit here even when one is set
        addNameValue(list, "Mileage", vehicle.mileage);
        addNameValue(list, "Fuel Type", vehicle.fuelType);
        addNameValue(list, "Transmission", vehicle.gearboxType);
        addNameValue(list, "Colour", vehicle.colour);
        addNameValue(list, "Body Type", vehicle.bodyType);
        addNameValue(list, "Engine Size", vehicle.engineSize);
        addNameValue(list, "Seats", vehicle.seats);
        addNameValue(list, "Previous owners", vehicle.numberOfOwners);
        addNameValue(list, "Vehicle Registration Mark", vehicle.registration);
        addNameValue(list, "MOT Expiry Date", vehicle.motExpiry);
        addNameValue(list, "MOT status", vehicle.motStatus);
        addNameValue(list, "Emission class", vehicle.emissionClass);
    }

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

    const sandboxPrefix = ebayUseSandbox() ? "sandbox." : "";
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) return `https://www.${sandboxPrefix}ebay.co.uk`;
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) return `https://www.${sandboxPrefix}ebay.com`;
    return `https://www.${sandboxPrefix}ebay.com`;
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

// TRADING CURRENCY FOR MARKETPLACE
function tradingCurrencyForMarketplace(marketplaceId: string): string {
    /**
     * Returns the default currency code expected by the marketplace site for
     * Trading API listings.
     */

    if (marketplaceId === eBayApi.MarketplaceId.EBAY_GB) return "GBP";
    if (marketplaceId === eBayApi.MarketplaceId.EBAY_US) return "USD";
    return "GBP";
}

// BUILD CLASSIFIED AD ITEM
function buildClassifiedAdItem(
    listing: PublishableListing,
    images: ListingImageRow[],
    marketplaceId: string,
): Record<string, unknown> {
    /**
     * Builds the Trading API Item payload for a Classified Ad
     * (ListingType=LeadGeneration + ListingSubtype2=ClassifiedAd) used by
     * both AddItem and ReviseItem. Classified
     * Ads do not transact on eBay, so shipping, payment, and return policies
     * are intentionally omitted. Phone contact is supplied via
     * SellerContactDetails.PhoneLocalNumber; email contact is a boolean flag
     * on ExtendedSellerContactDetails and always uses the seller's
     * registered eBay account email (eBay Trading does not accept an
     * explicit email value on the item payload).
     */

    if (!listing.ebayCategoryId?.trim()) {
        throw new Error("eBay category is required.");
    }
    if (listing.askingPrice == null || listing.askingPrice < 0) {
        throw new Error("Asking price is required to publish on eBay.");
    }

    // validate classified-ad specific environment configuration
    const postalCode = process.env.AUTO_ADS_POSTCODE?.trim();
    if (!postalCode) {
        throw new Error("AUTO_ADS_POSTCODE is not set.");
    }
    // AUTO_ADS_EMAIL is a flag: when set, enable email contact on
    // the listing; the actual email comes from the seller's eBay account
    const emailContactFlag = process.env.AUTO_ADS_EMAIL?.trim();
    const sellerPhone = process.env.AUTO_ADS_PHONE?.trim();
    if (!emailContactFlag && !sellerPhone) {
        throw new Error(
            "eBay Classified Ad seller contact is required: set AUTO_ADS_PHONE and/or AUTO_ADS_EMAIL.",
        );
    }

    const listingCurrency = currencySymbolToIso(listing.currencySymbol);
    const title = truncateTitle(listing.title);
    const description = listing.body?.trim() || listing.title || "";
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
    const marketplaceCurrency = tradingCurrencyForMarketplace(marketplaceId);
    const currency = listingCurrency === marketplaceCurrency ? listingCurrency : marketplaceCurrency;

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
        ListingType: "LeadGeneration",
        ListingSubtype2: "ClassifiedAd",
        Location: location,
        PostalCode: postalCode,
        Quantity: 1,
        Site: site,
    };

    // SellerContactDetails is the AddressType container; valid Phone child is
    // PhoneLocalNumber (not Phone). Email is NOT a child here.
    if (sellerPhone) {
        item.SellerContactDetails = {
            PhoneLocalNumber: sellerPhone,
        };
    }

    // email contact on classified ads is enabled via this boolean flag; the
    // actual address is whichever email is registered on the seller's account
    if (emailContactFlag) {
        item.ExtendedSellerContactDetails = {
            ClassifiedAdContactByEmailEnabled: true,
        };
    }

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
    listing: PublishableListing,
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
    listing: PublishableListing,
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
    listing: PublishableListing,
    images: ListingImageRow[],
): Promise<ClassifiedAdResult> {
    /**
     * Publishes or updates a publishable listing as an eBay Motors
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
     * returns every entry (one per line) with the error code, severity, long
     * message and any parameter context, so the caller can show the full set
     * of issues eBay reported rather than just the first one. Falls back to
     * the raw Error message when nothing structured is available.
     */

    if (!(err instanceof Error)) return String(err);

    type EbayErrorParameter = {ParamID?: string; Value?: string | number};
    type EbayErrorEntry = {
        LongMessage?: string;
        ShortMessage?: string;
        ErrorCode?: string | number;
        SeverityCode?: string;
        ErrorClassification?: string;
        ErrorParameters?: EbayErrorParameter | EbayErrorParameter[];
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
        const entries = Array.isArray(errors) ? errors : errors ? [errors] : [];
        if (entries.length === 0) continue;

        // build one human-readable line per error entry
        const lines: string[] = [];
        for (const entry of entries) {
            if (!entry || typeof entry !== "object") continue;
            const codeParts: string[] = [];
            if (entry.SeverityCode) codeParts.push(entry.SeverityCode);
            if (entry.ErrorCode !== undefined) codeParts.push(`code ${entry.ErrorCode}`);
            if (entry.ErrorClassification) codeParts.push(entry.ErrorClassification);
            const prefix = codeParts.length > 0 ? `[${codeParts.join(" ")}] ` : "";
            const body =
                entry.LongMessage ||
                entry.ShortMessage ||
                (entry.ErrorCode !== undefined ? `eBay error ${entry.ErrorCode}` : "");
            if (!prefix && !body) continue;

            // include any parameter hints (e.g. which field caused the issue)
            const params = Array.isArray(entry.ErrorParameters)
                ? entry.ErrorParameters
                : entry.ErrorParameters
                    ? [entry.ErrorParameters]
                    : [];
            const paramText = params
                .map((p) => (p?.ParamID ? `${p.ParamID}=${p.Value ?? ""}` : String(p?.Value ?? "")))
                .filter(Boolean)
                .join(", ");
            const suffix = paramText ? ` (${paramText})` : "";

            lines.push(`${prefix}${body}${suffix}`.trim());
        }
        if (lines.length > 0) return lines.join("\n");
    }

    return err.message;
}
