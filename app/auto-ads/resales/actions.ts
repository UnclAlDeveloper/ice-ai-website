"use server";

import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {resaleListings} from "@/drizzle/auto-ads/schema";
import {eq, ne} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";

// RESALE LISTING DATA
export type ResaleListingData = {
    id?: number;
    prospectId?: number | null;
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
    aiSellPriceLow: number | null;
    aiSellPriceHigh: number | null;
    adsPrice: number | null;
    ebayCategoryId: string | null;
    eBayUrl: string;
    facebookUrl: string;
};
/**
 * Shape of resale listing data sent from and returned to the editor form.
 * Includes an optional `id` to distinguish inserts from updates. Compared to
 * prospect listings, the status enum is narrower ('Bought' | 'Sold') and the
 * resale-specific fields ebayCategoryId, eBayUrl, facebookUrl, and adsPrice are present.
 */

// GET RESALE LISTINGS
export async function getResaleListings(): Promise<{
    success: boolean;
    listings?: {id: number; makeAndModel: string; shortDescription: string; registration: string | null}[];
    error?: string;
}> {
    /**
     * Fetches all resale listings with a status other than 'Sold', returning
     * the id, make/model, short description, and registration for use in the
     * listing selector dropdown.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const rows = await getAutoAdsDb()
            .select({
                id: resaleListings.id,
                makeAndModel: resaleListings.makeAndModel,
                shortDescription: resaleListings.shortDescription,
                registration: resaleListings.registration,
            })
            .from(resaleListings)
            .where(ne(resaleListings.status, "Sold"));

        return {success: true, listings: rows};
    } catch (err) {
        console.error("Failed to fetch resale listings:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// GET RESALE LISTING
export async function getResaleListing(id: number): Promise<{
    success: boolean;
    listing?: ResaleListingData;
    error?: string;
}> {
    /**
     * Fetches a single resale listing by id for editing, returning only the
     * fields relevant to the editor form.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const [row] = await getAutoAdsDb()
            .select({
                id: resaleListings.id,
                prospectId: resaleListings.prospectId,
                status: resaleListings.status,
                makeAndModel: resaleListings.makeAndModel,
                shortDescription: resaleListings.shortDescription,
                fullDescription: resaleListings.fullDescription,
                mileage: resaleListings.mileage,
                mileageUnit: resaleListings.mileageUnit,
                year: resaleListings.year,
                registration: resaleListings.registration,
                currencySymbol: resaleListings.currencySymbol,
                askingPrice: resaleListings.askingPrice,
                vatStatus: resaleListings.vatStatus,
                location: resaleListings.location,
                bodyType: resaleListings.bodyType,
                cabType: resaleListings.cabType,
                fuelType: resaleListings.fuelType,
                gearboxType: resaleListings.gearboxType,
                wheelbase: resaleListings.wheelbase,
                engineSize: resaleListings.engineSize,
                colour: resaleListings.colour,
                seats: resaleListings.seats,
                emissionClass: resaleListings.emissionClass,
                numberOfOwners: resaleListings.numberOfOwners,
                serviceHistory: resaleListings.serviceHistory,
                basicHistoryCheck: resaleListings.basicHistoryCheck,
                motStatus: resaleListings.motStatus,
                motExpiry: resaleListings.motExpiry,
                specsAndFeatures: resaleListings.specsAndFeatures,
                taxStatus: resaleListings.taxStatus,
                taxDueDate: resaleListings.taxDueDate,
                co2Emissions: resaleListings.co2Emissions,
                markedForExport: resaleListings.markedForExport,
                dateOfLastV5CIssued: resaleListings.dateOfLastV5CIssued,
                monthOfFirstRegistration: resaleListings.monthOfFirstRegistration,
                typeApproval: resaleListings.typeApproval,
                revenueWeight: resaleListings.revenueWeight,
                aiSellPriceLow: resaleListings.aiSellPriceLow,
                aiSellPriceHigh: resaleListings.aiSellPriceHigh,
                adsPrice: resaleListings.adsPrice,
                ebayCategoryId: resaleListings.ebayCategoryId,
                eBayUrl: resaleListings.eBayUrl,
                facebookUrl: resaleListings.facebookUrl,
            })
            .from(resaleListings)
            .where(eq(resaleListings.id, id));

        if (!row) {
            return {success: false, error: "Listing not found"};
        }

        return {success: true, listing: row};
    } catch (err) {
        console.error("Failed to fetch resale listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}

// SAVE RESALE LISTING
export async function saveResaleListing(data: ResaleListingData): Promise<{
    success: boolean;
    id?: number;
    error?: string;
}> {
    /**
     * Inserts a new resale listing or updates an existing one. New listings
     * get a random 16-char hex hash code and fixed defaults for timestamps.
     * Updates only touch the editable fields and updatedAt.
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
                .update(resaleListings)
                .set({
                    status: data.status as typeof resaleListings.$inferInsert.status,
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
                    aiSellPriceLow: data.aiSellPriceLow,
                    aiSellPriceHigh: data.aiSellPriceHigh,
                    adsPrice: data.adsPrice,
                    ebayCategoryId: data.ebayCategoryId,
                    eBayUrl: data.eBayUrl,
                    facebookUrl: data.facebookUrl,
                    updatedAt: now,
                })
                .where(eq(resaleListings.id, data.id));

            revalidatePath("/auto-ads/resales");
            return {success: true, id: data.id};
        }

        // insert new listing
        const [inserted] = await getAutoAdsDb()
            .insert(resaleListings)
            .values({
                createdAt: now,
                updatedAt: now,
                listingSource: "ManualEntry",
                status: data.status as typeof resaleListings.$inferInsert.status,
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
                aiSellPriceLow: data.aiSellPriceLow,
                aiSellPriceHigh: data.aiSellPriceHigh,
                adsPrice: data.adsPrice,
                ebayCategoryId: data.ebayCategoryId,
                eBayUrl: data.eBayUrl,
                facebookUrl: data.facebookUrl,
            })
            .returning({id: resaleListings.id});

        revalidatePath("/auto-ads/resales");
        return {success: true, id: inserted.id};
    } catch (err) {
        console.error("Failed to save resale listing:", err);
        return {success: false, error: err instanceof Error ? err.message : String(err)};
    }
}
