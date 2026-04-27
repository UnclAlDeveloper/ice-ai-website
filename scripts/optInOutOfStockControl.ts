import {readFileSync} from "fs";
import {resolve} from "path";
import {getEbayApiClient} from "../app/auto-ads/lib/ebayClient";

// load env vars from .env.dev so the same refresh token / client id our
// other scripts use also drives this opt-in call
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

// PROGRAM TYPE
const PROGRAM_TYPE = "OUT_OF_STOCK_CONTROL";
/**
 * eBay seller program that lets a seller leave a multi-quantity listing
 * live with availableQuantity 0 instead of having eBay end the listing.
 * Sandbox sellers in EBAY_GB occasionally need this opt-in alongside
 * SELLING_POLICY_MANAGEMENT before publishOffer will accept anything;
 * opting in is a free no-op when not needed, so it is a cheap thing to
 * try before spinning up a fresh sandbox seller account.
 */

// FORMAT EBAY ERROR
function formatEbayError(err: unknown): string {
    /**
     * Pulls the structured error body out of an eBay SDK exception when
     * present and falls back to the plain message otherwise. eBay puts
     * the useful detail (errorId, fieldName, parameters) on
     * err.meta.res.data which is hidden from a default toString.
     */

    const e = err as Error & {meta?: {res?: {data?: unknown}}};
    const data = e.meta?.res?.data;
    if (data) return JSON.stringify(data, null, 2);
    return e.message ?? String(err);
}

// MAIN
async function main(): Promise<void> {
    /**
     * Opts the configured eBay seller into the OUT_OF_STOCK_CONTROL
     * program if they are not already opted in, then prints the full
     * list of opted-in programs so the caller can verify the change
     * and feed it back into npm run diagnose:ebay-setup.
     */

    const ebay = await getEbayApiClient();

    // probe current state first so an already-opted-in account exits
    // cleanly without an unnecessary write call
    type ProgramRow = {programType?: string};
    const before = (await ebay.sell.account.getOptedInPrograms()) as {programs?: ProgramRow[]};
    const beforeSet = new Set((before.programs ?? []).map((p) => p.programType).filter(Boolean));
    console.log(`Currently opted in: ${[...beforeSet].join(", ") || "<none>"}`);

    if (beforeSet.has(PROGRAM_TYPE)) {
        console.log(`Already opted into ${PROGRAM_TYPE}; nothing to do.`);
        return;
    }

    console.log(`Opting into ${PROGRAM_TYPE}…`);
    try {
        await ebay.sell.account.optInToProgram({programType: PROGRAM_TYPE});
    } catch (err) {
        console.error("optInToProgram failed:");
        console.error(formatEbayError(err));
        process.exit(1);
    }

    // re-read so the success message reflects ebay's authoritative list
    // rather than whatever the optInToProgram response did or did not
    // return (some sdk versions return an empty 204)
    const after = (await ebay.sell.account.getOptedInPrograms()) as {programs?: ProgramRow[]};
    const afterSet = new Set((after.programs ?? []).map((p) => p.programType).filter(Boolean));
    console.log(`Now opted in: ${[...afterSet].join(", ") || "<none>"}`);

    if (!afterSet.has(PROGRAM_TYPE)) {
        console.error(`opt-in completed without error but ${PROGRAM_TYPE} is still missing; see eBay sandbox seller dashboard.`);
        process.exit(1);
    }

    console.log("\nNext: re-run npm run diagnose:ebay-setup, then retry Create.");
}

main().catch((err) => {
    console.error("Failed:", formatEbayError(err));
    process.exit(1);
});
