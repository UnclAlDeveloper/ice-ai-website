"use server";

import {randomBytes} from "crypto";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, lookups} from "@/drizzle/auto-ads/schema";
import {eq, and, ne, inArray} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";

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
};
/**
 * Shape of prospect listing data sent from the editor form.
 * Includes an optional `id` to distinguish inserts from updates.
 */

// GET MANUAL ENTRY LISTINGS
export async function getManualEntryListings(): Promise<{
    success: boolean;
    listings?: {id: number; makeAndModel: string; shortDescription: string}[];
    error?: string;
}> {
    /**
     * Fetches all prospect listings with source "ManualEntry" and a status
     * other than "Sold", returning the id, make/model, and short description
     * for use in the listing selector dropdown.
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
