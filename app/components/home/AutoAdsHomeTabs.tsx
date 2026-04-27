"use client";

import React, {useEffect, useState} from "react";
import {Box, Tabs, Tab, Typography} from "@mui/material";
import ResaleListingCardList from "@app/auto-ads/components/ResaleListingCardList";
import SaleItemCardList from "@app/auto-ads/components/SaleItemCardList";
import type {resaleListing} from "@app/auto-ads/resales/actions";
import type {saleItem} from "@app/auto-ads/sale-items/actions";

// SECONDARY IMAGE
interface SecondaryImage {
    /* Lightweight shape for a secondary listing image passed to the detail card. */

    id: number;
    url: string;
}

// VEHICLES TAB HASH
const VEHICLES_TAB_HASH = "vehicles";

// HOUSE SALES TAB HASH
const HOUSE_SALES_TAB_HASH = "house-sales";

// AUTO ADS HOME TABS PROPS
interface AutoAdsHomeTabsProps {
    /* Props for the home tab switcher. */

    resaleListings: resaleListing[];
    resalePrimaryImages: Record<number, string>;
    resaleSecondaryImages: Record<number, SecondaryImage[]>;
    saleItems: saleItem[];
    saleItemPrimaryImages: Record<number, string>;
    saleItemSecondaryImages: Record<number, SecondaryImage[]>;
}

// AUTO ADS HOME TABS
export default function AutoAdsHomeTabs({
    resaleListings,
    resalePrimaryImages,
    resaleSecondaryImages,
    saleItems: saleItemsProp,
    saleItemPrimaryImages,
    saleItemSecondaryImages,
}: AutoAdsHomeTabsProps) {
    /**
     * Client component that presents two MUI tabs on the auto ads home
     * page: Vehicles (active resale listings) and House Sales (sale items
     * still in inventory). Tab selection is persisted in the URL hash so
     * a tab choice is shareable and survives page refreshes. Each tab
     * renders the corresponding pre-built card list with all data
     * provided by the server component to keep this component
     * presentation-only.
     */

    const [tabIndex, setTabIndex] = useState(0);

    // hydrate the active tab from the url hash so deep-links land on the
    // expected tab without flash of the default
    useEffect(() => {
        if (typeof window === "undefined") return;
        const hash = window.location.hash.replace("#", "").trim().toLowerCase();
        if (hash === HOUSE_SALES_TAB_HASH) {
            setTabIndex(1);
        } else if (hash === VEHICLES_TAB_HASH) {
            setTabIndex(0);
        }
    }, []);

    // HANDLE TAB CHANGE
    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        /**
         * Switches the active tab and updates the URL hash so a refresh
         * or share link returns the user to the same tab.
         */

        setTabIndex(newValue);
        if (typeof window !== "undefined") {
            const hash = newValue === 1 ? HOUSE_SALES_TAB_HASH : VEHICLES_TAB_HASH;
            const newUrl = `${window.location.pathname}${window.location.search}#${hash}`;
            window.history.replaceState(null, "", newUrl);
        }
    };

    return (
        <Box>
            <Tabs
                value={tabIndex}
                onChange={handleTabChange}
                aria-label="Auto Ads home tabs"
                sx={{borderBottom: 1, borderColor: "divider"}}
            >
                <Tab label="Vehicles" />
                <Tab label="House Sales" />
            </Tabs>

            {/* vehicles tab */}
            <Box hidden={tabIndex !== 0} sx={{mt: 2}}>
                {tabIndex === 0 && (
                    resaleListings.length === 0 ? (
                        <Typography color="text.secondary" sx={{mt: 2}}>
                            No active resale listings to display.
                        </Typography>
                    ) : (
                        <ResaleListingCardList
                            listings={resaleListings}
                            primaryImageMap={resalePrimaryImages}
                            secondaryImagesMap={resaleSecondaryImages}
                        />
                    )
                )}
            </Box>

            {/* house sales tab */}
            <Box hidden={tabIndex !== 1} sx={{mt: 2}}>
                {tabIndex === 1 && (
                    saleItemsProp.length === 0 ? (
                        <Typography color="text.secondary" sx={{mt: 2}}>
                            No sale items in inventory to display.
                        </Typography>
                    ) : (
                        <SaleItemCardList
                            items={saleItemsProp}
                            primaryImageMap={saleItemPrimaryImages}
                            secondaryImagesMap={saleItemSecondaryImages}
                        />
                    )
                )}
            </Box>
        </Box>
    );
}
