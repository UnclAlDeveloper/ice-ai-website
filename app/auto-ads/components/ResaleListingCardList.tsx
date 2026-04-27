"use client";

import React, {useEffect, useState} from "react";
import {Box} from "@mui/material";
import type {resaleListing} from "@app/auto-ads/resales/actions";
import ResaleListingCard from "./ResaleListingCard";
import ResaleListingDetailCard from "./ResaleListingDetailCard";

// SECONDARY IMAGE
interface SecondaryImage {
    /* Lightweight shape for a secondary listing image rendered in the expanded card. */

    id: number;
    url: string;
}

// RESALE LISTING CARD LIST PROPS
interface ResaleListingCardListProps {
    /* Props for the resale listing grid. */

    listings: resaleListing[];
    primaryImageMap: Record<number, string>;
    secondaryImagesMap: Record<number, SecondaryImage[]>;
}

// RESALE LISTING CARD LIST
export default function ResaleListingCardList({listings, primaryImageMap, secondaryImagesMap}: ResaleListingCardListProps) {
    /**
     * Renders a responsive grid of compact resale listing cards. The grid
     * uses CSS auto-fill so cards repeat across the screen on wide layouts
     * and collapse to a single column on small screens. When a card is
     * clicked the grid is replaced by the read-only detail view of that
     * listing alone, so the expanded listing effectively becomes its own
     * page; closing it returns to the grid. The page is scrolled to the top
     * each time the selection changes.
     */

    const [selectedId, setSelectedId] = useState<number | null>(null);

    // when a listing is opened or closed, scroll the page to the top so the
    // expanded card or the grid is visible without manual scrolling
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.scrollTo({top: 0, behavior: "smooth"});
        }
    }, [selectedId]);

    const selectedListing = selectedId !== null ? listings.find((listing) => listing.id === selectedId) : null;

    if (selectedListing) {
        // standalone full-page detail view replaces the grid entirely
        return (
            <Box sx={{mt: 1}}>
                <ResaleListingDetailCard
                    listing={selectedListing}
                    primaryImageUrl={primaryImageMap[selectedListing.id] ?? null}
                    secondaryImages={secondaryImagesMap[selectedListing.id] ?? []}
                    onClose={() => setSelectedId(null)}
                />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {xs: "1fr", sm: "repeat(auto-fill, minmax(300px, 1fr))"},
                gap: 2,
                mt: 1,
                alignItems: "start",
            }}
        >
            {listings.map((listing) => (
                <Box key={listing.id} sx={{minWidth: 0}}>
                    <ResaleListingCard
                        listing={listing}
                        primaryImageUrl={primaryImageMap[listing.id] ?? null}
                        onClick={() => setSelectedId(listing.id)}
                    />
                </Box>
            ))}
        </Box>
    );
}
