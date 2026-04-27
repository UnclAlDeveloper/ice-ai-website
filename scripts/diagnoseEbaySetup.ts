import {readFileSync} from "fs";
import {resolve} from "path";
import eBayApi from "ebay-api";
import {getEbayApiClient, ebayUseSandbox} from "../app/auto-ads/lib/ebayClient";

// load env vars from .env.dev in the parent directory; mirrors the seed script
const envPath = resolve(__dirname, "../../.env.dev");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
}

// REQUIRED PROGRAMS
const REQUIRED_PROGRAMS = [
    "SELLING_POLICY_MANAGEMENT",
    "OUT_OF_STOCK_CONTROL",
] as const;
/**
 * eBay seller programs the publishOffer flow expects to be opted into.
 * Without SELLING_POLICY_MANAGEMENT the business policy IDs we send are
 * silently ignored and eBay falls back to legacy single-listing settings,
 * which is one of the documented causes of error 25713 ("This Offer is
 * not available.") in sandbox accounts.
 */

// FULFILLMENT POLICY
type FulfillmentPolicy = {
    fulfillmentPolicyId?: string;
    name?: string;
    marketplaceId?: string;
};

// PAYMENT POLICY
type PaymentPolicy = {
    paymentPolicyId?: string;
    name?: string;
    marketplaceId?: string;
};

// RETURN POLICY
type ReturnPolicy = {
    returnPolicyId?: string;
    name?: string;
    marketplaceId?: string;
};

// INVENTORY LOCATION
type InventoryLocation = {
    merchantLocationKey?: string;
    name?: string;
    merchantLocationStatus?: string;
    location?: {address?: {country?: string; postalCode?: string}};
};

// PROGRAM ROW
type ProgramRow = {programType?: string};

// CHECK
function check(label: string, ok: boolean, detail: string): void {
    /**
     * Prints a single named diagnostic line with a tick or cross prefix and
     * a short detail string, so the overall report reads like a build log.
     */

    const marker = ok ? "✓" : "✗";
    console.log(`  ${marker} ${label}: ${detail}`);
}

// SAFE CALL
async function safeCall<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    /**
     * Runs an eBay API call, prints any thrown error with its formatted
     * detail (eBay puts the useful body on err.meta.res.data) and returns
     * null. Diagnostic output stays usable even when individual endpoints
     * are misconfigured.
     */

    try {
        return await fn();
    } catch (err) {
        const e = err as Error & {meta?: {res?: {data?: unknown}}};
        const data = e.meta?.res?.data;
        const detail = data ? JSON.stringify(data) : e.message;
        console.log(`  ✗ ${label}: ${detail}`);
        return null;
    }
}

// MAIN
async function main(): Promise<void> {
    /**
     * Walks the eBay seller-side configuration touched by createOffer and
     * publishOffer (business policies, merchant location, opted-in seller
     * programs) and prints a tick-or-cross report. Any cross is a likely
     * cause of error 25713 ("This Offer is not available.") and points
     * straight at the fix without having to guess.
     */

    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;
    const merchantLocationKey = process.env.AUTO_ADS_EBAY_MERCHANT_LOCATION_KEY?.trim();
    const fulfillmentPolicyId = process.env.AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID?.trim();
    const paymentPolicyId = process.env.AUTO_ADS_EBAY_PAYMENT_POLICY_ID?.trim();
    const returnPolicyId = process.env.AUTO_ADS_EBAY_RETURN_POLICY_ID?.trim();

    console.log("\neBay environment");
    console.log("----------------");
    check("sandbox", true, ebayUseSandbox() ? "yes" : "no (production)");
    check("marketplace", Boolean(marketplaceId), marketplaceId || "<unset>");
    check(
        "merchant location key (env)",
        Boolean(merchantLocationKey),
        merchantLocationKey || "<unset>",
    );
    check(
        "fulfillment policy id (env)",
        Boolean(fulfillmentPolicyId),
        fulfillmentPolicyId || "<unset>",
    );
    check(
        "payment policy id (env)",
        Boolean(paymentPolicyId),
        paymentPolicyId || "<unset>",
    );
    check(
        "return policy id (env)",
        Boolean(returnPolicyId),
        returnPolicyId || "<unset>",
    );

    const ebay = await getEbayApiClient();

    // opted-in programs check: SELLING_POLICY_MANAGEMENT in particular is
    // required for the business policy ids we send to take effect at
    // publish time. eBay sandbox accounts default to opted-out
    console.log("\nSeller opted-in programs");
    console.log("------------------------");
    const programsResp = await safeCall("getOptedInPrograms", () =>
        ebay.sell.account.getOptedInPrograms() as Promise<{programs?: ProgramRow[]}>,
    );
    const programTypes = new Set(
        (programsResp?.programs ?? [])
            .map((p) => p.programType)
            .filter((p): p is string => typeof p === "string"),
    );
    for (const required of REQUIRED_PROGRAMS) {
        check(required, programTypes.has(required), programTypes.has(required) ? "opted in" : "NOT opted in");
    }
    if (programTypes.size > 0) {
        console.log(`  (full list: ${[...programTypes].join(", ")})`);
    }

    // policies check: list every policy the account has on the configured
    // marketplace, then see whether the configured ids actually appear
    console.log("\nBusiness policies");
    console.log("-----------------");
    // the ebay-api sdk takes marketplaceId as a positional string argument
    // (not the {marketplace_id} object the rest api uses on the wire)
    const fulfillmentResp = await safeCall("getFulfillmentPolicies", () =>
        ebay.sell.account.getFulfillmentPolicies(marketplaceId) as Promise<{
            fulfillmentPolicies?: FulfillmentPolicy[];
        }>,
    );
    const paymentResp = await safeCall("getPaymentPolicies", () =>
        ebay.sell.account.getPaymentPolicies(marketplaceId) as Promise<{
            paymentPolicies?: PaymentPolicy[];
        }>,
    );
    const returnResp = await safeCall("getReturnPolicies", () =>
        ebay.sell.account.getReturnPolicies(marketplaceId) as Promise<{
            returnPolicies?: ReturnPolicy[];
        }>,
    );

    const fulfillmentPolicies = fulfillmentResp?.fulfillmentPolicies ?? [];
    const paymentPolicies = paymentResp?.paymentPolicies ?? [];
    const returnPolicies = returnResp?.returnPolicies ?? [];

    const findFulfillment = fulfillmentPolicies.find((p) => p.fulfillmentPolicyId === fulfillmentPolicyId);
    const findPayment = paymentPolicies.find((p) => p.paymentPolicyId === paymentPolicyId);
    const findReturn = returnPolicies.find((p) => p.returnPolicyId === returnPolicyId);

    check(
        `fulfillment policy ${fulfillmentPolicyId ?? "<unset>"}`,
        Boolean(findFulfillment),
        findFulfillment
            ? `found "${findFulfillment.name}" on ${findFulfillment.marketplaceId}`
            : `not found on ${marketplaceId} (${fulfillmentPolicies.length} fulfillment policies on this marketplace)`,
    );
    check(
        `payment policy ${paymentPolicyId ?? "<unset>"}`,
        Boolean(findPayment),
        findPayment
            ? `found "${findPayment.name}" on ${findPayment.marketplaceId}`
            : `not found on ${marketplaceId} (${paymentPolicies.length} payment policies on this marketplace)`,
    );
    check(
        `return policy ${returnPolicyId ?? "<unset>"}`,
        Boolean(findReturn),
        findReturn
            ? `found "${findReturn.name}" on ${findReturn.marketplaceId}`
            : `not found on ${marketplaceId} (${returnPolicies.length} return policies on this marketplace)`,
    );

    if (fulfillmentPolicies.length > 0 || paymentPolicies.length > 0 || returnPolicies.length > 0) {
        console.log("\n  Available policies:");
        for (const p of fulfillmentPolicies) {
            console.log(`    fulfillment ${p.fulfillmentPolicyId} "${p.name}" (${p.marketplaceId})`);
        }
        for (const p of paymentPolicies) {
            console.log(`    payment    ${p.paymentPolicyId} "${p.name}" (${p.marketplaceId})`);
        }
        for (const p of returnPolicies) {
            console.log(`    return     ${p.returnPolicyId} "${p.name}" (${p.marketplaceId})`);
        }
    }

    // dump the full configured-policy bodies so problems like a local-pickup
    // policy with no pickup flag, an empty shippingOptions array, or a
    // misconfigured payment method become visible at a glance
    console.log("\nConfigured policy details");
    console.log("-------------------------");
    if (fulfillmentPolicyId) {
        const detail = await safeCall("getFulfillmentPolicy", () =>
            ebay.sell.account.getFulfillmentPolicy(fulfillmentPolicyId),
        );
        if (detail) {
            console.log(`  fulfillment ${fulfillmentPolicyId}:`);
            console.log(JSON.stringify(detail, null, 2).split("\n").map((l) => `    ${l}`).join("\n"));
        }
    }
    if (paymentPolicyId) {
        const detail = await safeCall("getPaymentPolicy", () =>
            ebay.sell.account.getPaymentPolicy(paymentPolicyId),
        );
        if (detail) {
            console.log(`  payment ${paymentPolicyId}:`);
            console.log(JSON.stringify(detail, null, 2).split("\n").map((l) => `    ${l}`).join("\n"));
        }
    }
    if (returnPolicyId) {
        const detail = await safeCall("getReturnPolicy", () =>
            ebay.sell.account.getReturnPolicy(returnPolicyId),
        );
        if (detail) {
            console.log(`  return ${returnPolicyId}:`);
            console.log(JSON.stringify(detail, null, 2).split("\n").map((l) => `    ${l}`).join("\n"));
        }
    }

    // selling privileges: sandbox accounts default to a 0/0 selling limit
    // until manually unlocked, which surfaces as a fieldless 25713 because
    // ebay refuses to publish anything beyond the account's allowance
    console.log("\nSeller privileges");
    console.log("-----------------");
    const privileges = await safeCall("getPrivileges", () =>
        ebay.sell.account.getPrivileges() as Promise<{
            sellingLimit?: {amount?: {value?: string; currency?: string}; quantity?: number};
            sellerRegistrationCompleted?: boolean;
        }>,
    );
    if (privileges) {
        const limitAmount = privileges.sellingLimit?.amount;
        const limitQuantity = privileges.sellingLimit?.quantity;
        check(
            "registration completed",
            privileges.sellerRegistrationCompleted === true,
            String(privileges.sellerRegistrationCompleted),
        );
        check(
            "selling limit (quantity)",
            (limitQuantity ?? 0) > 0,
            String(limitQuantity ?? "<unset>"),
        );
        check(
            "selling limit (amount)",
            Boolean(limitAmount?.value && parseFloat(limitAmount.value) > 0),
            limitAmount ? `${limitAmount.value} ${limitAmount.currency}` : "<unset>",
        );
    }

    // merchant location: the offer's merchantLocationKey must reference an
    // existing inventory location whose status is ENABLED. publishOffer
    // returns 25713 with no inputRefIds when the location is disabled or
    // unknown
    console.log("\nMerchant location");
    console.log("-----------------");
    if (!merchantLocationKey) {
        console.log("  ✗ merchant location key is not set in env");
    } else {
        const location = await safeCall<InventoryLocation>("getInventoryLocation", () =>
            ebay.sell.inventory.getInventoryLocation(merchantLocationKey),
        );
        if (location) {
            check(
                merchantLocationKey,
                location.merchantLocationStatus === "ENABLED",
                `name="${location.name}" status=${location.merchantLocationStatus} country=${location.location?.address?.country}`,
            );
        }
    }

    // also list all locations so a typo on the env key shows up clearly
    const allLocationsResp = await safeCall("getInventoryLocations", () =>
        ebay.sell.inventory.getInventoryLocations() as Promise<{locations?: InventoryLocation[]}>,
    );
    const allLocations = allLocationsResp?.locations ?? [];
    if (allLocations.length > 0) {
        console.log("\n  All inventory locations on this seller:");
        for (const loc of allLocations) {
            console.log(`    ${loc.merchantLocationKey} "${loc.name}" status=${loc.merchantLocationStatus}`);
        }
    }

    console.log("\nDone.\n");
}

main().catch((err) => {
    console.error("Diagnostic failed:", err);
    process.exit(1);
});
