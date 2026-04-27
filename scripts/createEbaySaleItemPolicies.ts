import {readFileSync} from "fs";
import {resolve} from "path";
import eBayApi from "ebay-api";
import {getEbayApiClient} from "../app/auto-ads/lib/ebayClient";

// load env vars from .env.dev in the parent directory; mirrors the seed
// and diagnostic scripts so a single .env file drives every helper
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

// FULFILLMENT POLICY NAME
const FULFILLMENT_POLICY_NAME = "ICE Auto Ads - Sale Items Pickup";
/**
 * Stable display name we use to identify (and reuse) the non-vehicle
 * fulfillment policy. Matching by name keeps the script idempotent so
 * reruns after a successful create just print the existing IDs rather
 * than spawning duplicate policies on the seller account.
 */

// PAYMENT POLICY NAME
const PAYMENT_POLICY_NAME = "ICE Auto Ads - Sale Items Payments";
/**
 * Stable display name for the non-vehicle payment policy. eBay GB is a
 * fully managed-payments marketplace, so this policy is intentionally
 * thin: it exists only so publishOffer has a non-vehicle paymentPolicyId
 * to attach to sale-item offers.
 */

// FULFILLMENT POLICY SUMMARY
type FulfillmentPolicySummary = {fulfillmentPolicyId?: string; name?: string; marketplaceId?: string};

// PAYMENT POLICY SUMMARY
type PaymentPolicySummary = {paymentPolicyId?: string; name?: string; marketplaceId?: string};

// EBAY API ERROR
type EbayApiError = Error & {meta?: {res?: {data?: unknown}}};

// FORMAT EBAY ERROR
function formatEbayError(err: unknown): string {
    /**
     * Pulls the structured error body out of an eBay SDK exception when
     * present and falls back to the plain message otherwise. eBay puts the
     * useful detail (errorId, fieldName, parameters) on err.meta.res.data
     * which is hidden from a default toString and would otherwise mask the
     * real reason a create call was rejected.
     */

    const e = err as EbayApiError;
    const data = e.meta?.res?.data;
    if (data) return JSON.stringify(data, null, 2);
    return e.message ?? String(err);
}

// BUILD FULFILLMENT BODY
function buildFulfillmentBody(marketplaceId: string): Record<string, unknown> {
    /**
     * Returns the request body for createFulfillmentPolicy configuring a
     * local-pickup-only profile bound to ALL_EXCLUDING_MOTORS_VEHICLES.
     * That category type is required because the Sell Inventory API
     * publish path picks non-vehicle eBay categories for sale items, and
     * a MOTORS_VEHICLES policy on a non-vehicle offer is the documented
     * cause of the fieldless error 25713 we have been chasing.
     *
     * pickupDropOff is set to true (and shippingOptions deliberately left
     * empty) because that is the modern non-deprecated way to express
     * "buyer collects from the seller's location"; the legacy localPickup
     * boolean is omitted so eBay does not flag a conflict between the two.
     */

    return {
        name: FULFILLMENT_POLICY_NAME,
        description: "Local pickup only for non-vehicle sale items.",
        marketplaceId,
        categoryTypes: [{name: "ALL_EXCLUDING_MOTORS_VEHICLES"}],
        handlingTime: {value: 1, unit: "DAY"},
        pickupDropOff: true,
        shippingOptions: [],
    };
}

// BUILD PAYMENT BODY
function buildPaymentBody(marketplaceId: string): Record<string, unknown> {
    /**
     * Returns the request body for createPaymentPolicy. paymentMethods is
     * left empty on purpose: EBAY_GB is a fully managed-payments market,
     * so eBay handles payment collection through the platform itself and
     * rejects bodies that try to declare CASH_ON_PICKUP, PAYPAL, etc on
     * non-vehicle policies. immediatePay is false because non-vehicle
     * sale items support local pickup where the buyer pays in person.
     */

    return {
        name: PAYMENT_POLICY_NAME,
        description: "Managed payments for non-vehicle sale items.",
        marketplaceId,
        categoryTypes: [{name: "ALL_EXCLUDING_MOTORS_VEHICLES"}],
        immediatePay: false,
        paymentMethods: [],
    };
}

// IS APPLY MODE
function isApplyMode(): boolean {
    /**
     * Returns true when either a CLI flag or env var requests destructive
     * mode. We accept both forms because `npm run <script> --apply` does
     * not forward the flag through to the underlying invocation unless the
     * caller remembers the `--` separator (`npm run … -- --apply`); the
     * APPLY env-var fallback removes that footgun. Defaulting to dry-run
     * keeps the script safe to run for a quick preview of what it would
     * change before actually mutating anything.
     */

    const cliFlag = process.argv.slice(2).includes("--apply");
    const envFlag = (process.env.APPLY || "").toLowerCase();
    return cliFlag || envFlag === "1" || envFlag === "true" || envFlag === "yes";
}

// FIND EXISTING FULFILLMENT POLICY
async function findExistingFulfillmentPolicy(
    ebay: Awaited<ReturnType<typeof getEbayApiClient>>,
    marketplaceId: string,
    name: string,
): Promise<FulfillmentPolicySummary | null> {
    /**
     * Lists every fulfillment policy on the configured marketplace and
     * returns the first one whose name matches. Used to make the create
     * step idempotent: if a previous run already produced the policy, we
     * surface its id instead of creating a duplicate.
     */

    const resp = (await ebay.sell.account.getFulfillmentPolicies(marketplaceId)) as {
        fulfillmentPolicies?: FulfillmentPolicySummary[];
    };
    return (resp.fulfillmentPolicies ?? []).find((p) => p.name === name) ?? null;
}

// FIND EXISTING PAYMENT POLICY
async function findExistingPaymentPolicy(
    ebay: Awaited<ReturnType<typeof getEbayApiClient>>,
    marketplaceId: string,
    name: string,
): Promise<PaymentPolicySummary | null> {
    /**
     * Mirror of findExistingFulfillmentPolicy for the payment policy list.
     * Kept as a separate function (rather than a generic helper) so the
     * SDK method names and the response field names line up at the call
     * site without any string-keyed indirection.
     */

    const resp = (await ebay.sell.account.getPaymentPolicies(marketplaceId)) as {
        paymentPolicies?: PaymentPolicySummary[];
    };
    return (resp.paymentPolicies ?? []).find((p) => p.name === name) ?? null;
}

// PRINT UI FALLBACK
function printUiFallback(): void {
    /**
     * Prints a manual eBay sandbox UI walkthrough as the documented
     * fallback for when the API path is rejected (different shipping
     * service codes per marketplace, locked-down sandbox accounts, etc).
     * Surfaced from both dry-run and error paths so the user always sees
     * the second route to the same outcome without a context switch.
     */

    console.log("\nUI fallback (use if the API path is rejected):");
    console.log("  1. Open the sandbox business policies page:");
    console.log("       https://www.bizpolicy.sandbox.ebay.co.uk/businesspolicy/manage");
    console.log("  2. Create a new Shipping policy:");
    console.log(`       Name:       ${FULFILLMENT_POLICY_NAME}`);
    console.log("       Categories: All categories except Motor Vehicles");
    console.log("       Domestic:   Local pickup only (no courier)");
    console.log("       Handling:   1 business day");
    console.log("  3. Create a new Payment policy:");
    console.log(`       Name:       ${PAYMENT_POLICY_NAME}`);
    console.log("       Categories: All categories except Motor Vehicles");
    console.log("       Methods:    leave at the marketplace default (managed payments)");
    console.log("  4. Copy the new policy IDs and update .env.dev:");
    console.log("       AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID=<new fulfillment id>");
    console.log("       AUTO_ADS_EBAY_PAYMENT_POLICY_ID=<new payment id>");
    console.log("  5. Leave AUTO_ADS_EBAY_RETURN_POLICY_ID alone — the existing");
    console.log("     non-vehicle return policy is already valid for sale items.");
}

// MAIN
async function main(): Promise<void> {
    /**
     * Creates (or reuses) non-vehicle fulfillment and payment policies for
     * sale-item publishing and prints the IDs the caller should put into
     * .env.dev. eBay's update endpoints refuse to widen an existing
     * MOTORS_VEHICLES policy onto ALL_EXCLUDING_MOTORS_VEHICLES (per the
     * docs: "If you want a different categoryType policy, create a new
     * policy"), so spawning fresh policies and re-pointing the env vars
     * is the only path to a working sale-item publish flow.
     */

    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;
    const apply = isApplyMode();

    console.log(`Marketplace: ${marketplaceId}`);
    console.log(apply ? "Mode: APPLY (will create policies on eBay)" : "Mode: dry-run (no changes)");
    console.log("Pass --apply (or APPLY=1) to actually create the policies.\n");

    const ebay = await getEbayApiClient();

    // build the bodies up front so the dry-run preview shows exactly what
    // an --apply run would send to eBay
    const fulfillmentBody = buildFulfillmentBody(marketplaceId);
    const paymentBody = buildPaymentBody(marketplaceId);

    console.log("Intended fulfillment policy body:");
    console.log(JSON.stringify(fulfillmentBody, null, 2).split("\n").map((l) => `  ${l}`).join("\n"));
    console.log("\nIntended payment policy body:");
    console.log(JSON.stringify(paymentBody, null, 2).split("\n").map((l) => `  ${l}`).join("\n"));

    // probe for an already-created policy with the same name so reruns are
    // idempotent and so a successful previous run is not wasted on a
    // dry-run-curious user
    console.log("\nChecking for existing policies with these names…");
    const existingFulfillment = await findExistingFulfillmentPolicy(
        ebay,
        marketplaceId,
        FULFILLMENT_POLICY_NAME,
    );
    const existingPayment = await findExistingPaymentPolicy(
        ebay,
        marketplaceId,
        PAYMENT_POLICY_NAME,
    );

    if (existingFulfillment?.fulfillmentPolicyId) {
        console.log(`  ✓ fulfillment policy already exists: id=${existingFulfillment.fulfillmentPolicyId}`);
    } else {
        console.log(`  ✗ fulfillment policy "${FULFILLMENT_POLICY_NAME}" not found`);
    }
    if (existingPayment?.paymentPolicyId) {
        console.log(`  ✓ payment policy already exists: id=${existingPayment.paymentPolicyId}`);
    } else {
        console.log(`  ✗ payment policy "${PAYMENT_POLICY_NAME}" not found`);
    }

    if (!apply) {
        console.log("\nDry-run complete; pass --apply (or APPLY=1) to create missing policies.");
        printUiFallback();
        return;
    }

    let fulfillmentId = existingFulfillment?.fulfillmentPolicyId;
    let paymentId = existingPayment?.paymentPolicyId;

    if (!fulfillmentId) {
        console.log("\nCreating fulfillment policy…");
        try {
            const res = (await ebay.sell.account.createFulfillmentPolicy(fulfillmentBody)) as
                | {fulfillmentPolicyId?: string}
                | undefined;
            // ebay's create endpoints return 201 with a Location header and
            // the new policy in the body, but the SDK occasionally hands
            // back an empty body (or a parsed-Location stub) so we always
            // fall back to a name lookup to recover the id deterministically
            fulfillmentId = res?.fulfillmentPolicyId;
            if (!fulfillmentId) {
                console.log("  (create response omitted fulfillmentPolicyId; raw body below)");
                console.log("  " + JSON.stringify(res ?? null));
                const lookup = await findExistingFulfillmentPolicy(
                    ebay,
                    marketplaceId,
                    FULFILLMENT_POLICY_NAME,
                );
                fulfillmentId = lookup?.fulfillmentPolicyId;
            }
            if (!fulfillmentId) {
                console.error("  ✗ create succeeded but the new policy was not visible on getFulfillmentPolicies; aborting before we touch .env.dev");
                printUiFallback();
                process.exit(1);
            }
            console.log(`  ✓ created fulfillment policy id=${fulfillmentId}`);
        } catch (err) {
            console.error("  ✗ createFulfillmentPolicy failed:");
            console.error(formatEbayError(err).split("\n").map((l) => `    ${l}`).join("\n"));
            printUiFallback();
            process.exit(1);
        }
    }

    if (!paymentId) {
        console.log("\nCreating payment policy…");
        try {
            const res = (await ebay.sell.account.createPaymentPolicy(paymentBody)) as
                | {paymentPolicyId?: string}
                | undefined;
            // same Location-header fallback as the fulfillment branch above
            paymentId = res?.paymentPolicyId;
            if (!paymentId) {
                console.log("  (create response omitted paymentPolicyId; raw body below)");
                console.log("  " + JSON.stringify(res ?? null));
                const lookup = await findExistingPaymentPolicy(
                    ebay,
                    marketplaceId,
                    PAYMENT_POLICY_NAME,
                );
                paymentId = lookup?.paymentPolicyId;
            }
            if (!paymentId) {
                console.error("  ✗ create succeeded but the new policy was not visible on getPaymentPolicies; aborting before we touch .env.dev");
                printUiFallback();
                process.exit(1);
            }
            console.log(`  ✓ created payment policy    id=${paymentId}`);
        } catch (err) {
            console.error("  ✗ createPaymentPolicy failed:");
            console.error(formatEbayError(err).split("\n").map((l) => `    ${l}`).join("\n"));
            printUiFallback();
            process.exit(1);
        }
    }

    // tell the caller exactly what to paste into .env.dev so they don't
    // have to hunt through this output for the right ID
    console.log("\nUpdate .env.dev with these values:");
    console.log(`  AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID=${fulfillmentId}`);
    console.log(`  AUTO_ADS_EBAY_PAYMENT_POLICY_ID=${paymentId}`);
    console.log("  (leave AUTO_ADS_EBAY_RETURN_POLICY_ID untouched)\n");

    console.log("Then re-run `npm run diagnose:ebay-setup` to verify, and retry publish.");
    console.log("\nDone.\n");
}

main().catch((err) => {
    console.error("Failed:", formatEbayError(err));
    printUiFallback();
    process.exit(1);
});
