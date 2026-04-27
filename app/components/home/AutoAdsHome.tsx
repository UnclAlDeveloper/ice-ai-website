import React from "react";
import {Box, Typography} from "@mui/material";
import {and, asc, desc, eq, inArray, ne} from "drizzle-orm";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {resaleListings, saleItems, images} from "@/drizzle/auto-ads/schema";
import ErrorBar from "@components/ErrorBar";
import AutoAdsHomeTabs from "./AutoAdsHomeTabs";
import OwnerCard from "./OwnerCard";
import type {resaleListing} from "@app/auto-ads/resales/actions";
import type {saleItem} from "@app/auto-ads/sale-items/actions";

// SECONDARY IMAGE
interface SecondaryImage {
    /* Lightweight shape for a secondary listing image passed to the detail card. */

    id: number;
    url: string;
}

// AUTO ADS HOME
export default async function AutoAdsHome() {
    /**
     * Server component for the Auto Ads app home page. Loads two data
     * sets in parallel:
     *   - active resale listings (status != 'Sold') with their primary
     *     and secondary images
     *   - sale items still in inventory (status = 'Inventory') with their
     *     primary and secondary images
     * All images for both listing tables are fetched in a single combined
     * query keyed on the listingTable + listingId pair, then split into
     * the per-kind image maps the client component expects. The cards are
     * publicly visible so no authentication is required.
     */

    let resaleListingsData: resaleListing[] = [];
    let saleItemsData: saleItem[] = [];
    const resalePrimaryImages: Record<number, string> = {};
    const resaleSecondaryImages: Record<number, SecondaryImage[]> = {};
    const saleItemPrimaryImages: Record<number, string> = {};
    const saleItemSecondaryImages: Record<number, SecondaryImage[]> = {};
    let error: string | null = null;

    try {
        // load both listing kinds in parallel
        [resaleListingsData, saleItemsData] = await Promise.all([
            getAutoAdsDb()
                .select()
                .from(resaleListings)
                .where(ne(resaleListings.status, "Sold"))
                .orderBy(desc(resaleListings.updatedAt)),
            getAutoAdsDb()
                .select()
                .from(saleItems)
                .where(eq(saleItems.status, "Inventory"))
                .orderBy(desc(saleItems.updatedAt)),
        ]);

        const resaleIds = resaleListingsData.map((l) => l.id);
        const saleItemIds = saleItemsData.map((s) => s.id);

        // fetch every image for the loaded listings in a single query and
        // bucket by listing kind so the client only sees the rows for
        // each side of the home page tab switcher
        if (resaleIds.length > 0 || saleItemIds.length > 0) {
            const allImages = await getAutoAdsDb()
                .select({
                    id: images.id,
                    listingId: images.listingId,
                    listingTable: images.listingTable,
                    url: images.url,
                    isPrimary: images.isPrimary,
                })
                .from(images)
                .where(
                    and(
                        inArray(images.listingTable, ["Resale", "SaleItem"]),
                        // narrow on listingId once the listingTable predicate has
                        // already split the candidates by kind; combining both id
                        // sets here is safe because listing ids are unique within
                        // each table and we re-check the listingTable per image
                        inArray(images.listingId, [...resaleIds, ...saleItemIds]),
                    ),
                )
                .orderBy(asc(images.id));

            for (const image of allImages) {
                const isPrimary = image.isPrimary === true;
                if (image.listingTable === "Resale") {
                    if (isPrimary) {
                        resalePrimaryImages[image.listingId] = image.url;
                    } else {
                        if (!resaleSecondaryImages[image.listingId]) {
                            resaleSecondaryImages[image.listingId] = [];
                        }
                        resaleSecondaryImages[image.listingId].push({id: image.id, url: image.url});
                    }
                } else if (image.listingTable === "SaleItem") {
                    if (isPrimary) {
                        saleItemPrimaryImages[image.listingId] = image.url;
                    } else {
                        if (!saleItemSecondaryImages[image.listingId]) {
                            saleItemSecondaryImages[image.listingId] = [];
                        }
                        saleItemSecondaryImages[image.listingId].push({id: image.id, url: image.url});
                    }
                }
            }
        }
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    return (
        <>
            <Box sx={{pb: error ? "120px" : 0}}>
                <OwnerCard
                    name={process.env.AUTO_ADS_USERNAME}
                    phone={process.env.AUTO_ADS_PHONE}
                    email={process.env.AUTO_ADS_EMAIL}
                    facebookUrl={process.env.AUTO_ADS_FACEBOOK_URL}
                    ebayUrl={process.env.AUTO_ADS_EBAY_URL}
                    imageSrc={process.env.AUTO_ADS_IMAGE}
                />

                {error ? (
                    <Typography color="error" sx={{mt: 2}}>
                        Error loading listings. See error bar below for details.
                    </Typography>
                ) : (
                    <AutoAdsHomeTabs
                        resaleListings={resaleListingsData}
                        resalePrimaryImages={resalePrimaryImages}
                        resaleSecondaryImages={resaleSecondaryImages}
                        saleItems={saleItemsData}
                        saleItemPrimaryImages={saleItemPrimaryImages}
                        saleItemSecondaryImages={saleItemSecondaryImages}
                    />
                )}
            </Box>
            <ErrorBar error={error} />
        </>
    );
}
