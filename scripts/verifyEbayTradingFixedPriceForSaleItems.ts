import {desc, isNotNull} from "drizzle-orm";
import {getEbayApiClient} from "../app/auto-ads/lib/ebayClient";
import {getAutoAdsDb} from "../app/lib/autoAdsDb";
import {saleItems} from "../drizzle/auto-ads/schema";
import {loadEnv} from "./loadEnv";

// hydrate process.env from the shared .env plus the per-environment override
loadEnv();

// DEFAULT CATEGORY ID
const DEFAULT_CATEGORY_ID = "11700";
/**
 * Last-resort eBay UK category used when neither EBAY_DIAG_CATEGORY_ID
 * is set nor any sale_items row has an ebay_category_id stored. 11700
 * is "Home, Furniture & DIY > Other" which is a permissive UK leaf;
 * the previous default of 13694 turned out to be invalid on EBAY_GB,
 * so we changed it to a category that is widely accepted. Operators
 * should normally not hit this fallback because the DB lookup below
 * picks a category they have already used in the app.
 */

// DEFAULT POSTAL CODE
const DEFAULT_POSTAL_CODE = "HP19 3EQ";
/** Postal code used for the diagnostic listing; matches the warehouse address. */

// PICK SALE ITEM CATEGORY ID
async function pickSaleItemCategoryId(): Promise<string | null> {
    /**
     * Pulls the most recent sale_items row that has an ebay_category_id
     * set and returns the id. Used as the auto-fallback for the
     * diagnostic so it exercises a category the operator has actually
     * been listing in (and which therefore is known to exist on this
     * marketplace), rather than a hard-coded id that may have been
     * deprecated by eBay between releases. Returns null when no row
     * has a category yet, which forces the script to fall back to the
     * DEFAULT_CATEGORY_ID constant.
     */

    const [row] = await getAutoAdsDb()
        .select({categoryId: saleItems.ebayCategoryId})
        .from(saleItems)
        .where(isNotNull(saleItems.ebayCategoryId))
        .orderBy(desc(saleItems.id))
        .limit(1);
    return row?.categoryId ?? null;
}

// FORMAT EBAY ERROR
function formatEbayError(err: unknown): string {
    /**
     * Pulls the structured error body out of an eBay SDK exception when
     * present and falls back to the plain message otherwise. The Trading
     * API surfaces errors under err.meta.res.data.Errors with ErrorCode
     * and LongMessage fields, which is hidden from a default toString.
     */

    const e = err as Error & {meta?: {res?: {data?: unknown}}};
    const data = e.meta?.res?.data;
    if (data) return JSON.stringify(data, null, 2);
    return e.message ?? String(err);
}

// SUMMARISE TRADING ERRORS
function summariseTradingErrors(response: unknown): {warnings: number; errors: number; lines: string[]} {
    /**
     * Walks the Trading API response's Errors[] array and produces a
     * tally of warnings vs hard errors plus a one-line summary per row,
     * so the script's headline output makes it obvious whether the call
     * actually passed verification or merely returned 200 with embedded
     * failures (which Trading API does for many soft-fail conditions).
     */

    type TradingErr = {SeverityCode?: string; ErrorCode?: string | number; LongMessage?: string; ShortMessage?: string};
    const data = response as {Errors?: TradingErr | TradingErr[]; Ack?: string};
    const list = !data.Errors ? [] : Array.isArray(data.Errors) ? data.Errors : [data.Errors];

    let warnings = 0;
    let errors = 0;
    const lines: string[] = [];
    for (const e of list) {
        const sev = e.SeverityCode ?? "";
        const code = e.ErrorCode ?? "";
        const msg = e.LongMessage ?? e.ShortMessage ?? "";
        if (sev === "Warning") warnings++;
        else errors++;
        lines.push(`  [${sev}] ${code}: ${msg}`);
    }
    return {warnings, errors, lines};
}

// MAIN
async function main(): Promise<void> {
    /**
     * Calls Trading API VerifyAddFixedPriceItem with a minimal sale-item
     * payload to determine whether eBay's legacy fixed-price code path
     * also enforces sellerRegistrationCompleted, or whether it is a
     * viable backdoor for sale-item publishing while the modern Sell
     * Inventory API path is gated. Read-only: no actual listing created
     * even on success. Look for ErrorCode 21916587 / 21919303 / similar
     * in the response — those are the "seller not registered for managed
     * payments" codes that would confirm the gate spans both code paths.
     */

    const fulfillmentId = process.env.AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID?.trim();
    const paymentId = process.env.AUTO_ADS_EBAY_PAYMENT_POLICY_ID?.trim();
    const returnId = process.env.AUTO_ADS_EBAY_RETURN_POLICY_ID?.trim();

    if (!fulfillmentId || !paymentId || !returnId) {
        console.error("Missing one or more of AUTO_ADS_EBAY_{FULFILLMENT,PAYMENT,RETURN}_POLICY_ID; aborting.");
        process.exit(1);
    }

    // resolve the category id with a three-tier fallback: explicit env
    // override > most recent sale_items.ebay_category_id > hard-coded
    // default. the db lookup ensures the diagnostic always uses a
    // category the operator has already been listing in, so an "invalid
    // category" failure is a real signal rather than a stale-default
    // false-positive
    let categoryId = process.env.EBAY_DIAG_CATEGORY_ID?.trim();
    let categorySource = "EBAY_DIAG_CATEGORY_ID env var";
    if (!categoryId) {
        const fromDb = await pickSaleItemCategoryId();
        if (fromDb) {
            categoryId = fromDb;
            categorySource = "most recent sale_items.ebay_category_id";
        } else {
            categoryId = DEFAULT_CATEGORY_ID;
            categorySource = "hard-coded DEFAULT_CATEGORY_ID";
        }
    }
    console.log(`Using categoryId=${categoryId} (source: ${categorySource})\n`);

    const ebay = await getEbayApiClient();

    // minimal item that the Sell Inventory path would have published; we
    // re-use the same business policies and merchant location so the only
    // thing changing between the two diagnostics is the API surface
    const payload = {
        Item: {
            Title: "Diagnostic Sale Item — Verify Only (Do Not List)",
            Description: "Diagnostic VerifyAddFixedPriceItem call; no real listing is created.",
            PrimaryCategory: {CategoryID: categoryId},
            StartPrice: "10.00",
            ConditionID: 3000,
            Country: "GB",
            Currency: "GBP",
            DispatchTimeMax: 1,
            ListingDuration: "GTC",
            ListingType: "FixedPriceItem",
            Quantity: 1,
            Site: "UK",
            PostalCode: DEFAULT_POSTAL_CODE,
            SellerProfiles: {
                SellerShippingProfile: {ShippingProfileID: fulfillmentId},
                SellerPaymentProfile: {PaymentProfileID: paymentId},
                SellerReturnProfile: {ReturnProfileID: returnId},
            },
        },
    };

    console.log("Calling Trading API VerifyAddFixedPriceItem with payload:");
    console.log(JSON.stringify(payload, null, 2).split("\n").map((l) => `  ${l}`).join("\n"));
    console.log("");

    let response: unknown;
    try {
        response = await ebay.trading.VerifyAddFixedPriceItem(payload);
    } catch (err) {
        // axios throws on Ack=Failure responses but the body still has
        // useful detail on err.meta.res.data; print it before exiting
        console.error("VerifyAddFixedPriceItem threw:");
        console.error(formatEbayError(err).split("\n").map((l) => `  ${l}`).join("\n"));
        console.error("");
        console.error("Look for ErrorCode 21916587 / 21919303 / 240 — those are eBay's");
        console.error("'managed payments not registered' / 'seller not eligible' codes.");
        console.error("If you see them, the privilege gate is not bypassable via Trading API");
        console.error("either, and the only path forward is an eBay sandbox support ticket.");
        process.exit(1);
    }

    console.log("VerifyAddFixedPriceItem returned (raw):");
    console.log(JSON.stringify(response, null, 2).split("\n").map((l) => `  ${l}`).join("\n"));
    console.log("");

    const summary = summariseTradingErrors(response);
    if (summary.errors === 0 && summary.warnings === 0) {
        console.log("Result: ✓ no errors and no warnings.");
        console.log("Trading API would accept this sale item — migrating sale items off the");
        console.log("Sell Inventory API path is a viable workaround for the registration gate.");
    } else if (summary.errors === 0) {
        console.log(`Result: ✓ ${summary.warnings} warning(s), no hard errors.`);
        console.log("Warnings are non-fatal; Trading API would still accept this sale item.");
        console.log("Migration to Trading API for sale items is a viable workaround.");
    } else {
        console.log(`Result: ✗ ${summary.errors} error(s) and ${summary.warnings} warning(s):`);
        for (const line of summary.lines) console.log(line);
        console.log("");
        console.log("If any error references seller registration, managed payments enrollment,");
        console.log("or selling limits, the gate spans both modern and legacy code paths and");
        console.log("the only way through is an eBay sandbox support ticket.");
    }
}

main().catch((err) => {
    console.error("Failed:", formatEbayError(err));
    process.exit(1);
});
