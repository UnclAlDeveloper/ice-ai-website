"use client";

import React, {useEffect, useState} from "react";
import {Box} from "@mui/material";
import type {saleItem} from "@app/auto-ads/sale-items/actions";
import SaleItemCard from "./SaleItemCard";
import SaleItemDetailCard from "./SaleItemDetailCard";

// SECONDARY IMAGE
interface SecondaryImage {
    /* Lightweight shape for a secondary listing image rendered in the expanded card. */

    id: number;
    url: string;
}

// SALE ITEM CARD LIST PROPS
interface SaleItemCardListProps {
    /* Props for the sale item grid. */

    items: saleItem[];
    primaryImageMap: Record<number, string>;
    secondaryImagesMap: Record<number, SecondaryImage[]>;
}

// SALE ITEM CARD LIST
export default function SaleItemCardList({items, primaryImageMap, secondaryImagesMap}: SaleItemCardListProps) {
    /**
     * Renders a responsive grid of compact sale item cards. Cards repeat
     * across the screen on wide layouts via CSS auto-fill and collapse to
     * one column on small screens. Tapping a card replaces the grid with
     * the read-only detail view of that item alone, mirroring the resale
     * tab's full-page detail pattern. The page is scrolled to the top
     * each time the selection changes so the active card or grid is
     * always visible without manual scrolling.
     */

    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.scrollTo({top: 0, behavior: "smooth"});
        }
    }, [selectedId]);

    const selectedItem = selectedId !== null ? items.find((item) => item.id === selectedId) : null;

    if (selectedItem) {
        // standalone full-page detail view replaces the grid entirely
        return (
            <Box sx={{mt: 1}}>
                <SaleItemDetailCard
                    item={selectedItem}
                    primaryImageUrl={primaryImageMap[selectedItem.id] ?? null}
                    secondaryImages={secondaryImagesMap[selectedItem.id] ?? []}
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
            {items.map((item) => (
                <Box key={item.id} sx={{minWidth: 0}}>
                    <SaleItemCard
                        item={item}
                        primaryImageUrl={primaryImageMap[item.id] ?? null}
                        onClick={() => setSelectedId(item.id)}
                    />
                </Box>
            ))}
        </Box>
    );
}
