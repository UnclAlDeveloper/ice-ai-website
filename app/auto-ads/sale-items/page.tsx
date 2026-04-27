import React from "react";
import {Typography, Box} from "@mui/material";
import {eq} from "drizzle-orm";
import {getServerSessionFromCookies} from "@app/lib/session";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {saleItems, lookups} from "@/drizzle/auto-ads/schema";
import ErrorBar from "@components/ErrorBar";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";
import SaleItemsClient from "./SaleItemsClient";

// EBAY CATEGORY LOOKUP TYPE
const EBAY_CATEGORY_LOOKUP_TYPE = "ebay_categories";
/** Matches `lookup_type` for eBay category rows in the lookups table. */

// PAGE TITLE
const PAGE_TITLE = "House Sales";
/**
 * External label for this page. The internal name everywhere in code is
 * "saleItems" — only the user-visible title says "House Sales". The string
 * is centralised here so future re-skins (e.g. a per-tenant alternative
 * label) can be done by changing this single constant.
 */

// PAGE
export default async function Page() {
    /**
     * Server component for the Sale Items (a.k.a. House Sales) page.
     * Authenticates the user, requires BasicTier, then loads inventory
     * items plus the eBay category options before delegating to the
     * client shell. The page title is passed through as a prop so the
     * external label can be tweaked without touching the client code.
     */

    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <Typography variant="h3">{PAGE_TITLE}</Typography>
                <Typography>You must be logged in to access this page.</Typography>
            </>
        );
    }

    const userTier = getUserTier(session.user.groups);

    if (!compareTiers(userTier, 'BasicTier')) {
        return (
            <>
                <Typography variant="h3">{PAGE_TITLE}</Typography>
                <Typography>You must have BasicTier or higher to access this page.</Typography>
            </>
        );
    }

    let existingItems: {id: number; title: string; description: string | null}[] = [];
    let ebayCategories: {code: string; value: string | null; description: string | null}[] = [];
    let error: string | null = null;

    try {
        // fetch inventory sale items and ebay category options in parallel.
        // description holds the full category path (e.g. "Antiques > Furniture
        // > 18th Century") which is what we display in the picker because the
        // leaf-only `value` is not unique across the eBay taxonomy.
        const [itemsResult, ebayCategoryRows] = await Promise.all([
            getAutoAdsDb()
                .select({
                    id: saleItems.id,
                    title: saleItems.title,
                    description: saleItems.description,
                })
                .from(saleItems)
                .where(eq(saleItems.status, "Inventory")),
            getAutoAdsDb()
                .select({
                    code: lookups.code,
                    value: lookups.value,
                    description: lookups.description,
                })
                .from(lookups)
                .where(eq(lookups.lookupType, EBAY_CATEGORY_LOOKUP_TYPE)),
        ]);

        existingItems = itemsResult;

        // sort by the visible label so the picker reads alphabetically by full path
        ebayCategories = [...ebayCategoryRows].sort((a, b) =>
            (a.description ?? a.value ?? a.code).localeCompare(
                b.description ?? b.value ?? b.code,
                undefined,
                {sensitivity: "base"},
            ),
        );
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    return (
        <>
            <Box sx={{pb: error ? '120px' : 0}}>
                <Typography variant="h3" sx={{mb: 2}}>{PAGE_TITLE}</Typography>

                {error ? (
                    <Typography color="error" sx={{mt: 2}}>
                        Error loading data. See error bar below for details.
                    </Typography>
                ) : (
                    <SaleItemsClient
                        pageTitle={PAGE_TITLE}
                        existingItems={existingItems}
                        ebayCategories={ebayCategories}
                    />
                )}
            </Box>
            <ErrorBar error={error} />
        </>
    );
}
