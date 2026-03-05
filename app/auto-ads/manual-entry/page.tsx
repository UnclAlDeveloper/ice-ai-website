import React from "react";
import {getServerSessionFromCookies} from "@app/lib/session";
import {Typography, Box} from "@mui/material";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, lookups} from "@/drizzle/auto-ads/schema";
import {eq, and, ne, inArray} from "drizzle-orm";
import ErrorBar from "@components/ErrorBar";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";
import ManualEntryClient from "./ManualEntryClient";

// LOOKUP TYPES
const LOOKUP_TYPES = [
    "make_and_model",
    "vat_status",
    "location",
    "body_type",
    "cab_type",
    "fuel_type",
    "gearbox_type",
    "wheelbase",
    "engine_size",
    "colour",
    "emission_class",
];
/** Snake-case lookup type keys matching the lookups table's lookupType column. */

// PAGE
export default async function Page() {
    /**
     * Server component for the Manual Entry page. Authenticates the user,
     * checks for BasicTier access, fetches existing manual-entry listings
     * and lookup values, then renders the client-side editor shell.
     */

    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <Typography variant="h3">Manual Entry</Typography>
                <Typography>You must be logged in to access this page.</Typography>
            </>
        );
    }

    const userTier = getUserTier(session.user.groups);

    if (!compareTiers(userTier, 'BasicTier')) {
        return (
            <>
                <Typography variant="h3">Manual Entry</Typography>
                <Typography>You must have BasicTier or higher to access this page.</Typography>
            </>
        );
    }

    let existingListings: {id: number; makeAndModel: string; shortDescription: string}[] = [];
    let lookupMap: Record<string, string[]> = {};
    let error: string | null = null;

    try {
        // fetch manual entry listings and lookup values in parallel
        const [listingsResult, lookupRows] = await Promise.all([
            getAutoAdsDb()
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
                ),
            getAutoAdsDb()
                .select({
                    lookupType: lookups.lookupType,
                    code: lookups.code,
                })
                .from(lookups)
                .where(inArray(lookups.lookupType, LOOKUP_TYPES)),
        ]);

        existingListings = listingsResult;

        for (const type of LOOKUP_TYPES) {
            lookupMap[type] = [];
        }
        for (const row of lookupRows) {
            if (lookupMap[row.lookupType]) {
                lookupMap[row.lookupType].push(row.code);
            }
        }
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    return (
        <>
            <Box sx={{pb: error ? '120px' : 0}}>
                <Typography variant="h3" sx={{mb: 2}}>Manual Entry</Typography>

                {error ? (
                    <Typography color="error" sx={{mt: 2}}>
                        Error loading data. See error bar below for details.
                    </Typography>
                ) : (
                    <ManualEntryClient
                        existingListings={existingListings}
                        lookupMap={lookupMap}
                    />
                )}
            </Box>
            <ErrorBar error={error} />
        </>
    );
}
