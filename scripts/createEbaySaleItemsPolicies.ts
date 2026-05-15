import eBayApi from "ebay-api";
import {getEbayApiClient} from "../app/auto-ads/lib/ebayClient";
import {loadEnv} from "./loadEnv";

// hydrate process.env from the shared .env plus the per-environment override
loadEnv();

// FULFILLMENT POLICY NAME
const FULFILLMENT_POLICY_NAME = "ICE Auto Ads - Sale Items Fulfillment";
/**
 * Stable name we look up before creating, so re-running the script is a
 * no-op once the policy exists. Whenever this string changes the next
 * run will create a brand new policy alongside the old one.
 */

// PAYMENT POLICY NAME
const PAYMENT_POLICY_NAME = "ICE Auto Ads - Sale Items Payment";
/**
 * Mirror of FULFILLMENT_POLICY_NAME for the payment side. Kept distinct
 * from the existing motor-vehicle policy so vehicle listings continue to
 * use their own configuration unchanged.
 */

// NON VEHICLE TYPE
const NON_VEHICLE_TYPE = "ALL_EXCLUDING_MOTORS_VEHICLES";
/**
 * eBay categoryType enum that scopes a policy to every non-vehicle
 * category. Required because eBay rejects publishOffer on a non-vehicle
 * category if the linked fulfillment/payment policies are tagged
 * MOTORS_VEHICLES (the original cause of the fieldless errorId 25713).
 */

// FULFILLMENT POLICY SUMMARY
type FulfillmentPolicySummary = {
    fulfillmentPolicyId?: string;
    name?: string;
    marketplaceId?: string;
    categoryTypes?: {name?: string}[];
};

// PAYMENT POLICY SUMMARY
type PaymentPolicySummary = {
    paymentPolicyId?: string;
    name?: string;
    marketplaceId?: string;
    categoryTypes?: {name?: string}[];
};

// FULFILLMENT POLICY BODY
type FulfillmentPolicyBody = {
    name: string;
    description?: string;
    marketplaceId: string;
    categoryTypes: {name: string}[];
    handlingTime: {value: number; unit: string};
    pickupDropOff?: boolean;
    localPickup?: boolean;
    freightShipping?: boolean;
    globalShipping?: boolean;
    shippingOptions: ShippingOption[];
};

// SHIPPING OPTION
type ShippingOption = {
    optionType: string;
    costType: string;
    shippingServices: ShippingService[];
};

// SHIPPING SERVICE
type ShippingService = {
    shippingServiceCode: string;
    shippingCarrierCode?: string;
    shippingCost: {value: string; currency: string};
    freeShipping: boolean;
    buyerResponsibleForShipping?: boolean;
    sortOrder?: number;
};

// PAYMENT METHOD
type PaymentMethod = {
    brands?: string[];
    paymentMethodType?: string;
    recipientAccountReference?: {
        referenceId?: string;
        referenceType?: string;
    };
};

// PAYMENT POLICY BODY
type PaymentPolicyBody = {
    name: string;
    description?: string;
    marketplaceId: string;
    categoryTypes: {name: string}[];
    immediatePay: boolean;
    paymentMethods: PaymentMethod[];
};

// BUILD FULFILLMENT BODY
function buildFulfillmentBody(marketplaceId: string, currency: string): FulfillmentPolicyBody {
    /**
     * Returns a minimal fulfillment policy body for non-vehicle sale items
     * with both local pickup and a single domestic courier service. eBay
     * sandbox rejects pure-pickup fulfillment policies on non-vehicle
     * categories ("Invalid categoryTypes.name" with errorId 20403) so we
     * pair the localPickup flag with one shipping option to satisfy the
     * non-vehicle validation, while still letting buyers collect at the
     * warehouse if they prefer.
     */

    return {
        name: FULFILLMENT_POLICY_NAME,
        description: "Auto-created by createEbaySaleItemsPolicies for non-vehicle sale items",
        marketplaceId,
        categoryTypes: [{name: NON_VEHICLE_TYPE}],
        handlingTime: {value: 1, unit: "DAY"},
        pickupDropOff: true,
        localPickup: true,
        freightShipping: false,
        globalShipping: false,
        shippingOptions: [
            {
                optionType: "DOMESTIC",
                costType: "FLAT_RATE",
                shippingServices: [
                    {
                        // UK_OtherCourier24 is the catch-all 24h courier code
                        // accepted on EBAY_GB sandbox; it lets eBay validate
                        // the policy even though buyers will normally pick
                        // up locally
                        shippingServiceCode: "UK_OtherCourier24",
                        shippingCarrierCode: "Other",
                        shippingCost: {value: "9.99", currency},
                        freeShipping: false,
                        buyerResponsibleForShipping: false,
                        sortOrder: 1,
                    },
                ],
            },
        ],
    };
}

// BUILD PAYMENT BODY
function buildPaymentBody(marketplaceId: string): PaymentPolicyBody {
    /**
     * Returns a payment policy body for a managed-payments marketplace
     * such as EBAY_GB, where eBay handles the buyer charge automatically
     * and the policy must therefore declare an empty paymentMethods
     * array. immediatePay is left false to match the current vehicle
     * policy and avoid forcing buyer behaviour.
     */

    return {
        name: PAYMENT_POLICY_NAME,
        description: "Auto-created by createEbaySaleItemsPolicies for non-vehicle sale items",
        marketplaceId,
        categoryTypes: [{name: NON_VEHICLE_TYPE}],
        immediatePay: false,
        paymentMethods: [],
    };
}

// FORMAT EBAY ERROR
function formatEbayError(err: unknown): string {
    /**
     * Pulls the structured error body out of an ebay-api SDK rejection so
     * the script's failure mode is "paste this JSON and ask why" rather
     * than the SDK's terse one-line message.
     */

    const e = err as Error & {meta?: {res?: {data?: unknown}}};
    const data = e.meta?.res?.data;
    if (data) return JSON.stringify(data, null, 2);
    return e.message || String(err);
}

// FIND BY NAME
function findByName<T extends {name?: string}>(items: T[], targetName: string): T | undefined {
    /**
     * Case-insensitive search for an existing policy by name so re-runs
     * detect the previously-created policy even if eBay normalised
     * whitespace or casing.
     */

    const normalised = targetName.trim().toLowerCase();
    return items.find((item) => (item.name ?? "").trim().toLowerCase() === normalised);
}

// MAIN
async function main(): Promise<void> {
    /**
     * Creates (or reuses) the fulfillment and payment policies the Sell
     * Inventory publish path needs for non-vehicle sale items, then
     * prints the IDs and the env-var lines the user should drop into
     * .env.dev. Idempotent: a policy with the same name is reused
     * instead of duplicated, so the script is safe to re-run.
     */

    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;
    // ebay sandbox marketplaces map to a single currency each; ebay_gb is gbp,
    // ebay_us is usd, ebay_de is eur, etc. fall back to gbp for the project default
    const currency = marketplaceId.endsWith("US")
        ? "USD"
        : marketplaceId === eBayApi.MarketplaceId.EBAY_DE
          ? "EUR"
          : "GBP";

    console.log("\nCreating non-vehicle policies for sale items");
    console.log("--------------------------------------------");
    console.log(`  marketplace: ${marketplaceId}`);
    console.log(`  currency:    ${currency}`);
    console.log(`  fulfillment: "${FULFILLMENT_POLICY_NAME}"`);
    console.log(`  payment:     "${PAYMENT_POLICY_NAME}"`);

    const ebay = await getEbayApiClient();

    // list existing policies up front so we can short-circuit when one
    // with the chosen name already exists (idempotent re-runs)
    const fulfillmentResp = (await ebay.sell.account.getFulfillmentPolicies(marketplaceId)) as {
        fulfillmentPolicies?: FulfillmentPolicySummary[];
    };
    const paymentResp = (await ebay.sell.account.getPaymentPolicies(marketplaceId)) as {
        paymentPolicies?: PaymentPolicySummary[];
    };
    const existingFulfillment = findByName(
        fulfillmentResp.fulfillmentPolicies ?? [],
        FULFILLMENT_POLICY_NAME,
    );
    const existingPayment = findByName(paymentResp.paymentPolicies ?? [], PAYMENT_POLICY_NAME);

    let fulfillmentPolicyId: string | undefined;
    let paymentPolicyId: string | undefined;

    console.log("\nFulfillment policy");
    console.log("------------------");
    if (existingFulfillment?.fulfillmentPolicyId) {
        fulfillmentPolicyId = existingFulfillment.fulfillmentPolicyId;
        console.log(`  ✓ already exists: ${fulfillmentPolicyId}`);
        console.log(
            `    categoryTypes: ${JSON.stringify(existingFulfillment.categoryTypes ?? [])}`,
        );
    } else {
        try {
            // create returns the new id either as a body field or via the
            // Location header; ebay-api surfaces both via a location/result
            // shape so we accept either to keep the script forgiving
            const created = (await ebay.sell.account.createFulfillmentPolicy(
                buildFulfillmentBody(marketplaceId, currency),
            )) as {fulfillmentPolicyId?: string; location?: string};
            fulfillmentPolicyId =
                created.fulfillmentPolicyId ?? created.location?.split("/").pop();
            console.log(`  ✓ created: ${fulfillmentPolicyId ?? "<id missing in response>"}`);
        } catch (err) {
            console.error(`  ✗ create failed:\n${formatEbayError(err)}`);
            process.exit(1);
        }
    }

    console.log("\nPayment policy");
    console.log("--------------");
    if (existingPayment?.paymentPolicyId) {
        paymentPolicyId = existingPayment.paymentPolicyId;
        console.log(`  ✓ already exists: ${paymentPolicyId}`);
        console.log(`    categoryTypes: ${JSON.stringify(existingPayment.categoryTypes ?? [])}`);
    } else {
        try {
            const created = (await ebay.sell.account.createPaymentPolicy(
                buildPaymentBody(marketplaceId),
            )) as {paymentPolicyId?: string; location?: string};
            paymentPolicyId = created.paymentPolicyId ?? created.location?.split("/").pop();
            console.log(`  ✓ created: ${paymentPolicyId ?? "<id missing in response>"}`);
        } catch (err) {
            console.error(`  ✗ create failed:\n${formatEbayError(err)}`);
            process.exit(1);
        }
    }

    // print a copy-pastable .env.dev snippet so the operator never has to
    // hand-edit the ids; the existing return policy id is preserved because
    // 6220969000 ("Return profile (publish-safe)") is already non-vehicle
    console.log("\nUpdate .env.dev with these lines (replacing the existing values):");
    console.log("-----------------------------------------------------------------");
    if (fulfillmentPolicyId) {
        console.log(`AUTO_ADS_EBAY_FULFILLMENT_POLICY_ID=${fulfillmentPolicyId}`);
    }
    if (paymentPolicyId) {
        console.log(`AUTO_ADS_EBAY_PAYMENT_POLICY_ID=${paymentPolicyId}`);
    }

    console.log("\nNext steps:");
    console.log("  1. Paste the lines above into .env.dev (replace the old motor-vehicle ids).");
    console.log("  2. Restart `npm run dev` so server actions pick up the new env values.");
    console.log("  3. Re-run `npm run diagnose:ebay-setup` to confirm the new ids resolve.");
    console.log("  4. Try publishing a sale item again.\n");
}

main().catch((err) => {
    console.error("Script failed:", formatEbayError(err));
    process.exit(1);
});
