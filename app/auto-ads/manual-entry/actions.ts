"use server";

import {randomBytes} from "crypto";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, lookups} from "@/drizzle/auto-ads/schema";
import {eq, and, ne, inArray} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";
import {processAiAnalysisForListing, type AiAnalysisFields} from "@app/auto-ads/lib/aiAnalysis";

// PROSPECT LISTING DATA
export type ProspectListingData = {
    id?: number;
    status: string;
    makeAndModel: string;
    shortDescription: string;
    fullDescription: string | null;
    mileage: number | null;
    mileageUnit: string | null;
    year: number | null;
    registration: string | null;
    currencySymbol: string | null;
    askingPrice: number | null;
    vatStatus: string | null;
    location: string | null;
    bodyType: string | null;
    cabType: string | null;
    fuelType: string | null;
    gearboxType: string | null;
    wheelbase: string | null;
    engineSize: string | null;
    colour: string | null;
    seats: number | null;
    emissionClass: string | null;
    numberOfOwners: number | null;
    serviceHistory: string | null;
    basicHistoryCheck: string | null;
    motStatus: string | null;
    motExpiry: string | null;
    specsAndFeatures: string | null;
    taxStatus: string | null;
    taxDueDate: string | null;
    co2Emissions: number | null;
    markedForExport: boolean | null;
    dateOfLastV5CIssued: string | null;
    monthOfFirstRegistration: string | null;
    typeApproval: string | null;
    revenueWeight: number | null;
};
/**
 * Shape of prospect listing data sent from the editor form.
 * Includes an optional `id` to distinguish inserts from updates.
 */

// GET MANUAL ENTRY LISTINGS
export async function getManualEntryListings(): Promise<{
    success: boolean;
    listings?: {id: number; makeAndModel: string; shortDescription: string; registration: string | null}[];
    error?: string;
}> {
    /**
     * Fetches all prospect listings with source "ManualEntry" and a status
     * other than "Sold", returning the id, make/model, short description, and
     * registration for use in the listing selector dropdown.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const rows = await getAutoAdsDb()
            .select({
                id: prospectListings.id,
                makeAndModel: prospectListings.makeAndModel,
                shortDescription: prospectListings.shortDescription,
                registration: prospectListings.registration,
            })
            .from(prospectListings)
            .where(
                and(
                    eq(prospectListings.listingSource, "ManualEntry"),
                    ne(prospectListings.status, "Sold"),
                )
            );

        return {success: true, listings: rows};
    } catch (err) {
        console.error("Failed to fetch manual entry listings:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// GET LOOKUP VALUES
export async function getLookupValues(lookupTypes: string[]): Promise<{
    success: boolean;
    lookupMap?: Record<string, string[]>;
    error?: string;
}> {
    /**
     * Fetches lookup codes for the given lookup types in a single query,
     * returning a map of lookupType to an array of code strings.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const rows = await getAutoAdsDb()
            .select({
                lookupType: lookups.lookupType,
                code: lookups.code,
            })
            .from(lookups)
            .where(inArray(lookups.lookupType, lookupTypes));

        const lookupMap: Record<string, string[]> = {};
        for (const type of lookupTypes) {
            lookupMap[type] = [];
        }
        for (const row of rows) {
            if (lookupMap[row.lookupType]) {
                lookupMap[row.lookupType].push(row.code);
            }
        }

        return {success: true, lookupMap};
    } catch (err) {
        console.error("Failed to fetch lookup values:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// GET PROSPECT LISTING
export async function getProspectListing(id: number): Promise<{
    success: boolean;
    listing?: ProspectListingData;
    error?: string;
}> {
    /**
     * Fetches a single prospect listing by id for editing, returning only the
     * fields relevant to the editor form.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const [row] = await getAutoAdsDb()
            .select({
                id: prospectListings.id,
                status: prospectListings.status,
                makeAndModel: prospectListings.makeAndModel,
                shortDescription: prospectListings.shortDescription,
                fullDescription: prospectListings.fullDescription,
                mileage: prospectListings.mileage,
                mileageUnit: prospectListings.mileageUnit,
                year: prospectListings.year,
                registration: prospectListings.registration,
                currencySymbol: prospectListings.currencySymbol,
                askingPrice: prospectListings.askingPrice,
                vatStatus: prospectListings.vatStatus,
                location: prospectListings.location,
                bodyType: prospectListings.bodyType,
                cabType: prospectListings.cabType,
                fuelType: prospectListings.fuelType,
                gearboxType: prospectListings.gearboxType,
                wheelbase: prospectListings.wheelbase,
                engineSize: prospectListings.engineSize,
                colour: prospectListings.colour,
                seats: prospectListings.seats,
                emissionClass: prospectListings.emissionClass,
                numberOfOwners: prospectListings.numberOfOwners,
                serviceHistory: prospectListings.serviceHistory,
                basicHistoryCheck: prospectListings.basicHistoryCheck,
                motStatus: prospectListings.motStatus,
                motExpiry: prospectListings.motExpiry,
                specsAndFeatures: prospectListings.specsAndFeatures,
                taxStatus: prospectListings.taxStatus,
                taxDueDate: prospectListings.taxDueDate,
                co2Emissions: prospectListings.co2Emissions,
                markedForExport: prospectListings.markedForExport,
                dateOfLastV5CIssued: prospectListings.dateOfLastV5CIssued,
                monthOfFirstRegistration: prospectListings.monthOfFirstRegistration,
                typeApproval: prospectListings.typeApproval,
                revenueWeight: prospectListings.revenueWeight,
            })
            .from(prospectListings)
            .where(eq(prospectListings.id, id));

        if (!row) {
            return {success: false, error: "Listing not found"};
        }

        return {success: true, listing: row};
    } catch (err) {
        console.error("Failed to fetch prospect listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// SAVE PROSPECT LISTING
export async function saveProspectListing(data: ProspectListingData): Promise<{
    success: boolean;
    id?: number;
    error?: string;
}> {
    /**
     * Inserts a new prospect listing or updates an existing one. New listings
     * get a random 16-char hex hash code and fixed defaults for source, url,
     * and timestamps. Updates only touch the editable fields and updatedAt.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const now = new Date().toISOString();

        if (data.id) {
            // update existing listing
            await getAutoAdsDb()
                .update(prospectListings)
                .set({
                    status: data.status as typeof prospectListings.$inferInsert.status,
                    makeAndModel: data.makeAndModel,
                    shortDescription: data.shortDescription,
                    fullDescription: data.fullDescription,
                    mileage: data.mileage,
                    mileageUnit: data.mileageUnit,
                    year: data.year,
                    registration: data.registration,
                    currencySymbol: data.currencySymbol,
                    askingPrice: data.askingPrice,
                    vatStatus: data.vatStatus,
                    location: data.location,
                    bodyType: data.bodyType,
                    cabType: data.cabType,
                    fuelType: data.fuelType,
                    gearboxType: data.gearboxType,
                    wheelbase: data.wheelbase,
                    engineSize: data.engineSize,
                    colour: data.colour,
                    seats: data.seats,
                    emissionClass: data.emissionClass,
                    numberOfOwners: data.numberOfOwners,
                    serviceHistory: data.serviceHistory,
                    basicHistoryCheck: data.basicHistoryCheck,
                    motStatus: data.motStatus,
                    motExpiry: data.motExpiry,
                    specsAndFeatures: data.specsAndFeatures,
                    taxStatus: data.taxStatus,
                    taxDueDate: data.taxDueDate,
                    co2Emissions: data.co2Emissions,
                    markedForExport: data.markedForExport,
                    dateOfLastV5CIssued: data.dateOfLastV5CIssued,
                    monthOfFirstRegistration: data.monthOfFirstRegistration,
                    typeApproval: data.typeApproval,
                    revenueWeight: data.revenueWeight,
                    updatedAt: now,
                })
                .where(eq(prospectListings.id, data.id));

            revalidatePath("/auto-ads/manual-entry");
            revalidatePath("/auto-ads/prospects");
            return {success: true, id: data.id};
        }

        // insert new listing
        const hashCode = randomBytes(8).toString("hex");

        const [inserted] = await getAutoAdsDb()
            .insert(prospectListings)
            .values({
                hashCode,
                createdAt: now,
                updatedAt: now,
                listingSource: "ManualEntry",
                status: data.status as typeof prospectListings.$inferInsert.status,
                makeAndModel: data.makeAndModel,
                shortDescription: data.shortDescription,
                url: "",
                fullDescription: data.fullDescription,
                mileage: data.mileage,
                mileageUnit: data.mileageUnit,
                year: data.year,
                registration: data.registration,
                currencySymbol: data.currencySymbol,
                askingPrice: data.askingPrice,
                vatStatus: data.vatStatus,
                location: data.location,
                bodyType: data.bodyType,
                cabType: data.cabType,
                fuelType: data.fuelType,
                gearboxType: data.gearboxType,
                wheelbase: data.wheelbase,
                engineSize: data.engineSize,
                colour: data.colour,
                seats: data.seats,
                emissionClass: data.emissionClass,
                numberOfOwners: data.numberOfOwners,
                serviceHistory: data.serviceHistory,
                basicHistoryCheck: data.basicHistoryCheck,
                motStatus: data.motStatus,
                motExpiry: data.motExpiry,
                specsAndFeatures: data.specsAndFeatures,
                taxStatus: data.taxStatus,
                taxDueDate: data.taxDueDate,
                co2Emissions: data.co2Emissions,
                markedForExport: data.markedForExport,
                dateOfLastV5CIssued: data.dateOfLastV5CIssued,
                monthOfFirstRegistration: data.monthOfFirstRegistration,
                typeApproval: data.typeApproval,
                revenueWeight: data.revenueWeight,
            })
            .returning({id: prospectListings.id});

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        return {success: true, id: inserted.id};
    } catch (err) {
        console.error("Failed to save prospect listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// VEHICLE TYPE
export type VehicleType = "Car" | "Van";
/** Selector value driving which prompt template the AI analysis uses. */

// PROMPT FILENAME FOR VEHICLE TYPE
const PROMPT_FILENAME_FOR_VEHICLE_TYPE: Record<VehicleType, string> = {
    Car: "car_prompt.md",
    Van: "van_prompt.md",
};
/** Maps each vehicle type to the markdown prompt file under app/. */

// GET PROSPECT AI ANALYSIS
export async function getProspectAiAnalysis(listingId: number): Promise<{
    success: boolean;
    fields?: AiAnalysisFields;
    error?: string;
}> {
    /**
     * Fetches the AI analysis fields currently stored on a prospect listing.
     * Used by the manual-entry editor to populate the AI Assistant section
     * when a listing is loaded so previously generated output is visible.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const [row] = await getAutoAdsDb()
            .select({
                aiResellOverview: prospectListings.aiResellOverview,
                aiWorkAndRepairs: prospectListings.aiWorkAndRepairs,
                aiResellNotes: prospectListings.aiResellNotes,
                aiValueAddImprovements: prospectListings.aiValueAddImprovements,
                aiCampervanConversion: prospectListings.aiCampervanConversion,
                aiTargetMarket: prospectListings.aiTargetMarket,
                aiBuyPriceLow: prospectListings.aiBuyPriceLow,
                aiBuyPriceHigh: prospectListings.aiBuyPriceHigh,
                aiRepairCost: prospectListings.aiRepairCost,
                aiSellPriceLow: prospectListings.aiSellPriceLow,
                aiSellPriceHigh: prospectListings.aiSellPriceHigh,
            })
            .from(prospectListings)
            .where(eq(prospectListings.id, listingId));

        if (!row) {
            return {success: false, error: "Listing not found"};
        }

        return {success: true, fields: row};
    } catch (err) {
        console.error("Failed to fetch prospect AI analysis:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// RUN AI ANALYSIS
export async function runAiAnalysis(
    listingId: number,
    vehicleType: VehicleType,
): Promise<{success: boolean; fields?: AiAnalysisFields; error?: string}> {
    /**
     * Runs the AI analysis workflow for a manually-entered prospect listing
     * using the prompt template selected by vehicleType. Loads the listing,
     * passes it through processAiAnalysisForListing which calls Gemini and
     * persists the parsed fields, then revalidates affected paths.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // load the full listing row to feed into the analysis
        const [listing] = await getAutoAdsDb()
            .select()
            .from(prospectListings)
            .where(eq(prospectListings.id, listingId));

        if (!listing) {
            return {success: false, error: "Listing not found"};
        }

        const promptFilename = PROMPT_FILENAME_FOR_VEHICLE_TYPE[vehicleType];
        const result = await processAiAnalysisForListing(promptFilename, listing);

        if (!result.success || !result.fields) {
            return {success: false, error: result.error || "AI analysis failed"};
        }

        revalidatePath("/auto-ads/manual-entry");
        revalidatePath("/auto-ads/prospects");
        return {success: true, fields: result.fields};
    } catch (err) {
        console.error("Failed to run AI analysis:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}
